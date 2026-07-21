/**
 * payment 云函数 - 支付服务
 * 职责：
 *   action=prepay:   根据type(DEPOSIT/CONFIRMATION/FINAL)生成prepay参数，调用cloud.cloudPay.unifiedOrder
 *   action=callback: 微信支付回调处理
 *
 * 支付成功状态流转：
 *   DEPOSIT      成功 → DEPOSIT_PAID，退款截止+60天，宽限截止+67天
 *   CONFIRMATION 成功 → DEPOSIT_CONFIRMED，退款截止+30天，宽限截止+37天
 *   FINAL        成功 → FINAL_PAID
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 金额常量（单位：分）
const DEPOSIT_AMOUNT = 49900        // ¥499 意向金
const CONFIRMATION_AMOUNT = 100000   // ¥1,000 补足金
const FINAL_AMOUNT = 300000          // ¥3,000 尾款

// 时间常量
const DAY_MS = 24 * 60 * 60 * 1000
const DEPOSIT_REFUND_DAYS = 60       // 意向金可退款天数
const DEPOSIT_GRACE_DAYS = 7         // 意向金宽限期天数
const CONFIRMATION_REFUND_DAYS = 30  // 补足金可退款天数
const CONFIRMATION_GRACE_DAYS = 7    // 补足金宽限期天数

// 各支付类型对应的金额
const AMOUNT_MAP = {
  DEPOSIT: DEPOSIT_AMOUNT,
  CONFIRMATION: CONFIRMATION_AMOUNT,
  FINAL: FINAL_AMOUNT
}

// 各支付类型对应的商品描述
const BODY_MAP = {
  DEPOSIT: 'XOLOme X1 意向金',
  CONFIRMATION: 'XOLOme X1 补足金',
  FINAL: 'XOLOme X1 尾款'
}

/**
 * 支付成功后的核心处理逻辑
 * 更新订单状态、设置时间节点、记录支付流水
 */
async function handlePaymentSuccess(orderId, type, transactionId, amount, outTradeNo) {
  const orderResult = await db.collection('orders').doc(orderId).get()
  const order = orderResult.data

  if (!order) throw new Error('订单不存在')

  const now = new Date()
  const updateData = { updatedAt: now }
  let newStatus = order.status
  let scene = ''

  if (type === 'DEPOSIT') {
    // 意向金支付成功 → DEPOSIT_PAID
    newStatus = 'DEPOSIT_PAID'
    updateData.depositPaid = (order.depositPaid || 0) + amount
    updateData.status = newStatus
    // 退款截止 = 当前时间 + 60天
    updateData.refundDeadline = new Date(now.getTime() + DEPOSIT_REFUND_DAYS * DAY_MS)
    // 宽限截止 = 退款截止 + 7天 = 当前时间 + 67天
    updateData.graceDeadline = new Date(now.getTime() + (DEPOSIT_REFUND_DAYS + DEPOSIT_GRACE_DAYS) * DAY_MS)
    scene = 'DEPOSIT_SUCCESS'
  } else if (type === 'CONFIRMATION') {
    // 补足金支付成功 → DEPOSIT_CONFIRMED
    newStatus = 'DEPOSIT_CONFIRMED'
    updateData.confirmationPaid = (order.confirmationPaid || 0) + amount
    updateData.status = newStatus
    // 退款截止 = 当前时间 + 30天
    updateData.refundDeadline = new Date(now.getTime() + CONFIRMATION_REFUND_DAYS * DAY_MS)
    // 宽限截止 = 退款截止 + 7天 = 当前时间 + 37天
    updateData.graceDeadline = new Date(now.getTime() + (CONFIRMATION_REFUND_DAYS + CONFIRMATION_GRACE_DAYS) * DAY_MS)
    scene = 'CONFIRMATION_SUCCESS'
  } else if (type === 'FINAL') {
    // 尾款支付成功 → FINAL_PAID
    newStatus = 'FINAL_PAID'
    updateData.finalPaid = (order.finalPaid || 0) + amount
    updateData.status = newStatus
    scene = 'FINAL_SUCCESS'
  }

  // 更新订单
  await db.collection('orders').doc(orderId).update({ data: updateData })

  // 记录支付流水
  // outTradeNo 为商户订单号，退款时必须用它（而非 transactionId）原路发起
  await db.collection('payments').add({
    data: {
      orderId,
      userId: order.userId,
      type,
      amount,
      status: 'SUCCESS',
      transactionId,
      outTradeNo: outTradeNo || '',
      createdAt: now
    }
  })

  return { newStatus, userId: order.userId, scene }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'prepay') {
      // ========== 生成预支付参数 ==========
      const { orderId, type } = event

      if (!orderId || !type) {
        return { code: -1, msg: 'orderId 和 type 不能为空' }
      }

      const orderResult = await db.collection('orders').doc(orderId).get()
      const order = orderResult.data

      if (!order) return { code: -1, msg: '订单不存在' }
      if (order.userId !== OPENID) return { code: -1, msg: '无权操作该订单' }

      const amount = AMOUNT_MAP[type]
      const body = BODY_MAP[type]

      if (!amount) return { code: -1, msg: '无效的支付类型' }

      // 状态校验
      if (type === 'DEPOSIT' && order.status !== 'PENDING_DEPOSIT') {
        return { code: -1, msg: '当前订单状态不可支付意向金' }
      }
      if (type === 'CONFIRMATION' && !['DEPOSIT_PAID', 'DEPOSIT_GRACE'].includes(order.status)) {
        // DEPOSIT_VOUCHER 已转代金券（终态方向），不可再补足
        return { code: -1, msg: '当前订单状态不可支付补足金' }
      }
      if (type === 'FINAL' && order.status !== 'LOCKED') {
        return { code: -1, msg: '当前订单状态不可支付尾款' }
      }

      // 调用微信云支付统一下单
      const res = await cloud.cloudPay.unifiedOrder({
        body,
        outTradeNo: `${orderId}_${type}_${Date.now()}`,
        spbillCreateIp: '127.0.0.1',
        subMchId: process.env.SUB_MCH_ID || '',
        totalFee: amount,
        envId: cloud.DYNAMIC_CURRENT_ENV,
        functionName: 'payment' // 支付回调指向当前云函数
      })

      return {
        code: 0,
        msg: 'ok',
        data: {
          payment: res.payment,
          orderId,
          type,
          amount
        }
      }

    } else if (action === 'callback') {
      // ========== 微信支付回调处理 ==========
      const { returnCode, resultCode, outTradeNo, transactionId, totalFee } = event

      if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
        // 支付失败，记录失败流水
        console.error('支付回调失败:', event)
        return { code: -1, msg: '支付失败' }
      }

      // 解析 outTradeNo: 格式为 orderId_type_timestamp
      const parts = outTradeNo.split('_')
      const orderId = parts[0]
      const type = parts[1]

      if (!orderId || !type) {
        return { code: -1, msg: '无效的订单号格式' }
      }

      // 幂等校验：检查是否已处理过该支付
      const existingPayment = await db.collection('payments')
        .where({ transactionId })
        .count()

      if (existingPayment.total > 0) {
        return { code: 0, msg: '该支付已处理', data: { duplicated: true } }
      }

      // 执行支付成功逻辑（透传 outTradeNo，供退款原路使用）
      const result = await handlePaymentSuccess(orderId, type, transactionId, totalFee, outTradeNo)

      // 发送通知（异步，失败不影响支付结果）
      try {
        await cloud.callFunction({
          name: 'notification',
          data: {
            action: 'send',
            userId: result.userId,
            orderId,
            scene: result.scene,
            content: `${BODY_MAP[type]}支付成功`
          }
        })
      } catch (e) {
        console.error('通知发送失败:', e)
      }

      return { code: 0, msg: 'ok' }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('payment error:', err)
    return { code: -1, msg: err.message || '支付服务异常' }
  }
}
