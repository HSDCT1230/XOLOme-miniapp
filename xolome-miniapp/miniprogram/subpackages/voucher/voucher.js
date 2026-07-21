// =====================================================
// subpackages/voucher/voucher.js — 代金券中心
// =====================================================

const MOCK = require('../../utils/mock-data');
const { VOUCHER_STATUS, VOUCHER_SOURCE } = require('../../utils/constant');
const nav = require('../../utils/nav');

const DAY_MS = 24 * 60 * 60 * 1000;

// 分转元（带千分位）
function fen2yuan(fen) {
  return (fen / 100).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 格式化日期
function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate());
}

// 倒计时格式化
function formatCountdown(ms) {
  if (ms <= 0) return '已过期';
  const days = Math.floor(ms / DAY_MS);
  const hours = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((ms % (60 * 1000)) / 1000);
  if (days > 0) return days + '天 ' + hours + '时 ' + minutes + '分';
  if (hours > 0) return hours + '时 ' + minutes + '分 ' + seconds + '秒';
  return minutes + '分 ' + seconds + '秒';
}

// 来源文案
function sourceText(sourceType) {
  if (sourceType === VOUCHER_SOURCE.DEPOSIT_VOUCHER) return '体验资格转换';
  if (sourceType === VOUCHER_SOURCE.CONFIRMED_VOUCHER) return '确认购买转换';
  return '活动赠送';
}

const TABS = [
  { key: VOUCHER_STATUS.ACTIVE, label: '可用' },
  { key: VOUCHER_STATUS.USED, label: '已使用' },
  { key: VOUCHER_STATUS.EXPIRED, label: '已过期' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: VOUCHER_STATUS.ACTIVE,
    vouchers: [],
    displayVouchers: [],
    countdownMap: {},
    isEmpty: false,
    loading: true,
    // 统计
    activeCount: 0,
    usedCount: 0,
    expiredCount: 0,
    totalValueY: '0',
  },

  _timer: null,

  onLoad() {
    this.loadVouchers();
  },

  onShow() {
    this.loadVouchers();
    this.startTimer();
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  loadVouchers() {
    const list = MOCK.getMyVouchers();
    const formatted = list.map(v => ({
      id: v.id,
      voucherNo: v.voucherNo,
      amountY: fen2yuan(v.amount),
      amountRaw: v.amount,
      sourceType: v.sourceType,
      sourceText: sourceText(v.sourceType),
      status: v.status,
      expiredAt: formatDate(v.expiredAt),
      expiredAtRaw: v.expiredAt,
      isActive: v.status === VOUCHER_STATUS.ACTIVE,
      isUsed: v.status === VOUCHER_STATUS.USED,
      isExpired: v.status === VOUCHER_STATUS.EXPIRED,
    }));

    const activeCount = formatted.filter(v => v.isActive).length;
    const usedCount = formatted.filter(v => v.isUsed).length;
    const expiredCount = formatted.filter(v => v.isExpired).length;
    const totalValue = formatted.filter(v => v.isActive).reduce((sum, v) => sum + v.amountRaw, 0);

    this.setData({
      vouchers: formatted,
      activeCount,
      usedCount,
      expiredCount,
      totalValueY: fen2yuan(totalValue),
      loading: false,
    });
    this.applyFilter();
    this.updateCountdown();
  },

  onTabTap(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ activeTab: key });
    this.applyFilter();
  },

  applyFilter() {
    const { vouchers, activeTab } = this.data;
    const display = vouchers.filter(v => v.status === activeTab);
    this.setData({ displayVouchers: display, isEmpty: display.length === 0 });
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
    const { vouchers } = this.data;
    const map = {};
    const now = Date.now();
    vouchers.forEach(v => {
      if (v.isActive && v.expiredAtRaw) {
        const target = new Date(v.expiredAtRaw).getTime();
        map[v.id] = formatCountdown(target - now);
      }
    });
    this.setData({ countdownMap: map });
  },

  onVoucherTap(e) {
    const id = e.currentTarget.dataset.id;
    const voucher = MOCK.getVoucher(id);
    if (!voucher) return;
    if (voucher.status !== VOUCHER_STATUS.ACTIVE) {
      wx.showToast({ title: '该代金券不可使用', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '代金券详情',
      content: '券号:' + voucher.voucherNo + '\n金额:¥' + fen2yuan(voucher.amount) + '\n有效期至:' + formatDate(voucher.expiredAt) + '\n\n可在下单时抵扣相应金额。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  onCopyVoucherNo(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.no,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onGoShop() {
    nav.goHome();
  },

  onBackHome() {
    nav.goHome();
  },
});
