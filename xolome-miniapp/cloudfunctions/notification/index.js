/**
 * notification 云函数 - 通知推送
 * 职责：
 *   1. 发送微信订阅消息（通过 cloud.openapi.subscribeMessage.send）
 *   2. 记录 notifications 表
 *   3. 支持批量发送
 *
 * 调用方式：
 *   action=send:  { action, userId, scene, orderId, content }
 *   action=batch: { action, messages: [{ userId, scene, orderId, content }, ...] }
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 订阅消息模板映射（scene → templateId）
// 部署时用环境变量 SUBSCRIBE_TEMPLATES(JSON 字符串) 覆盖为后台申请的真实模板ID，
// 例如：{"DEPOSIT_SUCCESS":"xxxx","SHIPPED":"yyyy"}
const DEFAULT_TEMPLATE_MAP = {
  DEPOSIT_SUCCESS: 'tmpl_deposit_success',
  DEPOSIT_DEADLINE_WARNING: 'tmpl_deposit_warning',
  DEPOSIT_GRACE_START: 'tmpl_grace_start',
  DEPOSIT_GRACE_DAILY: 'tmpl_grace_daily',
  DEPOSIT_VOUCHER: 'tmpl_voucher',
  CONFIRMATION_SUCCESS: 'tmpl_confirm_success',
  CONFIRMATION_DEADLINE_WARNING: 'tmpl_confirm_warning',
  CONFIRMATION_GRACE_START: 'tmpl_grace_start',
  CONFIRMATION_GRACE_DAILY: 'tmpl_grace_daily',
  CONFIRMATION_VOUCHER: 'tmpl_voucher',
  FINAL_SUCCESS: 'tmpl_final_success',
  ORDER_LOCKED: 'tmpl_order_locked',
  VOUCHER_EXPIRE_WARNING_35: 'tmpl_voucher_expire_35',
  VOUCHER_EXPIRE_WARNING_5: 'tmpl_voucher_expire_5',
  REFUND_SUCCESS: 'tmpl_refund_success',
  SHIPPED: 'tmpl_shipped'
}

let TEMPLATE_MAP = DEFAULT_TEMPLATE_MAP
try {
  if (process.env.SUBSCRIBE_TEMPLATES) {
    TEMPLATE_MAP = { ...DEFAULT_TEMPLATE_MAP, ...JSON.parse(process.env.SUBSCRIBE_TEMPLATES) }
  }
} catch (e) {
  console.error('解析 SUBSCRIBE_TEMPLATES 失败，使用默认模板映射:', e)
}

// 订单详情页路径（与 miniprogram/app.json 保持一致）
const ORDER_DETAIL_PAGE = 'pages/order-detail/order-detail'

// 格式化为微信订阅消息 time 类型可接受的短格式：YYYY-MM-DD HH:mm（≤20字符）
function formatTime(d) {
  const pad = (n) => (n < 10 ? '0' + n : '' + n)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

/**
 * 发送单条通知
 * 1. 先在 notifications 表记录 PENDING 状态
 * 2. 调用 cloud.openapi.subscribeMessage.send 发送订阅消息
 * 3. 更新记录为 SENT 或 FAILED
 */
async function sendOne(userId, scene, orderId, content) {
  // 1. 记录通知（PENDING）
  const notifRecord = await db.collection('notifications').add({
    data: {
      userId,
      scene,
      orderId: orderId || null,
      content: content || '',
      status: 'PENDING',
      createdAt: new Date()
    }
  })

  try {
    // 2. 发送微信订阅消息
    // 注意：thing/time 等字段名需与后台每个模板的实际字段严格对应，
    //       此处按通用模板(thing1+time2)填充，接入真实模板后按模板字段调整。
    const templateId = TEMPLATE_MAP[scene] || scene
    await cloud.openapi.subscribeMessage.send({
      touser: userId,
      templateId,
      page: orderId ? `${ORDER_DETAIL_PAGE}?id=${orderId}` : 'pages/index/index',
      data: {
        thing1: { value: (content || 'XOLOme X1 通知').substring(0, 20) },
        time2: { value: formatTime(new Date()) }
      }
    })

    // 3. 更新为 SENT
    await db.collection('notifications').doc(notifRecord._id).update({
      data: { status: 'SENT', sentAt: new Date() }
    })

    return true
  } catch (err) {
    // 发送失败，更新为 FAILED 并记录错误信息
    console.error('send notification failed:', scene, err)
    await db.collection('notifications').doc(notifRecord._id).update({
      data: { status: 'FAILED', error: err.errMsg || err.message || '', updatedAt: new Date() }
    })
    return false
  }
}

exports.main = async (event, context) => {
  const { action } = event

  try {
    if (action === 'send') {
      // ========== 发送单条通知 ==========
      const { userId, scene, orderId, content } = event
      if (!userId || !scene) {
        return { code: -1, msg: 'userId 和 scene 不能为空' }
      }

      const ok = await sendOne(userId, scene, orderId, content)
      return {
        code: ok ? 0 : -1,
        msg: ok ? '发送成功' : '发送失败'
      }

    } else if (action === 'batch') {
      // ========== 批量发送 ==========
      const { messages } = event
      if (!Array.isArray(messages) || messages.length === 0) {
        return { code: -1, msg: 'messages 不能为空' }
      }

      const results = []
      for (const msg of messages) {
        const ok = await sendOne(msg.userId, msg.scene, msg.orderId, msg.content)
        results.push({ userId: msg.userId, scene: msg.scene, success: ok })
      }

      const successCount = results.filter(r => r.success).length
      return {
        code: 0,
        msg: 'ok',
        data: {
          total: results.length,
          success: successCount,
          failed: results.length - successCount,
          results
        }
      }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('notification error:', err)
    return { code: -1, msg: err.message || '通知服务异常' }
  }
}
