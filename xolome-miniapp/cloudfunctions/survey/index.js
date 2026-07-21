/**
 * survey 云函数 - 问卷服务
 * 职责：
 *   action=submit: 接收问卷数据，写入 surveys 表，生成优惠券码，返回 { survey, couponCode }
 *   action=get:    获取当前用户问卷列表
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 生成8位优惠券码（去除易混淆字符 O/0/I/1）
 * 格式：XOLO + 8位随机字符
 */
function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return 'XOLO' + code
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'submit') {
      // 提交问卷
      const { data: surveyData } = event

      if (!surveyData) {
        return { code: -1, msg: '问卷数据不能为空' }
      }

      const couponCode = generateCouponCode()
      const now = new Date()

      const survey = {
        userId: OPENID,
        data: surveyData,
        couponCode,
        createdAt: now
      }

      const result = await db.collection('surveys').add({ data: survey })
      survey._id = result._id

      return {
        code: 0,
        msg: 'ok',
        data: { survey, couponCode }
      }

    } else if (action === 'get') {
      // 获取当前用户问卷列表（按时间倒序）
      const result = await db.collection('surveys')
        .where({ userId: OPENID })
        .orderBy('createdAt', 'desc')
        .get()

      return {
        code: 0,
        msg: 'ok',
        data: result.data
      }

    } else {
      return { code: -1, msg: '无效的 action' }
    }
  } catch (err) {
    console.error('survey error:', err)
    return { code: -1, msg: err.message || '问卷服务异常' }
  }
}
