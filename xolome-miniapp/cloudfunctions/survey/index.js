/**
 * survey 云函数 - 问卷服务（写入云数据库 surveys，后台可直接查看）
 * action=submit: 提交问卷，防重复，返回 couponCode
 * action=get:    当前用户问卷列表
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function generateCouponCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return 'XOLO' + code
}

function pick(data, key) {
  if (data[key] !== undefined) return data[key]
  return data[String(key)]
}

/** 展开题号字段，方便云开发控制台筛选导出 */
function flattenAnswers(data) {
  const raw = data || {}
  return {
    age: pick(raw, 1) || null,
    gender: pick(raw, 2) || null,
    digitalBudget: pick(raw, 3) || null,
    purchaseHistory: pick(raw, 4) || null,
    firstImpression: pick(raw, 5) || null,
    firstImpressionNote: pick(raw, '5a') || '',
    compareCategory: pick(raw, 6) || null,
    scenarios: pick(raw, 7) || [],
    deskTime: pick(raw, 8) || null,
    coreInterests: pick(raw, 9) || [],
    topFeature: pick(raw, 10) || null,
    ipEcosystemInterest: pick(raw, 11) || null,
    ipFocusPreference: pick(raw, '11a') || null,
    addonPriceAccept: pick(raw, '11b') || null,
    wishIp: pick(raw, '11c') || '',
    ipShellPremium: pick(raw, '11d') || null,
    // v17：11e 已并入 11b；仅写 addonPriceAccept，ipMerchPayCap 固定 null 保留字段兼容
    // v18：Q12 preferredDeskScene 选项改为家庭+工位扁平单选（无大类分支）
    // v19：Q11 兴趣题去多桶（外壳/数字拆到 11a）；11a–11d 仅 very_interested/interested 可见
    // v20：Q9 none_attractive 隐藏 Q10/分支；Q10 可 none_first；Q13/Q15 去乐观前提；14a 增观望原因
    // v21：Q12 增 not_want；14a 合并 unproven→want_reviews；文案微调（无 flatten 结构变更）
    // topFeature 可为 null / none_first；priceRange 可含 not_consider
    ipMerchPayCap: null,
    albumUse: pick(raw, '11ha') || null,
    albumConcern: pick(raw, '11hb') || null,
    aiUse: pick(raw, '11ai') || null,
    aiProactive: pick(raw, '11ab') || null,
    gameScene: pick(raw, '11gc') || null,
    gamePriority: pick(raw, '11gb') || null,
    entertainmentContent: pick(raw, '11he') || null,
    entertainmentSource: pick(raw, '11hb2') || null,
    preferredDeskScene: pick(raw, 12) || null,
    priceRange: pick(raw, 13) || null,
    participation: pick(raw, 14) || null,
    barriers: pick(raw, '14a') || [],
    barrierNote: pick(raw, '14b') || '',
    buyTiming: pick(raw, 15) || null,
    otherSuggest: pick(raw, 16) || '',
    channels: pick(raw, 17) || [],
    displayName: pick(raw, 18) || '',
    contact: pick(raw, 19) || '',
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext()
  const { action } = event

  try {
    if (action === 'submit') {
      const surveyData = event.data
      if (!surveyData) {
        return { code: -1, msg: '问卷数据不能为空' }
      }

      // 同一用户已提交过：直接返回原券码，避免刷券
      const existed = await db
        .collection('surveys')
        .where({ userId: OPENID })
        .limit(20)
        .get()

      if (existed.data && existed.data.length > 0) {
        const row = existed.data.sort((a, b) => {
          const ta = a.createdAt && a.createdAt.getTime ? a.createdAt.getTime() : 0
          const tb = b.createdAt && b.createdAt.getTime ? b.createdAt.getTime() : 0
          return tb - ta
        })[0]
        return {
          code: 0,
          msg: 'already_submitted',
          data: {
            survey: row,
            couponCode: row.couponCode,
            alreadySubmitted: true,
          },
        }
      }

      const couponCode = generateCouponCode()
      const now = db.serverDate()
      const flat = flattenAnswers(surveyData)

      const survey = {
        userId: OPENID,
        openid: OPENID,
        data: surveyData,
        ...flat,
        couponCode,
        version: 'v21',
        createdAt: now,
        updatedAt: now,
      }

      const result = await db.collection('surveys').add({ data: survey })
      survey._id = result._id

      return {
        code: 0,
        msg: 'ok',
        data: { survey, couponCode, alreadySubmitted: false },
      }
    }

    if (action === 'get') {
      const result = await db
        .collection('surveys')
        .where({ userId: OPENID })
        .limit(20)
        .get()

      const list = (result.data || []).sort((a, b) => {
        const ta = a.createdAt && a.createdAt.getTime ? a.createdAt.getTime() : 0
        const tb = b.createdAt && b.createdAt.getTime ? b.createdAt.getTime() : 0
        return tb - ta
      })

      return {
        code: 0,
        msg: 'ok',
        data: list,
      }
    }

    return { code: -1, msg: '无效的 action' }
  } catch (err) {
    console.error('survey error:', err)
    return { code: -1, msg: err.message || '问卷服务异常' }
  }
}
