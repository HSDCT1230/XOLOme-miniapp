// =====================================================
// pages/preorder/preorder.js — 预订单页 (V2.1 简化版)
// =====================================================

const MOCK = require('../../utils/mock-data');
const config = require('../../utils/config');
const { PAYMENT_TYPE } = require('../../utils/constant');
const nav = require('../../utils/nav');

// 分转元
function fen2yuan(fen) {
  return (fen / 100).toFixed(2);
}

Page({
  data: {
    couponCode: '',
    hasCoupon: false,
    agreed: false,
    paying: false,
    // 阶梯定价(元)
    pricing: {
      deposit: fen2yuan(config.PRICE.DEPOSIT),
      confirmation: fen2yuan(config.PRICE.CONFIRMATION),
      confirmedTotal: fen2yuan(config.PRICE.CONFIRMED_TOTAL),
      final: fen2yuan(config.PRICE.FINAL),
      retail: fen2yuan(config.PRICE.RETAIL),
      total: fen2yuan(config.PRICE.WITH_COUPON),
      coupon: '500',          // 首发代金券
      saved: '500',           // 立省金额
    },
    // 三阶段流程（V2.1:体验资格/确认购买/正式发货）
    stages: [
      {
        stage: '阶段1 · 体验资格',
        amount: '¥499',
        desc: '锁定首发体验资格',
        detail: '支付¥499即可锁定首发体验资格,60天内无理由退款',
        color: '#6ec73b',
        icon: '1',
      },
      {
        stage: '阶段2 · 确认购买',
        amount: '+¥1,000',
        desc: '补足¥1,499,进入订单确认',
        detail: '补足¥1,000后,累计支付¥1,499,30天内可申请退款',
        color: '#4589d6',
        icon: '2',
      },
      {
        stage: '阶段3 · 正式发货',
        amount: '+¥3,000',
        desc: '发货前支付尾款',
        detail: '发货前补足尾款¥3,000,完成全部支付后安排发货',
        color: '#ff8f00',
        icon: '3',
      },
    ],
    // 金额明细
    breakdown: [
      { label: '体验资格', amount: fen2yuan(config.PRICE.DEPOSIT) },
      { label: '确认购买', amount: fen2yuan(config.PRICE.CONFIRMATION) },
      { label: '尾款', amount: fen2yuan(config.PRICE.FINAL) },
    ],
  },

  onLoad(options) {
    const couponCode = options.couponCode || '';
    const hasCoupon = !!couponCode;
    this.setData({ couponCode, hasCoupon });
  },

  // 勾选协议
  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  // 查看协议
  onViewAgreement() {
    wx.showModal({
      title: 'XOLOme X1 首发预定协议',
      content: '1. ¥499体验资格:支付后60天内可无理由全额退款。\n\n2. ¥1,499确认购买:补足后30天内可全额退款。\n\n3. ¥3,000尾款:发货前支付,支付后订单锁定等待发货。\n\n4. 未在规定时间补足或确认,对应金额将转为不可退的代金券,365天内可用于XOLOme系列产品。\n\n5. 首发用户享受¥500代金券,最终支付¥4,499(原价¥4,999)。',
      showCancel: false,
      confirmText: '我已了解',
    });
  },

  // 查看退款规则详情
  onViewRefundRule() {
    wx.showModal({
      title: '退款与代金券规则',
      content: '【体验资格规则】\n· 支付¥499即可锁定首发体验资格\n· 60天内无理由退款\n\n【确认购买规则】\n· 补足¥1,499后进入确认阶段\n· 30天内可申请退款\n\n【代金券】\n· 未在规定时间补足或确认,对应金额转为代金券\n· 365天有效,可用于XOLOme系列产品\n· 过期未使用将自动作废',
      showCancel: false,
      confirmText: '我已了解',
    });
  },

  // 支付体验资格（意向金）
  async onPay() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先同意预定协议', icon: 'none' });
      return;
    }
    if (this.data.paying) return;

    this.setData({ paying: true });
    wx.showLoading({ title: '创建订单...' });

    try {
      // 1. 创建订单
      const order = MOCK.createOrder({
        couponCode: this.data.couponCode || null,
      });

      // 2. 模拟支付体验资格
      wx.showLoading({ title: '支付中...' });
      const paid = MOCK.mockPay(order.id, config.PRICE.DEPOSIT, PAYMENT_TYPE.DEPOSIT);

      wx.hideLoading();

      wx.showToast({ title: '锁定成功', icon: 'success' });

      // 3. 跳转订单详情
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/order-detail/order-detail?id=' + paid.id,
          fail: () => nav.goHome(),
        });
      }, 1000);
    } catch (err) {
      wx.hideLoading();
      wx.showModal({
        title: '支付失败',
        content: err.message || '请稍后重试',
        showCancel: false,
      });
    } finally {
      this.setData({ paying: false });
    }
  },
});
