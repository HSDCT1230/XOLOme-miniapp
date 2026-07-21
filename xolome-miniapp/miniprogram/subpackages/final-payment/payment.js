// =====================================================
// subpackages/final-payment/payment.js — 尾款支付
// =====================================================

const MOCK = require('../../utils/mock-data');
const config = require('../../utils/config');
const { ORDER_STATUS, STATUS_TEXT, PAYMENT_TYPE } = require('../../utils/constant');
const nav = require('../../utils/nav');

// 分转元（带千分位）
function fen2yuan(fen) {
  return (fen / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

Page({
  data: {
    orderId: '',
    order: null,
    finalAmountY: '3,000.00',
    finalAmountRaw: config.PRICE.FINAL,
    paidAmountY: '1,499.00',
    totalAmountY: '4,499.00',
    retailAmountY: '4,999.00',
    savedAmountY: '500.00',
    acting: false,
    paying: false,
    paySuccess: false,
    // 支付方式
    payMethods: [
      { id: 'wechat', name: '微信支付', desc: '推荐使用', icon: '💚', selected: true },
      { id: 'balance', name: '余额支付', desc: '余额 ¥0.00', icon: '💰', selected: false, disabled: true },
    ],
  },

  onLoad(options) {
    this.setData({ orderId: options.id || '' });
    this.loadOrder();
  },

  onShow() {
    if (this.data.orderId) this.loadOrder();
  },

  loadOrder() {
    const order = MOCK.getOrder(this.data.orderId);
    if (!order) {
      wx.showModal({
        title: '订单不存在',
        content: '未找到该订单,请返回重试',
        showCancel: false,
        success: () => nav.backOrHome(),
      });
      return;
    }

    // 已支付尾款
    if (order.status === ORDER_STATUS.FINAL_PAID || order.status === ORDER_STATUS.SHIPPED) {
      this.setData({ order, paySuccess: true });
      return;
    }

    this.setData({
      order: {
        ...order,
        statusText: STATUS_TEXT[order.status] || order.status,
      },
      finalAmountY: fen2yuan(config.PRICE.FINAL),
      finalAmountRaw: config.PRICE.FINAL,
      paidAmountY: fen2yuan(config.PRICE.CONFIRMED_TOTAL),
      totalAmountY: fen2yuan(order.totalAmount),
      retailAmountY: fen2yuan(order.retailAmount),
      savedAmountY: fen2yuan(order.retailAmount - order.totalAmount),
    });
  },

  onMethodTap(e) {
    const id = e.currentTarget.dataset.id;
    const method = this.data.payMethods.find(m => m.id === id);
    if (!method || method.disabled) return;
    const methods = this.data.payMethods.map(m => ({ ...m, selected: m.id === id }));
    this.setData({ payMethods: methods });
  },

  onPay() {
    if (this.data.acting || this.data.paying) return;
    this.setData({ acting: true, paying: true });
    wx.showModal({
      title: '支付尾款',
      content: '将支付尾款 ¥' + this.data.finalAmountY + ',支付后等待发货。',
      confirmText: '确认支付',
      success: (res) => {
        if (res.confirm) {
          this.doPay();
        } else {
          this.setData({ acting: false, paying: false });
        }
      },
      fail: () => this.setData({ acting: false, paying: false }),
    });
  },

  doPay() {
    wx.showLoading({ title: '支付中...', mask: true });
    try {
      MOCK.mockPay(this.data.orderId, config.PRICE.FINAL, PAYMENT_TYPE.FINAL);
      wx.hideLoading();
      this.setData({ paying: false, paySuccess: true, acting: false });
      wx.showToast({ title: '支付成功', icon: 'success' });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
      this.setData({ paying: false, acting: false });
    }
  },

  onViewOrder() {
    wx.redirectTo({
      url: '/pages/order-detail/order-detail?id=' + this.data.orderId,
      fail: () => nav.goHome(),
    });
  },

  onBackHome() {
    nav.goHome();
  },
});
