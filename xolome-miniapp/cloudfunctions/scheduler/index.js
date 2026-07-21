/**
 * scheduler 云函数 - 定时状态流转 + 通知
 * 职责：
 *   每5分钟触发器执行，支持手动调用并传入 mockNow 模拟未来时间
 *
 * 状态流转逻辑：
 *   1. DEPOSIT_PAID    且 refundDeadline已过  → DEPOSIT_GRACE，发通知
 *   2. DEPOSIT_GRACE   且 graceDeadline已过   → DEPOSIT_VOUCHER，创建代金券，发通知
 *   3. DEPOSIT_CONFIRMED 且 refundDeadline已过 → CONFIRMED_GRACE，发通知
 *   4. CONFIRMED_GRACE 且 graceDeadline已过   → CONFIRMED_VOUCHER，创建代金券，发通知
 *   5. 代金券 ACTIVE 且 expiredAt已过        → EXPIRED
 *   6. 提前3天预警通知（DEPOSIT_PAID / DEPOSIT_CONFIRMED）
 *   7. 宽限期每日通知（DEPOSIT_GRACE / CONFIRMED_GRACE）
 *   8. 代金券过期预警（提前35天 + 提前5天）
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ========== 常量定义 ==========
const DAY_MS = 24 * 60 * 60 * 1000
const VOUCHER_VALID_DAYS = 365          // 代金券有效期 365 天
const DEPOSIT_VOUCHER_AMOUNT = 49900    // ¥499 意向金代金券
const CONFIRMATION_VOUCHER_AMOUNT = 149900 // ¥1,499 补足金代金券
const WARNING_DAYS = 3                  // 提前预警天数
const VOUCHER_WARN_35_DAYS = 35         // 代金券提前35天预警
const VOUCHER_WARN_5_DAYS = 5           // 代金券提前5天预警

/**
 * 创建代金券记录
 */
async function createVoucher(userId, amount, source, orderId) {
  const now = new Date()
  const voucher = {
    userId,
    amount,
    status: 'ACTIVE',
    source,             // DEPOSIT_GRACE 或 CONFIRMED_GRACE
    orderId,
    expiredAt: new Date(now.getTime() + VOUCHER_VALID_DAYS * DAY_MS),
    createdAt: now
  }
  const result = await db.collection('vouchers').add({ data: voucher })
  return { _id: result._id, ...voucher }
}

/**
 * 发送通知（调用 notification 云函数）
 * 在开发期也可改用 mockNotification
 */
async function sendNotification(userId, scene, orderId, content) {
  try {
    await cloud.callFunction({
      name: 'notification',
      data: { action: 'send', userId, scene, orderId, content }
    })
  } catch (e) {
    console.error('sendNotification failed:', scene, e)
  }
}

/**
 * 检查今天是否已发过某类通知（防止重复发送）
 */
async function hasNotifiedToday(orderId, scene, mockNow) {
  const todayStart = new Date(mockNow)
  todayStart.setHours(0, 0, 0, 0)
  const result = await db.collection('notifications')
    .where({
      orderId,
      scene,
      createdAt: _.gte(todayStart)
    })
    .count()
  return result.total > 0
}

/**
 * 检查某代金券是否已发过特定里程碑通知
 */
async function hasVoucherNotified(voucherId, scene) {
  const result = await db.collection('notifications')
    .where({ orderId: voucherId, scene })
    .count()
  return result.total > 0
}

exports.main = async (event, context) => {
  // 支持传入 mockNow 模拟未来时间进行测试
  const mockNow = event.mockNow ? new Date(event.mockNow) : new Date()

  const stats = {
    processed: 0,      // 状态流转数
    vouchers: 0,       // 代金券创建数
    notifications: 0,  // 通知发送数
    errors: []
  }

  try {
    // ========== 1. DEPOSIT_PAID 且 refundDeadline 已过 → DEPOSIT_GRACE ==========
    const depositExpired = await db.collection('orders')
      .where({ status: 'DEPOSIT_PAID', refundDeadline: _.lt(mockNow) })
      .get()

    for (const order of depositExpired.data) {
      try {
        await db.collection('orders').doc(order._id).update({
          data: { status: 'DEPOSIT_GRACE', updatedAt: mockNow }
        })
        await sendNotification(
          order.userId,
          'DEPOSIT_GRACE_START',
          order._id,
          '您的意向金退款期已结束，进入7天宽限期，请尽快补足订单'
        )
        stats.processed++
        stats.notifications++
      } catch (e) {
        stats.errors.push({ step: 1, orderId: order._id, error: e.message })
      }
    }

    // ========== 2. DEPOSIT_GRACE 且 graceDeadline 已过 → DEPOSIT_VOUCHER ==========
    const depositGraceExpired = await db.collection('orders')
      .where({ status: 'DEPOSIT_GRACE', graceDeadline: _.lt(mockNow) })
      .get()

    for (const order of depositGraceExpired.data) {
      try {
        await db.collection('orders').doc(order._id).update({
          data: { status: 'DEPOSIT_VOUCHER', updatedAt: mockNow }
        })
        // 创建 ¥499 代金券（365天有效）
        await createVoucher(order.userId, DEPOSIT_VOUCHER_AMOUNT, 'DEPOSIT_GRACE', order._id)
        await sendNotification(
          order.userId,
          'DEPOSIT_VOUCHER',
          order._id,
          '宽限期已结束，您的¥499代金券已生成，有效期365天'
        )
        stats.processed++
        stats.vouchers++
        stats.notifications++
      } catch (e) {
        stats.errors.push({ step: 2, orderId: order._id, error: e.message })
      }
    }

    // ========== 3. DEPOSIT_CONFIRMED 且 refundDeadline 已过 → CONFIRMED_GRACE ==========
    const confirmExpired = await db.collection('orders')
      .where({ status: 'DEPOSIT_CONFIRMED', refundDeadline: _.lt(mockNow) })
      .get()

    for (const order of confirmExpired.data) {
      try {
        await db.collection('orders').doc(order._id).update({
          data: { status: 'CONFIRMED_GRACE', updatedAt: mockNow }
        })
        await sendNotification(
          order.userId,
          'CONFIRMATION_GRACE_START',
          order._id,
          '您的补足金退款期已结束，进入7天宽限期，请尽快确认订单'
        )
        stats.processed++
        stats.notifications++
      } catch (e) {
        stats.errors.push({ step: 3, orderId: order._id, error: e.message })
      }
    }

    // ========== 4. CONFIRMED_GRACE 且 graceDeadline 已过 → CONFIRMED_VOUCHER ==========
    const confirmGraceExpired = await db.collection('orders')
      .where({ status: 'CONFIRMED_GRACE', graceDeadline: _.lt(mockNow) })
      .get()

    for (const order of confirmGraceExpired.data) {
      try {
        await db.collection('orders').doc(order._id).update({
          data: { status: 'CONFIRMED_VOUCHER', updatedAt: mockNow }
        })
        // 创建 ¥1,499 代金券（365天有效）
        await createVoucher(order.userId, CONFIRMATION_VOUCHER_AMOUNT, 'CONFIRMED_GRACE', order._id)
        await sendNotification(
          order.userId,
          'CONFIRMATION_VOUCHER',
          order._id,
          '宽限期已结束，您的¥1,499代金券已生成，有效期365天'
        )
        stats.processed++
        stats.vouchers++
        stats.notifications++
      } catch (e) {
        stats.errors.push({ step: 4, orderId: order._id, error: e.message })
      }
    }

    // ========== 5. 代金券 ACTIVE 且 expiredAt 已过 → EXPIRED ==========
    const expiredVouchers = await db.collection('vouchers')
      .where({ status: 'ACTIVE', expiredAt: _.lt(mockNow) })
      .get()

    for (const voucher of expiredVouchers.data) {
      try {
        await db.collection('vouchers').doc(voucher._id).update({
          data: { status: 'EXPIRED' }
        })
        stats.processed++
      } catch (e) {
        stats.errors.push({ step: 5, voucherId: voucher._id, error: e.message })
      }
    }

    // ========== 6. 提前3天预警通知（DEPOSIT_PAID / DEPOSIT_CONFIRMED） ==========
    const warningStart = mockNow
    const warningEnd = new Date(mockNow.getTime() + WARNING_DAYS * DAY_MS)

    // 意向金退款到期预警
    const depositWarning = await db.collection('orders')
      .where({
        status: 'DEPOSIT_PAID',
        refundDeadline: _.gte(warningStart).and(_.lt(warningEnd))
      })
      .get()

    for (const order of depositWarning.data) {
      try {
        const notified = await hasNotifiedToday(order._id, 'DEPOSIT_DEADLINE_WARNING', mockNow)
        if (!notified) {
          await sendNotification(
            order.userId,
            'DEPOSIT_DEADLINE_WARNING',
            order._id,
            '您的意向金退款期将在3天内到期，请及时处理'
          )
          stats.notifications++
        }
      } catch (e) {
        stats.errors.push({ step: 6, orderId: order._id, error: e.message })
      }
    }

    // 补足金退款到期预警
    const confirmWarning = await db.collection('orders')
      .where({
        status: 'DEPOSIT_CONFIRMED',
        refundDeadline: _.gte(warningStart).and(_.lt(warningEnd))
      })
      .get()

    for (const order of confirmWarning.data) {
      try {
        const notified = await hasNotifiedToday(order._id, 'CONFIRMATION_DEADLINE_WARNING', mockNow)
        if (!notified) {
          await sendNotification(
            order.userId,
            'CONFIRMATION_DEADLINE_WARNING',
            order._id,
            '您的补足金退款期将在3天内到期，请及时确认'
          )
          stats.notifications++
        }
      } catch (e) {
        stats.errors.push({ step: 6, orderId: order._id, error: e.message })
      }
    }

    // ========== 7. 宽限期每日通知（DEPOSIT_GRACE / CONFIRMED_GRACE） ==========
    const graceOrders = await db.collection('orders')
      .where({ status: _.in(['DEPOSIT_GRACE', 'CONFIRMED_GRACE']) })
      .get()

    for (const order of graceOrders.data) {
      try {
        const scene = order.status === 'DEPOSIT_GRACE'
          ? 'DEPOSIT_GRACE_DAILY'
          : 'CONFIRMATION_GRACE_DAILY'
        const notified = await hasNotifiedToday(order._id, scene, mockNow)
        if (!notified) {
          const msg = order.status === 'DEPOSIT_GRACE'
            ? '宽限期提醒：您的意向金退款期已过，请尽快补足订单，否则将转为代金券'
            : '宽限期提醒：您的补足金退款期已过，请尽快确认订单，否则将转为代金券'
          await sendNotification(order.userId, scene, order._id, msg)
          stats.notifications++
        }
      } catch (e) {
        stats.errors.push({ step: 7, orderId: order._id, error: e.message })
      }
    }

    // ========== 8. 代金券过期预警（提前35天 + 提前5天） ==========
    const voucherWarn35End = new Date(mockNow.getTime() + VOUCHER_WARN_35_DAYS * DAY_MS)
    const voucherWarn5End = new Date(mockNow.getTime() + VOUCHER_WARN_5_DAYS * DAY_MS)

    // 提前35天预警（expiredAt 在 [now, now+35天] 之间且尚未发过35天预警）
    const voucherWarn35 = await db.collection('vouchers')
      .where({
        status: 'ACTIVE',
        expiredAt: _.gte(mockNow).and(_.lt(voucherWarn35End))
      })
      .get()

    for (const voucher of voucherWarn35.data) {
      try {
        const notified = await hasVoucherNotified(voucher._id, 'VOUCHER_EXPIRE_WARNING_35')
        if (!notified) {
          await sendNotification(
            voucher.userId,
            'VOUCHER_EXPIRE_WARNING_35',
            voucher._id,
            `您的¥${(voucher.amount / 100).toFixed(0)}代金券将在35天后过期，请尽快使用`
          )
          stats.notifications++
        }
      } catch (e) {
        stats.errors.push({ step: 8, voucherId: voucher._id, error: e.message })
      }
    }

    // 提前5天预警（expiredAt 在 [now, now+5天] 之间且尚未发过5天预警）
    const voucherWarn5 = await db.collection('vouchers')
      .where({
        status: 'ACTIVE',
        expiredAt: _.gte(mockNow).and(_.lt(voucherWarn5End))
      })
      .get()

    for (const voucher of voucherWarn5.data) {
      try {
        const notified = await hasVoucherNotified(voucher._id, 'VOUCHER_EXPIRE_WARNING_5')
        if (!notified) {
          await sendNotification(
            voucher.userId,
            'VOUCHER_EXPIRE_WARNING_5',
            voucher._id,
            `紧急提醒：您的¥${(voucher.amount / 100).toFixed(0)}代金券将在5天后过期，请尽快使用`
          )
          stats.notifications++
        }
      } catch (e) {
        stats.errors.push({ step: 8, voucherId: voucher._id, error: e.message })
      }
    }

    return {
      code: 0,
      msg: 'ok',
      data: {
        mockNow: mockNow.toISOString(),
        ...stats
      }
    }
  } catch (err) {
    console.error('scheduler error:', err)
    return {
      code: -1,
      msg: err.message || '调度服务异常',
      data: stats
    }
  }
}
