// =====================================================
// XOLOme X1 小程序 · 应用入口
// =====================================================

const config = require('./utils/config');
const MOCK = require('./utils/mock-data');

App({
  onLaunch() {
    const app = this;

    // ---- 云开发（正式收集问卷等数据）----
    if (!config.isMock && wx.cloud) {
      const initOpts = { traceUser: true };
      if (config.cloudEnv) initOpts.env = config.cloudEnv;
      try {
        wx.cloud.init(initOpts);
      } catch (e) {
        console.warn('cloud init failed', e);
      }
    }

    // ---- Mock 本地存储（仅模拟模式）----
    if (config.isMock) {
      MOCK.initStorage();
    }

    // ---- 用户 ----
    const cached = wx.getStorageSync('user');
    if (config.isMock) {
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
    } else {
      app.globalData.user = cached || null;
      // 正式环境用 openid 由云函数侧识别；此处仅缓存展示信息
      if (!cached) {
        wx.setStorageSync('user', {
          id: 'cloud_user',
          nickname: '微信用户',
          avatarUrl: '',
        });
        app.globalData.user = wx.getStorageSync('user');
      }
    }

    app.globalData = {
      ...app.globalData,
      stockRemaining: config.isMock ? MOCK.getStockRemaining() : config.STOCK_TOTAL,
      version: config.isMock ? '1.0.0-sim' : '1.0.0',
      isMock: config.isMock,
    };
  },

  onShow() {
    if (config.isMock) {
      this.globalData.stockRemaining = MOCK.getStockRemaining();
    }
  },

  onHide() {},

  refreshUser() {
    const user = wx.getStorageSync('user');
    if (user) this.globalData.user = user;
  },

  refreshStock() {
    if (config.isMock) {
      this.globalData.stockRemaining = MOCK.getStockRemaining();
    }
  },
});
