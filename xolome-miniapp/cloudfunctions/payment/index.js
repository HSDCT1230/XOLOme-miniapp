/**
 * payment 云函数 - 支付服务
 * 职责：
 *   action=prepay:   根据type(DEPOSIT/CONFIRMATION/FINAL)生成prepay参数，调用 cloud.cloudPay.unifiedOrder
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
const DEPOSIT_AMOUNT = 49900        // ¥499 体验资格
const CONFIRMATION_AMOUNT = 100000   // ¥1,000 补足金
const FINAL_AMOUNT = 300000          // ¥3,000 尾款

// 时间常量
const DAY_MS = 24 * 60 * 60 * 1000
const DEPOSIT_REFUND_DAYS = 60       // 体验资格可退款天数
const DEPOSIT_GRACE_DAYS = 7         // 体验资格宽限期天数
const CONFIRMATION_REFUND_DAYS = 30  // 补足金可退款天数
const CONFIRMATION_GRACE_DAYS = 7    // 补足金宽限期天数

// 各支付类型对应的金额
const AMOUNT_MAP = {
  DEPOSIT: DEPOSIT_AMOUNT,
  CONFIRMATION: CONFIRMATION_AMOUNT,
  FINAL: FINAL_AMOUNT
}

// 各支付类型允许的订单状态（回调须再校验）
const ALLOWED_STATUS = {
  DEPOSIT: ['PENDING_DEPOSIT'],
  CONFIRMATION: ['DEPOSIT_PAID', 'DEPOSIT_GRACE'],
  FINAL: ['LOCKED']
}

// 各支付类型对应的商品描述
const BODY_MAP = {
  DEPOSIT: 'XOLOme X1 体验资格',
  CONFIRMATION: 'XOLOme X1 确认购买补款',
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
  const allowed = ALLOWED_STATUS[type] || []
  const statusOk = allowed.includes(order.status)

  // 无论状态是否合法都记流水（钱已收到），状态非法时不改订单，留人工核对
  await db.collection('payments').add({
    data: {
      orderId,
      userId: order.userId,
      type,
      amount,
      status: 'SUCCESS',
      transactionId,
      outTradeNo: outTradeNo || '',
      anomalous: !statusOk,
      createdAt: now
    }
  })

  if (!statusOk) {
    console.error('支付回调状态机校验失败:', { orderId, type, status: order.status })
    return { newStatus: order.status, userId: order.userId, scene: '', anomalous: true }
  }

  const updateData = { updatedAt: now }
  let newStatus = order.status
  let scene = ''

  if (type === 'DEPOSIT') {
    newStatus = 'DEPOSIT_PAID'
    updateData.depositPaid = (order.depositPaid || 0) + amount
    updateData.status = newStatus
    updateData.refundDeadline = new Date(now.getTime() + DEPOSIT_REFUND_DAYS * DAY_MS)
    updateData.graceDeadline = new Date(now.getTime() + (DEPOSIT_REFUND_DAYS + DEPOSIT_GRACE_DAYS) * DAY_MS)
    scene = 'DEPOSIT_SUCCESS'
  } else if (type === 'CONFIRMATION') {
    newStatus = 'DEPOSIT_CONFIRMED'
    updateData.confirmationPaid = (order.confirmationPaid || 0) + amount
    updateData.status = newStatus
    updateData.refundDeadline = new Date(now.getTime() + CONFIRMATION_REFUND_DAYS * DAY_MS)
    updateData.graceDeadline = new Date(now.getTime() + (CONFIRMATION_REFUND_DAYS + CONFIRMATION_GRACE_DAYS) * DAY_MS)
    scene = 'CONFIRMATION_SUCCESS'
  } else if (type === 'FINAL') {
    newStatus = 'FINAL_PAID'
    updateData.finalPaid = (order.finalPaid || 0) + amount
    updateData.status = newStatus
    scene = 'FINAL_SUCCESS'
  }

  await db.collection('orders').doc(orderId).update({ data: updateData })

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

      const baseAmount = AMOUNT_MAP[type]
      const body = BODY_MAP[type]

      if (!baseAmount) return { code: -1, msg: '无效的支付类型' }

      // 状态校验
      if (type === 'DEPOSIT' && order.status !== 'PENDING_DEPOSIT') {
        return { code: -1, msg: '当前订单状态不可支付体验资格' }
      }
      if (type === 'CONFIRMATION' && !['DEPOSIT_PAID', 'DEPOSIT_GRACE'].includes(order.status)) {
        return { code: -1, msg: '当前订单状态不可支付补款' }
      }
      if (type === 'FINAL' && order.status !== 'LOCKED') {
        return { code: -1, msg: '当前订单状态不可支付尾款' }
      }

      // 同类型已成功支付则拒绝重复下单
      const paidSameType = await db.collection('payments')
        .where({ orderId, type, status: 'SUCCESS' })
        .count()
      if (paidSameType.total > 0) {
        return { code: -1, msg: '该类型款项已支付，请勿重复下单' }
      }

      // 转券抵扣仅作用于体验资格（DEPOSIT）；问卷 ¥500 不减免实付
      let amount = baseAmount
      if (type === 'DEPOSIT' && order.voucherAmount > 0) {
        amount = Math.max(0, baseAmount - (order.voucherAmount || 0))
      }
      if (amount <= 0) {
        return { code: -1, msg: '应付金额为 0，请联系客服处理全额抵扣单' }
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
          amount,
          voucherAmount: type === 'DEPOSIT' ? (order.voucherAmount || 0) : 0
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

      // 发送通知（异步，失败不影响支付结果；异常流水不发成功通知）
      if (result.scene && !result.anomalous) {
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
      }

      return { code: 0, msg: 'ok', data: { anomalous: !!result.anomalous } }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('payment error:', err)
    return { code: -1, msg: err.message || '支付服务异常' }
  }
}
