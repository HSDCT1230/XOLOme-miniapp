// =====================================================
// utils/survey-service.js — 问卷提交/查询（Mock 或云开发）
// =====================================================

const config = require('./config');
const MOCK = require('./mock-data');

function callSurveyCloud(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!wx.cloud) {
      reject(new Error('未开通云开发，请在开发者工具开通并部署 survey 云函数'));
      return;
    }
    wx.cloud.callFunction({
      name: 'survey',
      data: { action, ...payload },
      success: (res) => {
        const body = res.result || {};
        if (body.code !== 0) {
          reject(new Error(body.msg || '问卷服务失败'));
          return;
        }
        resolve(body.data);
      },
      fail: (err) => {
        reject(new Error((err && err.errMsg) || '云函数调用失败'));
      },
    });
  });
}

/**
 * 提交问卷，返回 { couponCode, survey }
 */
async function submitSurvey(answers) {
  if (config.isMock) {
    return MOCK.submitSurvey(answers);
  }
  const data = await callSurveyCloud('submit', { data: answers });
  return {
    couponCode: data.couponCode,
    survey: data.survey,
    alreadySubmitted: !!data.alreadySubmitted,
  };
}

/**
 * 获取当前用户最新问卷（无则 null）
 */
async function getMySurvey() {
  if (config.isMock) {
    return MOCK.getMySurvey() || null;
  }
  const list = await callSurveyCloud('get');
  if (!list || !list.length) return null;
  return list[0];
}

module.exports = {
  submitSurvey,
  getMySurvey,
};
