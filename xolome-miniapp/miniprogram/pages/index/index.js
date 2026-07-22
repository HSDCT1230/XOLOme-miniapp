// pages/index/index.js — 首页
const MOCK = require('../../utils/mock-data');
const config = require('../../utils/config');
const { buildOrderSummary } = require('../../utils/order-summary');

// 大图走 CDN，避免代码包体积与「单资源≤200K」质量扫描问题
const asset = (path) => `${config.ASSET_CDN}${path}`;

Page({
  data: {
    stockTotal: config.STOCK_TOTAL,
    stockRemaining: 0,
    stockPercent: 0,
    hasSurvey: false,
    myLatestOrder: null,
    heroBanners: [
      asset('/images/hero/hero-1.jpg'),
      asset('/images/hero/hero-2.jpg'),
      asset('/images/hero/hero.jpg'),
    ],
    heroIndex: 0,
    collabPosters: [
      asset('/images/collab/poster-1.jpg'),
    ],
    collabShowcases: [
      {
        id: 'panda',
        title: 'Panda 联名',
        partner: 'XOLO me × Panda',
        image: asset('/images/collab/showcase-panda.jpg'),
      },
      {
        id: 'mecha',
        title: '长安卫联名',
        partner: 'XOLO me × CHANG AN WEI',
        image: asset('/images/collab/showcase-mecha.jpg'),
      },
      {
        id: 'heart56',
        title: '民族娃娃',
        partner: 'XOLO me × 民族娃娃',
        image: asset('/images/collab/showcase-56.jpg'),
      },
    ],
    // 三大核心入口（按"内容→陪伴"逻辑排序）
    coreEntries: [
      {
        title: 'IP全息伙伴',
        desc: '喜欢的动漫、游戏、影视角色，以裸眼3D出现在桌面陪伴你',
        tag: '内容',
        image: asset('/images/feature/feature-1.jpg'),
      },
      {
        title: '全息相册',
        desc: '上传宠物、家人或朋友影像，AI 生成动画并投放全息仓',
        tag: '创造',
        image: asset('/images/feature/feature-2.jpg'),
      },
      {
        title: '游戏生态陪伴',
        desc: '游戏角色进入 XOLOme，随进度互动并给出情绪反馈',
        tag: '游戏',
        image: asset('/images/feature/feature-3.jpg'),
      },
    ],
  },

  onLoad() {
    this.refreshData();
  },

  onShow() {
    this.refreshData();
  },

  onHeroChange(e) {
    this.setData({ heroIndex: e.detail.current });
  },

  refreshData() {
    const remaining = MOCK.getStockRemaining();
    const percent = Math.round(((config.STOCK_TOTAL - remaining) / config.STOCK_TOTAL) * 100);

    const survey = MOCK.getMySurvey();
    const orders = MOCK.getMyOrders();
    const latest = orders.length > 0 ? orders[0] : null;
    let stageHint = '';
    if (latest) {
      const sum = buildOrderSummary(latest);
      stageHint = sum ? sum.statusText : latest.orderNo;
    }

    this.setData({
      stockRemaining: remaining,
      stockPercent: percent,
      hasSurvey: !!survey,
      myLatestOrder: latest
        ? {
            id: latest.id,
            orderNo: latest.orderNo,
            status: latest.status,
            stageHint,
          }
        : null,
    });
  },

  // 跳转问卷
  onTapSurvey() {
    wx.navigateTo({ url: '/pages/survey/survey' });
  },

  // DIY 全息体验（H5）
  onTapDiy() {
    const url = config.DIY_URL || 'https://api.xolome.com';
    const page =
      '/pages/webview/webview?url=' +
      encodeURIComponent(url) +
      '&title=' +
      encodeURIComponent('DIY 全息体验');

    wx.navigateTo({
      url: page,
      fail: () => {
        // 业务域名未配置时，复制链接引导用户浏览器打开
        wx.setClipboardData({
          data: url,
          success: () => {
            wx.showModal({
              title: '打开 DIY 体验',
              content:
                '链接已复制。请在微信小程序后台将 api.xolome.com 配为业务域名后，即可应用内直接打开；也可粘贴到浏览器访问。',
              confirmText: '知道了',
              showCancel: false,
            });
          },
        });
      },
    });
  },

  // 跳转预订单
  onTapPreorder() {
    wx.navigateTo({ url: '/pages/preorder/preorder' });
  },

  // 订单中心（交易）
  onTapOrderCenter() {
    wx.navigateTo({ url: '/subpackages/order-list/list' });
  },

  // 个人中心（账户）
  onTapUserCenter() {
    wx.navigateTo({ url: '/subpackages/user-center/center' });
  },
});
