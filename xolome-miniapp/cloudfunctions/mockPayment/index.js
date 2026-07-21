/**
 * mockPayment 云函数 - 模拟支付（开发期专用）
 * 职责：
 *   接收 { orderId, amount, type }
 *   直接执行支付成功逻辑：更新订单状态、记录支付流水、创建时间节点
 *   不调用真实微信支付API
 *
 * 注意：仅供开发测试使用，生产环境请使用 payment 云函数
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 金额常量（单位：分）
const DEPOSIT_AMOUNT = 49900
const CONFIRMATION_AMOUNT = 100000
const FINAL_AMOUNT = 300000

// 时间常量
const DAY_MS = 24 * 60 * 60 * 1000

// 各支付类型默认金额
const AMOUNT_MAP = {
  DEPOSIT: DEPOSIT_AMOUNT,
  CONFIRMATION: CONFIRMATION_AMOUNT,
  FINAL: FINAL_AMOUNT
}

exports.main = async (event, context) => {
  const { orderId, type } = event

  try {
    if (!orderId || !type) {
      return { code: -1, msg: 'orderId 和 type 不能为空' }
    }

    // 金额优先使用传入值，否则取默认值
    const amount = event.amount || AMOUNT_MAP[type]
    if (!amount) {
      return { code: -1, msg: '无效的支付类型' }
    }

    // 获取订单
    const orderResult = await db.collection('orders').doc(orderId).get()
    const order = orderResult.data

    if (!order) return { code: -1, msg: '订单不存在' }

    const now = new Date()
    let updateData = { updatedAt: now }
    let newStatus = order.status

    if (type === 'DEPOSIT') {
      // 意向金支付成功 → DEPOSIT_PAID（须处于待支付意向金）
      if (order.status !== 'PENDING_DEPOSIT') {
        return { code: -1, msg: '当前订单状态不可支付意向金' }
      }
      newStatus = 'DEPOSIT_PAID'
      updateData.depositPaid = (order.depositPaid || 0) + amount
      updateData.status = newStatus
      // 退款截止 = +60天
      updateData.refundDeadline = new Date(now.getTime() + 60 * DAY_MS)
      // 宽限截止 = +67天
      updateData.graceDeadline = new Date(now.getTime() + 67 * DAY_MS)
    } else if (type === 'CONFIRMATION') {
      // 补足金支付成功 → DEPOSIT_CONFIRMED（须处于意向金已付/宽限期）
      if (!['DEPOSIT_PAID', 'DEPOSIT_GRACE'].includes(order.status)) {
        return { code: -1, msg: '当前订单状态不可支付补足金' }
      }
      newStatus = 'DEPOSIT_CONFIRMED'
      updateData.confirmationPaid = (order.confirmationPaid || 0) + amount
      updateData.status = newStatus
      // 退款截止 = +30天
      updateData.refundDeadline = new Date(now.getTime() + 30 * DAY_MS)
      // 宽限截止 = +37天
      updateData.graceDeadline = new Date(now.getTime() + 37 * DAY_MS)
    } else if (type === 'FINAL') {
      // 尾款支付成功 → FINAL_PAID（须已锁定 LOCKED，与 payment 云函数保持一致）
      if (order.status !== 'LOCKED') {
        return { code: -1, msg: '当前订单状态不可支付尾款（需先确认锁定订单）' }
      }
      newStatus = 'FINAL_PAID'
      updateData.finalPaid = (order.finalPaid || 0) + amount
      updateData.status = newStatus
    } else {
      return { code: -1, msg: '无效的支付类型' }
    }

    // 更新订单状态和时间节点
    await db.collection('orders').doc(orderId).update({ data: updateData })

    // 记录支付流水（标记为模拟支付）
    const transactionId = 'MOCK_' + Date.now()
    const outTradeNo = `${orderId}_${type}_${Date.now()}`
    await db.collection('payments').add({
      data: {
        orderId,
        userId: order.userId,
        type,
        amount,
        status: 'SUCCESS',
        transactionId,
        outTradeNo,
        isMock: true,
        createdAt: now
      }
    })

    return {
      code: 0,
      msg: '模拟支付成功',
      data: {
        orderId,
        status: newStatus,
        amount,
        transactionId,
        isMock: true
      }
    }
  } catch (err) {
    console.error('mockPayment error:', err)
    return { code: -1, msg: err.message || '模拟支付失败' }
  }
}
