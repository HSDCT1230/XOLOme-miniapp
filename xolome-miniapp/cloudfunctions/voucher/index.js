/**
 * voucher 云函数 - 代金券服务
 * 职责：
 *   action=list: 获取用户代金券列表
 *   action=get:  获取单条代金券
 *   action=use:  使用代金券抵扣新订单
 *
 * 代金券来源：
 *   意向金宽限期过期 → ¥499 代金券（365天有效）
 *   补足金宽限期过期 → ¥1,499 代金券（365天有效）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'list') {
      // ========== 获取用户代金券列表 ==========
      const { status } = event // 可选过滤状态：ACTIVE / USED / EXPIRED
      const query = { userId: OPENID }
      if (status) query.status = status

      const result = await db.collection('vouchers')
        .where(query)
        .orderBy('createdAt', 'desc')
        .get()

      return {
        code: 0,
        msg: 'ok',
        data: result.data
      }

    } else if (action === 'get') {
      // ========== 获取单条代金券 ==========
      const { voucherId } = event
      if (!voucherId) return { code: -1, msg: 'voucherId 不能为空' }

      const result = await db.collection('vouchers').doc(voucherId).get()

      if (!result.data) return { code: -1, msg: '代金券不存在' }
      if (result.data.userId !== OPENID) return { code: -1, msg: '无权访问该代金券' }

      return {
        code: 0,
        msg: 'ok',
        data: result.data
      }

    } else if (action === 'use') {
      // ========== 使用代金券抵扣新订单 ==========
      const { voucherId, orderId } = event
      if (!voucherId || !orderId) {
        return { code: -1, msg: 'voucherId 和 orderId 不能为空' }
      }

      const voucherResult = await db.collection('vouchers').doc(voucherId).get()
      const voucher = voucherResult.data

      if (!voucher) return { code: -1, msg: '代金券不存在' }
      if (voucher.userId !== OPENID) return { code: -1, msg: '无权操作该代金券' }
      if (voucher.status !== 'ACTIVE') return { code: -1, msg: '代金券已使用或已过期' }

      // 校验代金券是否过期
      if (new Date(voucher.expiredAt) < new Date()) {
        await db.collection('vouchers').doc(voucherId).update({
          data: { status: 'EXPIRED' }
        })
        return { code: -1, msg: '代金券已过期' }
      }

      // 校验目标（新）订单归属与状态
      const orderResult = await db.collection('orders').doc(orderId).get()
      const order = orderResult.data

      if (!order) return { code: -1, msg: '订单不存在' }
      if (order.userId !== OPENID) return { code: -1, msg: '无权操作该订单' }

      // 代金券用于抵扣"新的待支付订单"，仅 PENDING_DEPOSIT 可绑定
      if (order.status !== 'PENDING_DEPOSIT') {
        return { code: -1, msg: '代金券只能用于待支付的新订单' }
      }
      if (order.voucherId) {
        return { code: -1, msg: '该订单已使用过代金券' }
      }
      // 不能把代金券用在它自己来源的那张订单上
      if (voucher.orderId && voucher.orderId === orderId) {
        return { code: -1, msg: '不能对来源订单自身使用该代金券' }
      }

      const now = new Date()

      // 1. 代金券置为已使用，记录抵扣到哪张新订单
      await db.collection('vouchers').doc(voucherId).update({
        data: {
          status: 'USED',
          usedOrderId: orderId,
          usedAt: now
        }
      })

      // 2. 代金券来源订单（原被放弃的订单）收敛为终态 VOUCHER_USED
      if (voucher.orderId) {
        try {
          const srcRes = await db.collection('orders').doc(voucher.orderId).get()
          const src = srcRes.data
          if (src && ['DEPOSIT_VOUCHER', 'CONFIRMED_VOUCHER'].includes(src.status)) {
            await db.collection('orders').doc(voucher.orderId).update({
              data: { status: 'VOUCHER_USED', updatedAt: now }
            })
          }
        } catch (e) {
          console.error('来源订单收敛失败:', e)
        }
      }

      // 3. 新订单记录代金券抵扣额（不改动其状态，抵扣在支付时生效）
      await db.collection('orders').doc(orderId).update({
        data: {
          voucherId,
          voucherAmount: voucher.amount,   // 抵扣金额（分）
          updatedAt: now
        }
      })

      return {
        code: 0,
        msg: '代金券已抵扣至新订单',
        data: {
          voucherId,
          orderId,
          discount: voucher.amount   // 本单抵扣金额（分）
        }
      }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('voucher error:', err)
    return { code: -1, msg: err.message || '代金券服务异常' }
  }
}
