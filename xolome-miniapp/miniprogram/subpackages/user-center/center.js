// =====================================================
// subpackages/user-center/center.js — 个人中心（账户与服务）
// 职责：资料 / 地址 / 问卷券码 / 客服
// 订单与付款阶段 → 订单中心；券包明细 → 代金券页
// =====================================================

const MOCK = require('../../utils/mock-data');
const { VOUCHER_STATUS } = require('../../utils/constant');
const { buildOrderSummary, sortSummaries } = require('../../utils/order-summary');
const surveyService = require('../../utils/survey-service');
const config = require('../../utils/config');

function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

Page({
  data: {
    nickname: '体验用户',
    avatarUrl: '',
    initials: 'U',
    joinDate: '',
    // 摘要（仅入口数字，不重复做订单列表）
    ongoingCount: 0,
    voucherCount: 0,
    primaryTodo: '',
    // 问卷
    hasSurvey: false,
    couponCode: '',
    // 收货地址
    address: {
      name: '',
      phone: '',
      region: '',
      detail: '',
    },
    addressFilled: false,
    editingAddress: false,
    draftAddress: {
      name: '',
      phone: '',
      region: '',
      detail: '',
    },
    version: '2.1.0',
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  async refresh() {
    const user = (config.isMock ? MOCK.getUser() : wx.getStorageSync('user')) || {};
    const orders = config.isMock ? MOCK.getMyOrders() || [] : [];
    const vouchers = config.isMock ? MOCK.getMyVouchers() || [] : [];

    let survey = null;
    try {
      survey = await surveyService.getMySurvey();
    } catch (e) {
      console.warn('getMySurvey', e);
    }

    const summaries = sortSummaries(orders.map((o) => buildOrderSummary(o)).filter(Boolean));
    const ongoing = summaries.filter((o) => !o.isTerminal);
    const primary = summaries.find((o) => o.hasTodo || o.isUrgent) || ongoing[0];
    const activeVouchers = vouchers.filter((v) => v.status === VOUCHER_STATUS.ACTIVE);

    const nickname = user.nickname || '体验用户';
    const address = {
      name: user.shippingName || '',
      phone: user.shippingPhone || '',
      region: [user.shippingProvince, user.shippingCity, user.shippingDistrict]
        .filter(Boolean)
        .join(' '),
      detail: user.shippingAddress || '',
    };
    const addressFilled = !!(address.name && address.phone && address.detail);

    this.setData({
      nickname,
      avatarUrl: user.avatarUrl || '',
      initials: nickname.charAt(0).toUpperCase(),
      joinDate: formatDate(user.createdAt),
      ongoingCount: ongoing.length,
      voucherCount: activeVouchers.length,
      primaryTodo: primary
        ? primary.stageLabel + ' · ' + (primary.todoText || primary.statusText)
        : '',
      hasSurvey: !!survey,
      couponCode: (survey && survey.couponCode) || user.couponCode || '',
      address,
      addressFilled,
    });
  },

  onTapOrders() {
    wx.navigateTo({ url: '/subpackages/order-list/list' });
  },

  onTapVouchers() {
    wx.navigateTo({ url: '/subpackages/voucher/voucher' });
  },

  onTapSurvey() {
    if (this.data.hasSurvey) {
      wx.showModal({
        title: '问卷已提交',
        content: this.data.couponCode
          ? '专属优惠码：' + this.data.couponCode + '\n支付时可自动抵扣 ¥500。'
          : '您已完成问卷，首发代金券已生效。',
        showCancel: !!this.data.couponCode,
        cancelText: '关闭',
        confirmText: this.data.couponCode ? '复制优惠码' : '知道了',
        success: (res) => {
          if (res.confirm && this.data.couponCode) {
            wx.setClipboardData({ data: this.data.couponCode });
          }
        },
      });
      return;
    }
    wx.navigateTo({ url: '/pages/survey/survey' });
  },

  onCopyCoupon() {
    if (!this.data.couponCode) return;
    wx.setClipboardData({
      data: this.data.couponCode,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onEditProfile() {
    wx.showActionSheet({
      itemList: ['修改昵称', '更换头像'],
      success: (res) => {
        if (res.tapIndex === 0) this.editNickname();
        else if (res.tapIndex === 1) this.changeAvatar();
      },
    });
  },

  editNickname() {
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入新昵称',
      content: this.data.nickname,
      success: (res) => {
        if (res.confirm && res.content) {
          const nickname = res.content.trim();
          if (!nickname) return;
          MOCK.updateUser({ nickname });
          this.setData({
            nickname,
            initials: nickname.charAt(0).toUpperCase(),
          });
          wx.showToast({ title: '已更新', icon: 'success' });
        }
      },
    });
  },

  changeAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        MOCK.updateUser({ avatarUrl: tempPath });
        this.setData({ avatarUrl: tempPath });
        wx.showToast({ title: '已更换', icon: 'success' });
      },
    });
  },

  onEditAddress() {
    const a = this.data.address;
    this.setData({
      editingAddress: true,
      draftAddress: {
        name: a.name,
        phone: a.phone,
        region: a.region,
        detail: a.detail,
      },
    });
  },

  onAddressInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      ['draftAddress.' + field]: e.detail.value || '',
    });
  },

  onCancelAddress() {
    this.setData({ editingAddress: false });
  },

  onSaveAddress() {
    const d = this.data.draftAddress;
    const name = (d.name || '').trim();
    const phone = (d.phone || '').trim();
    const region = (d.region || '').trim();
    const detail = (d.detail || '').trim();

    if (!name || !phone || !detail) {
      wx.showToast({ title: '请填写姓名、手机和详细地址', icon: 'none' });
      return;
    }
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    // region 简单拆成省市区（空格分隔），不够精细但够预定场景
    const parts = region.split(/\s+/).filter(Boolean);
    MOCK.updateUser({
      shippingName: name,
      shippingPhone: phone,
      shippingProvince: parts[0] || region,
      shippingCity: parts[1] || '',
      shippingDistrict: parts[2] || '',
      shippingAddress: detail,
    });

    this.setData({
      editingAddress: false,
      address: { name, phone, region, detail },
      addressFilled: true,
    });
    wx.showToast({ title: '地址已保存', icon: 'success' });
  },

  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '客服热线：400-888-0000\n服务时间：9:00–21:00',
      showCancel: true,
      cancelText: '关闭',
      confirmText: '复制电话',
      success: (res) => {
        if (res.confirm) {
          wx.setClipboardData({ data: '4008880000' });
        }
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于 XOLOme X1',
      content:
        '版本 ' +
        this.data.version +
        '\n\n首发预定小程序。支付分三阶段：体验资格 ¥499 → 确认购买累计 ¥1,499 → 尾款 ¥3,000。',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});
