/**
 * auth 云函数 - 微信登录
 * 职责：
 *   1. 接收 code（手机号授权码，可选）
 *   2. 通过 cloud.openapi 获取手机号
 *   3. 查询/创建 users 表记录
 *   4. 返回 user 信息
 */
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { code } = event

  try {
    let phone = ''

    // 1. 如果传入了 code，尝试通过 openapi 获取手机号
    if (code) {
      try {
        const phoneResult = await cloud.openapi.phonenumber.getPhoneNumber({ code })
        if (phoneResult.errCode === 0 && phoneResult.phoneInfo) {
          phone = phoneResult.phoneInfo.phoneNumber
        }
      } catch (e) {
        // 获取手机号失败不阻断登录流程，仅记录日志
        console.warn('获取手机号失败:', e.message || e.errMsg || e)
      }
    }

    // 2. 查询用户是否已存在
    const userQuery = await db.collection('users').where({ openid: OPENID }).get()
    let user

    if (userQuery.data.length > 0) {
      // 用户已存在，更新登录信息
      user = userQuery.data[0]
      const updateData = {
        lastLoginAt: new Date(),
        updatedAt: new Date()
      }
      // 如果获取到了新手机号且用户原本没有手机号，则补上
      if (phone && !user.phone) {
        updateData.phone = phone
      }
      await db.collection('users').doc(user._id).update({ data: updateData })
      user = { ...user, ...updateData }
    } else {
      // 3. 创建新用户
      const newUser = {
        openid: OPENID,
        phone,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date()
      }
      const result = await db.collection('users').add({ data: newUser })
      user = { _id: result._id, ...newUser }
    }

    // 4. 返回用户信息
    return {
      code: 0,
      msg: 'ok',
      data: {
        token: OPENID, // 小程序云开发场景下 openid 即可标识用户
        user
      }
    }
  } catch (err) {
    console.error('auth error:', err)
    return { code: -1, msg: err.message || '登录失败' }
  }
}
