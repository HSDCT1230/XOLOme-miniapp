// =====================================================
// pages/order-detail/order-detail.js — 订单详情 (V2.1 简化版)
// =====================================================

const MOCK = require('../../utils/mock-data');
const config = require('../../utils/config');
const { ORDER_STATUS, STATUS_TEXT, PAYMENT_TYPE, REFUND_STATUS_TEXT } = require('../../utils/constant');
const SM = require('../../utils/state-machine');
const nav = require('../../utils/nav');

// 分转元
function fen2yuan(fen) {
  return (fen / 100).toFixed(2);
}

// 格式化时间
function formatTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// 倒计时格式化
function formatCountdown(ms) {
  if (ms <= 0) return '已结束';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (days > 0) return days + '天 ' + hours + '时';
  if (hours > 0) return hours + '时 ' + minutes + '分';
  return minutes + '分';
}

Page({
  data: {
    orderId: '',
    order: null,
    stage: null,
    breakdown: [],
    // 阶段进度 (V2.1:体验资格/确认购买/尾款/发货)
    progressSteps: [
      { label: '体验资格', desc: '¥499' },
      { label: '确认购买', desc: '¥1,499' },
      { label: '尾款', desc: '¥3,000' },
      { label: '发货', desc: '等待发货' },
    ],
    currentStageIndex: -1,
    // 倒计时
    countdownText: '',
    countdownLabel: '',
    // 时间节点 (V2.1:只显示已发生事件,隐藏Day X/宽限期截止等)
    timeline: [],
    // 操作中
    acting: false,
  },

  _timer: null,

  onLoad(options) {
    this.setData({ orderId: options.id || '' });
    this.loadOrder();
  },

  onShow() {
    if (this.data.orderId) this.loadOrder();
    this.startTimer();
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
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

    const stage = SM.calcOrderStage(order);
    const breakdown = SM.getAmountBreakdown(order);

    // V2.1:附加ruleTip字段,显示简单规则提示
    const stageWithTip = {
      ...stage,
      ruleTip: this.getRuleTip(order, stage),
    };

    // 构建时间节点列表 (V2.1:只显示已发生事件)
    const timeline = this.buildTimeline(order);

    // 格式化金额
    const formattedOrder = {
      ...order,
      depositAmountY: fen2yuan(order.depositAmount),
      confirmationAmountY: fen2yuan(order.confirmationAmount),
      confirmedAmountY: fen2yuan(order.confirmedAmount),
      finalAmountY: fen2yuan(order.finalAmount),
      totalAmountY: fen2yuan(order.totalAmount),
      retailAmountY: fen2yuan(order.retailAmount),
      statusText: STATUS_TEXT[order.status] || order.status,
    };

    // 格式化金额明细
    const formattedBreakdown = breakdown.map(item => ({
      ...item,
      amountY: fen2yuan(item.amount),
    }));

    this.setData({
      order: formattedOrder,
      stage: stageWithTip,
      breakdown: formattedBreakdown,
      currentStageIndex: stage.stageIndex,
      timeline,
    });
  },

  // V2.1:根据状态获取简单规则提示文案
  getRuleTip(order, stage) {
    const s = order.status;
    if (s === ORDER_STATUS.DEPOSIT_PAID) {
      return '体验资格规则:支付¥499即可锁定首发体验资格,60天内无理由退款。';
    }
    if (s === ORDER_STATUS.DEPOSIT_GRACE) {
      return '体验资格即将调整:请尽快补足至¥1,499或申请退款,否则¥499将转为365天有效的代金券。';
    }
    if (s === ORDER_STATUS.DEPOSIT_CONFIRMED) {
      return '确认购买规则:补足¥1,499后进入确认阶段,30天内可申请退款。';
    }
    if (s === ORDER_STATUS.CONFIRMED_GRACE) {
      return '确认购买即将调整:请尽快确认是否继续,否则¥1,499将转为365天有效的代金券。';
    }
    if (s === ORDER_STATUS.DEPOSIT_VOUCHER || s === ORDER_STATUS.CONFIRMED_VOUCHER) {
      return '代金券规则:该金额已转为365天有效的代金券,可用于XOLOme系列产品。';
    }
    if (s === ORDER_STATUS.LOCKED) {
      return '订单已锁定:等待发货前支付尾款¥3,000,完成后即可安排发货。';
    }
    if (s === ORDER_STATUS.FINAL_PAID) {
      return '支付完成:尾款已支付,等待安排发货。';
    }
    if (s === ORDER_STATUS.SHIPPED) {
      return '已发货:请保持电话畅通,留意物流通知。';
    }
    return '';
  },

  // V2.1:只显示已发生事件的时间节点,隐藏未来截止时间
  buildTimeline(order) {
    const items = [];
    if (order.depositPaidAt) {
      items.push({ label: '体验资格支付', time: formatTime(order.depositPaidAt), amount: fen2yuan(order.depositAmount) });
    }
    if (order.depositConfirmedAt) {
      items.push({ label: '确认购买', time: formatTime(order.depositConfirmedAt), amount: fen2yuan(order.confirmedAmount) });
    }
    if (order.lockedAt) {
      items.push({ label: '订单锁定', time: formatTime(order.lockedAt), amount: '' });
    }
    if (order.finalPaidAt) {
      items.push({ label: '尾款支付', time: formatTime(order.finalPaidAt), amount: fen2yuan(order.finalAmount) });
    }
    // V2.1:不再展示"宽限期截止"、"代金券到期"等内部节点
    return items;
  },

  startTimer() {
    this.stopTimer();
    this.updateCountdown();
    this._timer = setInterval(() => {
      this.updateCountdown();
    }, 1000);
  },

  stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  updateCountdown() {
    const { stage } = this.data;
    if (!stage || !stage.countdown) {
      this.setData({ countdownText: '', countdownLabel: '' });
      return;
    }
    const now = Date.now();
    const target = new Date(stage.countdown).getTime();
    const diff = target - now;
    this.setData({
      countdownText: formatCountdown(diff),
      countdownLabel: stage.countdownLabel || '',
    });
  },

  // 复制订单号
  onCopyOrderNo() {
    wx.setClipboardData({
      data: this.data.order.orderNo,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  // 补足确认购买
  onSupplement() {
    if (this.data.acting) return;
    this.setData({ acting: true });
    wx.showModal({
      title: '补足确认购买',
      content: '将支付¥1,000确认购买(累计¥1,499),享受30天内可申请退款。',
      confirmText: '确认支付',
      success: (res) => {
        if (res.confirm) {
          this.doPay(config.PRICE.CONFIRMATION, PAYMENT_TYPE.CONFIRMATION);
        } else {
          this.setData({ acting: false });
        }
      },
      fail: () => this.setData({ acting: false }),
    });
  },

  // 确认继续购买 → LOCKED
  onConfirmContinue() {
    if (this.data.acting) return;
    this.setData({ acting: true });
    wx.showModal({
      title: '确认继续购买',
      content: '确认后将进入尾款支付阶段,订单锁定等待发货。',
      confirmText: '确认继续',
      success: (res) => {
        if (res.confirm) {
          this.doConfirmContinue();
        } else {
          this.setData({ acting: false });
        }
      },
      fail: () => this.setData({ acting: false }),
    });
  },

  doConfirmContinue() {
    wx.showLoading({ title: '处理中...' });
    try {
      MOCK.confirmContinue(this.data.orderId);
      wx.hideLoading();
      wx.showToast({ title: '已确认', icon: 'success' });
      this.setData({ acting: false });
      this.loadOrder();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
      this.setData({ acting: false });
    }
  },

  // 支付尾款 → 尾款分包页
  onPayFinal() {
    if (this.data.acting) return;
    wx.navigateTo({
      url: '/subpackages/final-payment/payment?id=' + this.data.orderId,
    });
  },

  doPay(amount, paymentType) {
    wx.showLoading({ title: '支付中...' });
    try {
      MOCK.mockPay(this.data.orderId, amount, paymentType);
      wx.hideLoading();
      wx.showToast({ title: '支付成功', icon: 'success' });
      this.setData({ acting: false });
      this.loadOrder();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message, icon: 'none' });
      this.setData({ acting: false });
    }
  },

  // 申请退款 → 退款分包页
  onRefund() {
    if (this.data.acting) return;
    wx.navigateTo({
      url: '/subpackages/refund/refund?id=' + this.data.orderId,
    });
  },

  // 查看代金券
  onViewVoucher() {
    wx.navigateTo({ url: '/subpackages/voucher/voucher' });
  },

  // 返回订单中心（优先回到已有中心页，避免重复压栈）
  onBackCenter() {
    const pages = getCurrentPages();
    for (let i = pages.length - 2; i >= 0; i--) {
      if (pages[i].route === 'subpackages/order-list/list') {
        wx.navigateBack({ delta: pages.length - 1 - i });
        return;
      }
    }
    wx.redirectTo({
      url: '/subpackages/order-list/list',
      fail: () => nav.goHome(),
    });
  },

  // 返回首页
  onBackHome() {
    nav.goHome();
  },
});
