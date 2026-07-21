/**
 * refund 云函数 - 退款服务
 * 职责：
 *   action=apply:    校验可退款状态与截止时间，按原始 outTradeNo 逐笔发起退款，创建 refunds 记录
 *   action=callback: 退款回调处理，全部子退款成功后订单→REFUNDED
 *
 * 可退款状态及金额（与前端 state-machine.canRefund 保持一致）：
 *   DEPOSIT_PAID / DEPOSIT_GRACE            → 退意向金 ¥499
 *   DEPOSIT_CONFIRMED / CONFIRMED_GRACE     → 退意向金+补足金 ¥1,499
 *   且必须 now < graceDeadline（宽限期截止前）
 *
 * 不可退款：
 *   DEPOSIT_VOUCHER / CONFIRMED_VOUCHER —— 已转代金券，等同放弃退款
 *   LOCKED / FINAL_PAID / SHIPPED       —— 订单已锁定/已付尾款/已发货，不可退
 *
 * 退款原路返回；¥1,499 跨意向金+补足金两笔支付，须按各自 outTradeNo 分别退款。
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 可退款状态白名单（去除 *_VOUCHER 与 LOCKED，与产品规则一致）
const REFUNDABLE_STATUSES = [
  'DEPOSIT_PAID',
  'DEPOSIT_GRACE',
  'DEPOSIT_CONFIRMED',
  'CONFIRMED_GRACE'
]

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'apply') {
      // ========== 申请退款 ==========
      const { orderId } = event
      if (!orderId) return { code: -1, msg: 'orderId 不能为空' }

      const orderResult = await db.collection('orders').doc(orderId).get()
      const order = orderResult.data

      if (!order) return { code: -1, msg: '订单不存在' }
      if (order.userId !== OPENID) return { code: -1, msg: '无权操作该订单' }

      // 校验订单状态是否可退
      if (!REFUNDABLE_STATUSES.includes(order.status)) {
        return { code: -1, msg: '当前订单状态不可退款' }
      }

      // 截止时间校验：仅宽限期截止前可退（graceDeadline 已过则等待调度转券，不可退）
      if (order.graceDeadline && new Date(order.graceDeadline) < new Date()) {
        return { code: -1, msg: '退款期已过，订单将转为代金券' }
      }

      // 幂等校验：是否已有进行中或成功的退款
      const existingRefund = await db.collection('refunds')
        .where({ orderId, status: _.in(['PROCESSING', 'SUCCESS']) })
        .count()
      if (existingRefund.total > 0) {
        return { code: -1, msg: '该订单已有退款记录' }
      }

      // 需退款的支付类型（按状态决定退意向金 / 意向金+补足金）
      const refundTypes = ['DEPOSIT_CONFIRMED', 'CONFIRMED_GRACE'].includes(order.status)
        ? ['DEPOSIT', 'CONFIRMATION']
        : ['DEPOSIT']

      // 查询原始支付流水（须按各自 outTradeNo 逐笔退款）
      const paymentRecord = await db.collection('payments')
        .where({ orderId, status: 'SUCCESS', type: _.in(refundTypes) })
        .get()

      if (paymentRecord.data.length === 0) {
        return { code: -1, msg: '未找到原始支付记录' }
      }

      // 逐笔发起退款
      const ts = Date.now()
      const results = []
      let refundedTotal = 0
      for (let i = 0; i < paymentRecord.data.length; i++) {
        const p = paymentRecord.data[i]
        const payAmount = p.amount || 0
        if (payAmount <= 0) continue

        // 退款需原始商户订单号 outTradeNo；老数据缺失时兜底用 transactionId 并告警
        const origOutTradeNo = p.outTradeNo || p.transactionId
        if (!p.outTradeNo) {
          console.warn('支付记录缺少 outTradeNo，退款可能失败:', p._id)
        }
        const outRefundNo = `REFUND_${orderId}_${p.type}_${ts}_${i}`

        let refundId = ''
        try {
          const refundRes = await cloud.cloudPay.refund({
            outTradeNo: origOutTradeNo,
            outRefundNo,
            totalFee: payAmount,
            refundFee: payAmount,
            envId: cloud.DYNAMIC_CURRENT_ENV,
            subMchId: process.env.SUB_MCH_ID || ''
          })
          refundId = refundRes.refundId || ''
        } catch (e) {
          console.error('调用退款API失败:', p.type, e)
          return { code: -1, msg: `退款申请失败(${p.type}): ` + (e.errMsg || e.message) }
        }

        await db.collection('refunds').add({
          data: {
            orderId,
            userId: OPENID,
            type: p.type,
            amount: payAmount,
            status: 'PROCESSING',
            refundId,
            outRefundNo,
            paymentId: p._id,
            createdAt: new Date()
          }
        })

        refundedTotal += payAmount
        results.push({ type: p.type, amount: payAmount, outRefundNo })
      }

      if (results.length === 0) {
        return { code: -1, msg: '无可退金额' }
      }

      return {
        code: 0,
        msg: '退款申请已提交',
        data: { refundAmount: refundedTotal, refunds: results }
      }

    } else if (action === 'callback') {
      // ========== 退款回调处理 ==========
      const { returnCode, resultCode, outRefundNo, refundId } = event

      if (returnCode !== 'SUCCESS' || resultCode !== 'SUCCESS') {
        console.error('退款回调失败:', event)
        // 更新退款记录为失败
        if (outRefundNo) {
          await db.collection('refunds')
            .where({ outRefundNo })
            .update({ data: { status: 'FAILED', updatedAt: new Date() } })
        }
        return { code: -1, msg: '退款失败' }
      }

      // 幂等校验
      const existing = await db.collection('refunds')
        .where({ outRefundNo, status: 'SUCCESS' })
        .count()
      if (existing.total > 0) {
        return { code: 0, msg: '该退款已处理', data: { duplicated: true } }
      }

      // 更新退款记录为成功
      const refundRecord = await db.collection('refunds')
        .where({ outRefundNo })
        .get()

      if (refundRecord.data.length === 0) {
        return { code: -1, msg: '退款记录不存在' }
      }

      const refund = refundRecord.data[0]

      await db.collection('refunds').doc(refund._id).update({
        data: { status: 'SUCCESS', refundId, updatedAt: new Date() }
      })

      // 聚合校验：该订单是否仍有未完成的子退款（PROCESSING/PENDING）
      const pending = await db.collection('refunds')
        .where({ orderId: refund.orderId, status: _.in(['PROCESSING', 'PENDING']) })
        .count()

      // 仍有子退款在处理中 → 暂不改订单状态，等最后一笔回调
      if (pending.total > 0) {
        return { code: 0, msg: 'ok', data: { partial: true } }
      }

      // 全部子退款成功 → 订单转 REFUNDED，并汇总实退金额发一次通知
      await db.collection('orders').doc(refund.orderId).update({
        data: { status: 'REFUNDED', updatedAt: new Date() }
      })

      const allRefunds = await db.collection('refunds')
        .where({ orderId: refund.orderId, status: 'SUCCESS' })
        .get()
      const totalRefunded = allRefunds.data.reduce((s, r) => s + (r.amount || 0), 0)

      // 发送退款成功通知（整单一次）
      try {
        await cloud.callFunction({
          name: 'notification',
          data: {
            action: 'send',
            userId: refund.userId,
            orderId: refund.orderId,
            scene: 'REFUND_SUCCESS',
            content: `退款¥${(totalRefunded / 100).toFixed(2)}已原路返回`
          }
        })
      } catch (e) {
        console.error('退款通知发送失败:', e)
      }

      return { code: 0, msg: 'ok' }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('refund error:', err)
    return { code: -1, msg: err.message || '退款服务异常' }
  }
}
