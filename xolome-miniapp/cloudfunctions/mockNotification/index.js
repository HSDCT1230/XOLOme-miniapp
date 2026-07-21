/**
 * mockNotification 云函数 - 模拟通知（开发期专用）
 * 职责：
 *   接收 { userId, scene, orderId, content }
 *   记录到 notifications 表，标记为 SENT
 *   返回成功
 *
 * 注意：不发送真实订阅消息，仅供开发测试使用
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { userId, scene, orderId, content } = event

  try {
    if (!userId || !scene) {
      return { code: -1, msg: 'userId 和 scene 不能为空' }
    }

    const now = new Date()

    // 记录通知，直接标记为 SENT
    const result = await db.collection('notifications').add({
      data: {
        userId,
        scene,
        orderId: orderId || null,
        content: content || '',
        status: 'SENT',
        isMock: true,
        sentAt: now,
        createdAt: now
      }
    })

    return {
      code: 0,
      msg: '模拟通知已记录',
      data: {
        _id: result._id,
        status: 'SENT',
        isMock: true
      }
    }
  } catch (err) {
    console.error('mockNotification error:', err)
    return { code: -1, msg: err.message || '模拟通知失败' }
  }
}
