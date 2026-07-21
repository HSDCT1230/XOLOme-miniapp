// =====================================================
// subpackages/refund/refund.js — 退款申请
// =====================================================

const MOCK = require('../../utils/mock-data');
const config = require('../../utils/config');
const { ORDER_STATUS, STATUS_TEXT } = require('../../utils/constant');
const nav = require('../../utils/nav');

// 分转元（带千分位）
function fen2yuan(fen) {
  return (fen / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

Page({
  data: {
    orderId: '',
    order: null,
    refundAmountY: '0.00',
    refundAmountRaw: 0,
    reason: '',
    reasonLength: 0,
    rules: [],
    acting: false,
  },

  onLoad(options) {
    this.setData({ orderId: options.id || '' });
    this.loadOrder();
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

    // 根据订单状态计算可退金额
    let refundAmount;
    if (order.status === ORDER_STATUS.DEPOSIT_CONFIRMED || order.status === ORDER_STATUS.CONFIRMED_GRACE) {
      refundAmount = config.PRICE.CONFIRMED_TOTAL;
    } else {
      refundAmount = config.PRICE.DEPOSIT;
    }

    // 退款规则
    const rules = this.buildRules(order);

    this.setData({
      order: {
        ...order,
        statusText: STATUS_TEXT[order.status] || order.status,
      },
      refundAmountY: fen2yuan(refundAmount),
      refundAmountRaw: refundAmount,
      rules,
    });
  },

  buildRules(order) {
    const rules = [];
    if (order.status === ORDER_STATUS.DEPOSIT_PAID ||
        order.status === ORDER_STATUS.DEPOSIT_GRACE) {
      rules.push({ label: '可退金额', value: '¥' + fen2yuan(config.PRICE.DEPOSIT), highlight: true });
      rules.push({ label: '退款窗口', value: '体验资格锁定后 ' + config.TIME.DEPOSIT_REFUND + ' 天内' });
      rules.push({ label: '体验资格有效期', value: '超期未确认购买将转为代金券' });
      rules.push({ label: '到账方式', value: '原路退回支付账户' });
    } else if (order.status === ORDER_STATUS.DEPOSIT_CONFIRMED ||
               order.status === ORDER_STATUS.CONFIRMED_GRACE) {
      rules.push({ label: '可退金额', value: '¥' + fen2yuan(config.PRICE.CONFIRMED_TOTAL), highlight: true });
      rules.push({ label: '退款窗口', value: '确认购买后 ' + config.TIME.CONFIRMED_REFUND + ' 天内' });
      rules.push({ label: '确认购买有效期', value: '超期未支付尾款将转为代金券' });
      rules.push({ label: '到账方式', value: '原路退回支付账户' });
    } else {
      rules.push({ label: '当前状态', value: '该订单当前不可退款' });
    }
    return rules;
  },

  onReasonInput(e) {
    const val = e.detail.value || '';
    this.setData({
      reason: val,
      reasonLength: val.length,
    });
  },

  onConfirmRefund() {
    if (this.data.acting) return;
    if (!this.data.order) return;

    this.setData({ acting: true });
    wx.showModal({
      title: '确认退款',
      content: '退款金额 ¥' + this.data.refundAmountY + ',退款将原路返回。确认申请退款吗?',
      confirmText: '确认退款',
      confirmColor: '#ff595f',
      cancelText: '再想想',
      success: (res) => {
        if (res.confirm) {
          this.doRefund();
        } else {
          this.setData({ acting: false });
        }
      },
      fail: () => this.setData({ acting: false }),
    });
  },

  doRefund() {
    wx.showLoading({ title: '处理中...' });
    try {
      const reason = this.data.reason || '用户主动退款';
      MOCK.applyRefund(this.data.orderId, reason);
      wx.hideLoading();
      wx.showToast({ title: '退款成功', icon: 'success' });
      setTimeout(() => {
        // 回到订单详情展示退款后状态；无栈则回首页
        wx.redirectTo({
          url: '/pages/order-detail/order-detail?id=' + this.data.orderId,
          fail: () => nav.goHome(),
        });
      }, 1200);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
      this.setData({ acting: false });
    }
  },

  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '如遇退款问题,请致电客服热线 400-888-0000',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onBack() {
    nav.backOrHome();
  },
});
