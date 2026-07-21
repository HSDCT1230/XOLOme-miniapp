// =====================================================
// pages/survey/survey.js — 问卷页
// =====================================================

const MOCK = require('../../utils/mock-data');
const nav = require('../../utils/nav');

const CACHE_KEY = '_xolome_survey_draft';

// 问卷题目定义（V2.1：按"内容→陪伴"逻辑排序，新增第一眼认知题目）
const QUESTIONS = [
  {
    id: 1,
    title: '您的年龄',
    type: 'radio',
    required: true,
    options: [
      { value: '18-25', label: '18-25岁' },
      { value: '26-35', label: '26-35岁' },
      { value: '36-45', label: '36-45岁' },
      { value: '46+', label: '46岁以上' },
    ],
  },
  {
    id: 2,
    title: '主要桌面使用场景(可多选)',
    type: 'checkbox',
    required: true,
    options: [
      { value: 'work', label: '工作学习' },
      { value: 'game', label: '游戏娱乐' },
      { value: 'video', label: '追剧影音' },
      { value: 'collection', label: '潮玩收藏' },
      { value: 'design', label: '创作设计' },
    ],
  },
  {
    id: 3,
    title: '哪些功能最吸引您(可多选)',
    type: 'checkbox',
    required: true,
    options: [
      { value: 'ip_partner', label: 'IP全息伙伴:喜欢的动漫游戏角色裸眼3D陪伴桌面' },
      { value: 'hologram_album', label: '全息相册:上传照片视频生成专属互动陪伴伙伴' },
      { value: 'game_companion', label: '游戏陪伴:游戏角色进入XOLOme互动反馈' },
      { value: 'ai_assistant', label: 'AI私人伙伴:聊天提醒查询桌面AI助手' },
      { value: 'hologram_entertainment', label: '全息娱乐:音乐视频短视频全息呈现' },
    ],
  },
  {
    id: 4,
    title: '哪种体验最让您产生购买兴趣(可多选)',
    type: 'checkbox',
    required: true,
    options: [
      { value: 'ip_ai', label: '喜欢的IP角色成为AI伙伴' },
      { value: 'pet_family', label: '宠物/家人变成全息陪伴' },
      { value: 'game_companion', label: '游戏角色陪伴我的游戏' },
      { value: 'life_assistant', label: '懂我的AI生活办公助手' },
    ],
  },
  {
    id: 5,
    title: '角色切换系统兴趣',
    type: 'radio',
    required: true,
    options: [
      { value: 'very_excited', label: '非常期待' },
      { value: 'consider', label: '喜欢特定IP会考虑' },
      { value: 'normal', label: '普通' },
      { value: 'not_interested', label: '不感兴趣' },
    ],
  },
  {
    id: 6,
    title: '是否参与首发体验',
    type: 'radio',
    required: true,
    options: [
      { value: 'pay_499', label: '愿意支付499元锁定首发体验资格' },
      { value: 'learn_more', label: '有兴趣了解更多' },
      { value: 'wait_release', label: '等正式上市' },
      { value: 'not_now', label: '暂不考虑' },
    ],
  },
  {
    id: 7,
    title: '期望增加的内容',
    type: 'text',
    required: false,
    placeholder: '请输入您希望XOLOme X1增加的功能或内容...',
  },
  {
    id: 8,
    title: '最期待的IP/内容',
    type: 'text',
    required: false,
    placeholder: '如:原神、初音未来、漫威、自家宠物等...',
  },
  {
    id: 9,
    title: '姓名',
    type: 'text',
    required: true,
    placeholder: '请输入您的姓名',
  },
  {
    id: 10,
    title: '联系方式',
    type: 'text',
    required: true,
    placeholder: '请输入手机号或微信号',
  },
  {
    id: 11,
    title: '您第一次看到XOLOme X1时,觉得它更像什么?',
    type: 'radio',
    required: true,
    // 这是市场分析核心问题,数据用于融资BP和产品迭代
    options: [
      { value: 'ai_device', label: 'AI智能设备' },
      { value: 'hologram_player', label: '全息播放器' },
      { value: 'ip_collectible', label: 'IP潮玩摆件' },
      { value: 'desktop_companion', label: '桌面陪伴伙伴' },
      { value: 'game_device', label: '游戏互动设备' },
      { value: 'other', label: '其他' },
    ],
  },
];

Page({
  data: {
    questions: QUESTIONS,
    totalSteps: 0,
    currentStep: 0,        // 从0开始
    answers: {},
    currentQuestion: null,
    nextQuestion: null,
    isLastStep: false,
    isFirstStep: true,
    progressPercent: 0,
    submitting: false,
  },

  onLoad() {
    // 分页:每页1-2题,文本输入单独一页
    const pages = this.buildPages(QUESTIONS);
    const cached = wx.getStorageSync(CACHE_KEY) || {};

    this.setData({
      pages,
      totalSteps: pages.length,
      answers: cached,
      currentStep: 0,
    });
    this.updateCurrentView();
  },

  // 构建分页:radio/checkbox单题一页,text两题一页
  buildPages(questions) {
    const pages = [];
    let i = 0;
    while (i < questions.length) {
      const q = questions[i];
      if (q.type === 'text') {
        // 文本题两两合并
        const next = questions[i + 1];
        if (next && next.type === 'text') {
          pages.push([q, next]);
          i += 2;
        } else {
          pages.push([q]);
          i += 1;
        }
      } else {
        pages.push([q]);
        i += 1;
      }
    }
    return pages;
  },

  updateCurrentView() {
    const { pages, currentStep, answers } = this.data;
    const pageQuestions = pages[currentStep] || [];
    const progressPercent = Math.round(((currentStep + 1) / pages.length) * 100);

    this.setData({
      currentQuestion: pageQuestions[0] || null,
      nextQuestion: pageQuestions[1] || null,
      isLastStep: currentStep === pages.length - 1,
      isFirstStep: currentStep === 0,
      progressPercent,
    });
  },

  // 单选
  onRadioChange(e) {
    const questionId = e.currentTarget.dataset.qid;
    const value = e.detail.value;
    const answers = { ...this.data.answers, [questionId]: value };
    this.setData({ answers });
    this.autoSave(answers);
  },

  // 多选
  onCheckboxChange(e) {
    const questionId = e.currentTarget.dataset.qid;
    const values = e.detail.value;
    const answers = { ...this.data.answers, [questionId]: values };
    this.setData({ answers });
    this.autoSave(answers);
  },

  // 文本输入
  onTextInput(e) {
    const questionId = e.currentTarget.dataset.qid;
    const value = e.detail.value;
    const answers = { ...this.data.answers, [questionId]: value };
    this.setData({ answers });
    this.autoSave(answers);
  },

  // 自动保存到本地缓存
  autoSave(answers) {
    wx.setStorageSync(CACHE_KEY, answers);
  },

  // 上一题
  onPrev() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 });
      this.updateCurrentView();
    }
  },

  // 下一题
  onNext() {
    if (!this.validateCurrentPage()) return;
    if (this.data.currentStep < this.data.totalSteps - 1) {
      this.setData({ currentStep: this.data.currentStep + 1 });
      this.updateCurrentView();
    }
  },

  // 校验当前页
  validateCurrentPage() {
    const { pages, currentStep, answers } = this.data;
    const pageQuestions = pages[currentStep] || [];
    for (const q of pageQuestions) {
      if (!q.required) continue;
      const ans = answers[q.id];
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          wx.showToast({ title: '请至少选择一项', icon: 'none' });
          return false;
        }
      } else if (!ans || ans === '') {
        wx.showToast({ title: '请完成此题', icon: 'none' });
        return false;
      }
    }
    return true;
  },

  // 提交问卷
  onSubmit() {
    if (this.data.submitting) return;

    // 校验所有必答题
    for (const q of QUESTIONS) {
      if (!q.required) continue;
      const ans = this.data.answers[q.id];
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          wx.showToast({ title: '请完成第' + q.id + '题', icon: 'none' });
          return;
        }
      } else if (!ans || ans === '') {
        wx.showToast({ title: '请完成第' + q.id + '题', icon: 'none' });
        return;
      }
    }

    this.setData({ submitting: true });

    wx.showLoading({ title: '提交中...' });

    try {
      const result = MOCK.submitSurvey(this.data.answers);

      // 清除草稿
      wx.removeStorageSync(CACHE_KEY);

      wx.hideLoading();

      wx.showModal({
        title: '恭喜获得首发体验资格!',
        content: '感谢您的参与!\n\n您的专属优惠码:' + result.couponCode + '\n\n已发放¥500首发代金券,可在支付时自动抵扣。\n\n实际支付价格:¥4,499(原价¥4,999)',
        showCancel: true,
        confirmText: '立即体验',
        cancelText: '返回首页',
        success: (res) => {
          if (res.confirm) {
            wx.redirectTo({
              url: '/pages/preorder/preorder?couponCode=' + result.couponCode,
            });
          } else {
            nav.goHome();
          }
        },
      });
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '提交失败:' + err.message, icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
