// utils/nav.js — 统一跳转（本项目无 tabBar，禁止 switchTab）
const HOME = '/pages/index/index';

function goHome() {
  wx.reLaunch({ url: HOME });
}

/** 返回上一页；无栈时回首页 */
function backOrHome() {
  wx.navigateBack({
    fail: () => goHome(),
  });
}

function open(url, options) {
  return wx.navigateTo({ url, ...(options || {}) });
}

function redirect(url) {
  return wx.redirectTo({ url });
}

module.exports = {
  HOME,
  goHome,
  backOrHome,
  open,
  redirect,
};
