// pages/webview/webview.js — 打开业务 H5（需在小程序后台配置业务域名）
const nav = require('../../utils/nav');

Page({
  data: {
    url: '',
    loadError: false,
    errorHint: '',
  },

  onLoad(options) {
    const raw = options.url ? decodeURIComponent(options.url) : '';
    const title = options.title ? decodeURIComponent(options.title) : 'DIY 全息体验';

    if (title) {
      wx.setNavigationBarTitle({ title });
    }

    if (!raw) {
      wx.showToast({ title: '链接无效', icon: 'none' });
      setTimeout(() => nav.backOrHome(), 1200);
      return;
    }

    // 仅允许 https
    if (!/^https:\/\//i.test(raw)) {
      wx.showModal({
        title: '无法打开',
        content: '链接必须使用 https',
        showCancel: false,
        success: () => nav.backOrHome(),
      });
      return;
    }

    this.setData({ url: raw, loadError: false, errorHint: '' });
  },

  onWebViewError(e) {
    const detail = (e && e.detail) || {};
    const msg = detail.errMsg || detail.fullUrl || '';
    console.warn('[webview] load error', detail);

    let hint =
      '请在微信公众平台将 api.xolome.com 配置为「业务域名」，并在服务器根目录放置校验文件。';
    if (/domain|域名|not in domain|url not in domain/i.test(String(msg))) {
      hint =
        '业务域名未配置或校验未通过。请到微信公众平台 → 开发管理 → 开发设置 → 业务域名，添加 api.xolome.com。';
    }

    this.setData({
      loadError: true,
      errorHint: hint,
    });
  },

  onCopyLink() {
    const url = this.data.url;
    if (!url) return;
    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({ title: '链接已复制', icon: 'success' });
      },
    });
  },

  onRetry() {
    const url = this.data.url;
    this.setData({ loadError: false, errorHint: '', url: '' });
    // 触发 web-view 重新挂载
    setTimeout(() => {
      this.setData({ url });
    }, 50);
  },
});
