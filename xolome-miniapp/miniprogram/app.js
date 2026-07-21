// =====================================================
// XOLOme X1 小程序 · 应用入口
// 模拟验证版：使用本地存储替代云开发
// =====================================================

const MOCK = require('./utils/mock-data');

App({
  onLaunch() {
    const app = this;

    // ---- 初始化模拟环境 ----
    MOCK.initStorage();

    // ---- 模拟登录（正式版替换为 wx.login + 云函数） ----
    const cached = wx.getStorageSync('user');
    if (!cached) {
      const mockUser = {
        id: 'usr_' + Date.now(),
        openid: 'mock_openid_' + Math.random().toString(36).slice(2),
        nickname: '体验用户',
        avatarUrl: '',
        phone: '',
        createdAt: new Date().toISOString(),
      };
      wx.setStorageSync('user', mockUser);
      app.globalData.user = mockUser;
    } else {
      app.globalData.user = cached;
    }

    // ---- 全局状态 ----
    app.globalData = {
      ...app.globalData,
      stockRemaining: MOCK.getStockRemaining(),
      version: '1.0.0-sim',
    };
  },

  onShow() {
    // 刷新库存
    this.globalData.stockRemaining = MOCK.getStockRemaining();
  },

  onHide() {},

  // ---- 全局数据更新方法 ----
  refreshUser() {
    const user = wx.getStorageSync('user');
    if (user) this.globalData.user = user;
  },

  refreshStock() {
    this.globalData.stockRemaining = MOCK.getStockRemaining();
  },
});
