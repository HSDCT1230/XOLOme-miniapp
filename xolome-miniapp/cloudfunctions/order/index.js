/**
 * order 云函数 - 订单服务
 * 职责：
 *   action=create:  创建订单(PENDING_DEPOSIT)，校验库存(3000)
 *   action=get:     获取单条订单（含支付记录）
 *   action=list:    分页获取用户订单列表
 *   action=cancel:  取消未支付订单
 *   action=confirm: 确认继续购买 DEPOSIT_CONFIRMED/CONFIRMED_GRACE → LOCKED（打通尾款链路）
 *   action=ship:    发货 FINAL_PAID → SHIPPED（管理员动作，生产需鉴权保护）
 *
 * 金额单位：分
 *   体验资格 ¥499  = 49900
 *   补款     ¥1,000= 100000（补至¥1,499）
 *   尾款     ¥3,000= 300000
 *   合计     ¥4,499 = 449900
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 金额常量（单位：分）
const DEPOSIT_AMOUNT = 49900        // ¥499 体验资格
const CONFIRMATION_AMOUNT = 100000   // ¥1,000 补足金（补至¥1,499）
const FINAL_AMOUNT = 300000          // ¥3,000 尾款
const TOTAL_AMOUNT = 449900          // ¥4,499 总计
const MAX_STOCK = 3000               // 最大库存数量

// 真实占库状态（DEPOSIT_PAID 成功起占用，至 SHIPPED；退款/转券/过期释放）
const STOCK_OCCUPYING = [
  'DEPOSIT_PAID', 'DEPOSIT_GRACE', 'DEPOSIT_CONFIRMED', 'CONFIRMED_GRACE',
  'LOCKED', 'FINAL_PAID', 'SHIPPED'
]

// 一人一有效单：以下终态允许再建新单（含转券，否则 voucher.use 死锁）
const TERMINAL_FOR_CREATE = [
  'CANCELLED', 'REFUNDED', 'EXPIRED', 'VOUCHER_USED',
  'DEPOSIT_VOUCHER', 'CONFIRMED_VOUCHER', 'SHIPPED'
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'create') {
      // ========== 创建订单 ==========
      // 1. 校验库存：仅统计真实占位状态（退款/转券已释放）
      // 注意：count→add 非原子，极端并发下存在超卖风险。
      //       生产环境应改用独立库存计数器文档 + _.inc(-1) 原子扣减做兜底。
      const countResult = await db.collection('orders')
        .where({ status: _.in(STOCK_OCCUPYING) })
        .count()

      if (countResult.total >= MAX_STOCK) {
        return { code: -1, msg: '库存已售罄' }
      }

      const now = new Date()
      const order = {
        userId: OPENID,
        status: 'PENDING_DEPOSIT',
        totalAmount: TOTAL_AMOUNT,
        depositAmount: DEPOSIT_AMOUNT,
        confirmationAmount: CONFIRMATION_AMOUNT,
        finalAmount: FINAL_AMOUNT,
        depositPaid: 0,
        confirmationPaid: 0,
        finalPaid: 0,
        refundDeadline: null,
        graceDeadline: null,
        lockedAt: null,
        shippedAt: null,
        voucherId: null,
        voucherAmount: 0,   // 使用代金券抵扣的金额（分），0 表示未使用
        createdAt: now,
        updatedAt: now
      }

      // 2+3. 用事务把"重复下单校验 + 创建"绑定为原子操作，
      //      防止同一用户并发点击造成重复有效订单
      try {
        const txRes = await db.runTransaction(async (transaction) => {
          const existing = await transaction.collection('orders')
            .where({
              userId: OPENID,
              status: _.nin(TERMINAL_FOR_CREATE)
            })
            .get()

          if (existing.data.length > 0) {
            await transaction.rollback('DUPLICATE')
            return
          }

          const added = await transaction.collection('orders').add({ data: order })
          return added._id
        })

        order._id = txRes
        return { code: 0, msg: 'ok', data: order }
      } catch (e) {
        if (e === 'DUPLICATE' || e.rollbackCode === 'DUPLICATE') {
          return { code: -1, msg: '您已有有效订单，请先完成或取消当前订单' }
        }
        throw e
      }

    } else if (action === 'confirm') {
      // ========== 确认继续购买 → LOCKED（打通尾款链路的关键动作） ==========
      const { orderId } = event
      if (!orderId) return { code: -1, msg: 'orderId 不能为空' }

      const orderResult = await db.collection('orders').doc(orderId).get()
      const order = orderResult.data
      if (!order) return { code: -1, msg: '订单不存在' }
      if (order.userId !== OPENID) return { code: -1, msg: '无权操作该订单' }

      // 仅"已确认购买/确认购买宽限期"可锁定
      if (!['DEPOSIT_CONFIRMED', 'CONFIRMED_GRACE'].includes(order.status)) {
        return { code: -1, msg: '当前订单状态不可确认锁定' }
      }

      const now = new Date()
      await db.collection('orders').doc(orderId).update({
        data: { status: 'LOCKED', lockedAt: now, updatedAt: now }
      })

      // 通知：订单已锁定，可支付尾款
      try {
        await cloud.callFunction({
          name: 'notification',
          data: {
            action: 'send',
            userId: order.userId,
            orderId,
            scene: 'ORDER_LOCKED',
            content: '订单已锁定，请在发货前支付尾款¥3,000'
          }
        })
      } catch (e) {
        console.error('锁定通知发送失败:', e)
      }

      return { code: 0, msg: '订单已锁定，可支付尾款', data: { status: 'LOCKED' } }

    } else if (action === 'ship') {
      // ========== 发货 FINAL_PAID → SHIPPED ==========
      // ⚠️ 管理员动作：生产环境必须校验调用者为管理员（如白名单 OPENID / 自定义鉴权），
      //    当前为模拟验证版，未接管理员鉴权体系，切勿直接开放给普通用户。
      const { orderId } = event
      if (!orderId) return { code: -1, msg: 'orderId 不能为空' }

      const orderResult = await db.collection('orders').doc(orderId).get()
      const order = orderResult.data
      if (!order) return { code: -1, msg: '订单不存在' }

      if (order.status !== 'FINAL_PAID') {
        return { code: -1, msg: '仅已付尾款的订单可发货' }
      }

      const now = new Date()
      await db.collection('orders').doc(orderId).update({
        data: { status: 'SHIPPED', shippedAt: now, updatedAt: now }
      })

      try {
        await cloud.callFunction({
          name: 'notification',
          data: {
            action: 'send',
            userId: order.userId,
            orderId,
            scene: 'SHIPPED',
            content: '您的 XOLOme X1 已发货，请留意物流信息'
          }
        })
      } catch (e) {
        console.error('发货通知发送失败:', e)
      }

      return { code: 0, msg: '发货成功', data: { status: 'SHIPPED' } }

    } else if (action === 'get') {
      // ========== 获取单条订单（含支付记录） ==========
      const { orderId } = event
      if (!orderId) return { code: -1, msg: 'orderId 不能为空' }

      const orderResult = await db.collection('orders').doc(orderId).get()

      if (!orderResult.data) {
        return { code: -1, msg: '订单不存在' }
      }

      // 权限校验：只能查看自己的订单
      if (orderResult.data.userId !== OPENID) {
        return { code: -1, msg: '无权访问该订单' }
      }

      // 查询关联的支付记录
      const payments = await db.collection('payments')
        .where({ orderId })
        .orderBy('createdAt', 'desc')
        .get()

      return {
        code: 0,
        msg: 'ok',
        data: {
          order: orderResult.data,
          payments: payments.data
        }
      }

    } else if (action === 'list') {
      // ========== 分页获取用户订单列表 ==========
      const page = event.page || 1
      const pageSize = event.pageSize || 10
      const skip = (page - 1) * pageSize

      const result = await db.collection('orders')
        .where({ userId: OPENID })
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()

      const total = await db.collection('orders')
        .where({ userId: OPENID })
        .count()

      return {
        code: 0,
        msg: 'ok',
        data: {
          list: result.data,
          total: total.total,
          page,
          pageSize
        }
      }

    } else if (action === 'cancel') {
      // ========== 取消未支付订单 ==========
      const { orderId } = event
      if (!orderId) return { code: -1, msg: 'orderId 不能为空' }

      const orderResult = await db.collection('orders').doc(orderId).get()

      if (!orderResult.data) {
        return { code: -1, msg: '订单不存在' }
      }

      if (orderResult.data.userId !== OPENID) {
        return { code: -1, msg: '无权操作该订单' }
      }

      // 只有未支付意向金的订单可取消
      if (orderResult.data.status !== 'PENDING_DEPOSIT') {
        return { code: -1, msg: '当前订单状态不可取消' }
      }

      await db.collection('orders').doc(orderId).update({
        data: {
          status: 'CANCELLED',
          updatedAt: new Date()
        }
      })

      return {
        code: 0,
        msg: '订单已取消'
      }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('order error:', err)
    return { code: -1, msg: err.message || '订单服务异常' }
  }
}
