// =====================================================
// subpackages/order-list/list.js — 订单中心（微信规范）
// =====================================================

const MOCK = require('../../utils/mock-data');
const {
  buildOrderSummary,
  sortSummaries,
  buildCenterOverview,
} = require('../../utils/order-summary');

const TABS = [
  { key: 'todo', label: '待处理' },
  { key: 'ongoing', label: '进行中' },
  { key: 'ended', label: '已结束' },
];

Page({
  data: {
    tabs: TABS,
    activeTab: 'todo',
    orders: [],
    displayOrders: [],
    loading: true,
    isEmpty: false,
    todoCount: 0,
    ongoingCount: 0,
    endedCount: 0,
    emptyTitle: '',
    emptyDesc: '',
    showEmptyCta: false,
  },

  _tabTouched: false,

  onLoad(options) {
    if (options && options.tab) {
      this._tabTouched = true;
      this.setData({ activeTab: options.tab });
    }
    this.refresh();
  },

  onShow() {
    this.refresh();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  noop() {},

  refresh() {
    const list = MOCK.getMyOrders() || [];
    const summaries = sortSummaries(list.map((o) => buildOrderSummary(o)).filter(Boolean));
    const overview = buildCenterOverview(summaries, 0);

    let activeTab = this.data.activeTab;
    if (!this._tabTouched) {
      if (overview.todoCount > 0) activeTab = 'todo';
      else if (overview.ongoingCount > 0) activeTab = 'ongoing';
      else activeTab = 'ended';
    }

    this.setData({
      orders: summaries,
      loading: false,
      todoCount: overview.todoCount,
      ongoingCount: overview.ongoingCount,
      endedCount: overview.endedCount,
      activeTab,
    });
    this.applyFilter();
  },

  onTabTap(e) {
    this._tabTouched = true;
    this.setData({ activeTab: e.currentTarget.dataset.key });
    this.applyFilter();
  },

  applyFilter() {
    const { orders, activeTab, ongoingCount, endedCount } = this.data;
    let display;
    if (activeTab === 'todo') {
      display = orders.filter((o) => o.hasTodo || o.isUrgent);
    } else if (activeTab === 'ongoing') {
      display = orders.filter((o) => !o.isTerminal);
    } else {
      display = orders.filter((o) => o.isTerminal);
    }

    const noOrders = ongoingCount === 0 && endedCount === 0;
    let emptyTitle = '暂无订单';
    let emptyDesc = '';
    if (activeTab === 'todo') {
      emptyTitle = '暂无待处理订单';
      emptyDesc = noOrders ? '预定后可在此跟进付款进度' : '当前没有需要处理的事项';
    } else if (activeTab === 'ongoing') {
      emptyTitle = '暂无进行中订单';
    } else {
      emptyTitle = '暂无已结束订单';
    }

    this.setData({
      displayOrders: display,
      isEmpty: display.length === 0,
      emptyTitle,
      emptyDesc,
      showEmptyCta: noOrders,
    });
  },

  onOrderTap(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id });
  },

  onActionTap(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    if (type === 'voucher') {
      wx.navigateTo({ url: '/subpackages/voucher/voucher' });
      return;
    }
    if (type === 'final') {
      wx.navigateTo({ url: '/subpackages/final-payment/payment?id=' + id });
      return;
    }
    if (type === 'refund') {
      wx.navigateTo({ url: '/subpackages/refund/refund?id=' + id });
      return;
    }
    wx.navigateTo({ url: '/pages/order-detail/order-detail?id=' + id });
  },

  onCopyOrderNo(e) {
    wx.setClipboardData({
      data: e.currentTarget.dataset.no,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onTapPreorder() {
    wx.navigateTo({ url: '/pages/preorder/preorder' });
  },
});
