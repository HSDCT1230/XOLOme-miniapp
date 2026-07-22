// =====================================================
// utils/config.js — 环境配置 + 全局开关
// =====================================================

// ⚠️ 上线前改这里：IS_MOCK = false
const IS_MOCK = true;

const MODE = IS_MOCK ? 'simulation' : 'production';

const config = {
  mode: MODE,
  isMock: IS_MOCK,

  // ---- 金额（单位：分） ----
  PRICE: {
    DEPOSIT: 49900,      // 意向金 ¥499
    CONFIRMATION: 100000, // 补款 ¥1,000
    CONFIRMED_TOTAL: 149900, // 大定总额 ¥1,499
    FINAL: 300000,       // 尾款 ¥3,000
    RETAIL: 499900,      // 零售价 ¥4,999
    WITH_COUPON: 449900, // 问卷价 ¥4,499
  },

  // ---- 库存 ----
  STOCK_TOTAL: 3000,

  // ---- 时间窗口（单位：天） ----
  TIME: {
    DEPOSIT_REFUND: 60,     // 意向金退款窗口
    DEPOSIT_GRACE: 7,       // 意向金宽限期
    CONFIRMED_REFUND: 30,   // 大定退款窗口
    CONFIRMED_GRACE: 7,     // 大定宽限期
    VOUCHER_VALID: 365,     // 代金券有效期
    WARNING_BEFORE: 3,      // 提前3天预警
  },

  // ---- DIY 体验（上传照片 → AI 动画 → 全息仓） ----
  DIY_URL: 'https://api.xolome.com',

  // ---- 静态资源 CDN（大图不进代码包，见微信「图片≤200K」建议）----
  // 真机需在公众平台配置 downloadFile 合法域名：xolome-miniapp.pages.dev
  ASSET_CDN: 'https://xolome-miniapp.pages.dev',

  // ---- 云开发（正式环境） ----
  cloudEnv: '',
};

module.exports = config;
