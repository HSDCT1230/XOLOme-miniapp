// =====================================================
// pages/survey/survey.js — 问卷页
// =====================================================

const nav = require('../../utils/nav');
const surveyService = require('../../utils/survey-service');
const config = require('../../utils/config');

const CACHE_KEY = '_xolome_survey_draft_v21';

// 切换「最想先试」时清掉非当前分支作答
const BRANCH_ANSWER_KEYS = {
  ip_partner: ['11', '11a', '11b', '11c', '11d'],
  hologram_album: ['11ha', '11hb'],
  game_companion: ['11gc', '11gb'],
  ai_assistant: ['11ai', '11ab'],
  hologram_entertainment: ['11he', '11hb2'],
};
const ALL_BRANCH_KEYS = Array.from(
  new Set(
    Object.keys(BRANCH_ANSWER_KEYS).reduce(
      (acc, k) => acc.concat(BRANCH_ANSWER_KEYS[k]),
      []
    )
  )
);

// 序号按答题顺序：1…10 → 11 分支槽 → 12…19
const QUESTIONS = [
  {
    id: '1',
    title: '你的年龄',
    type: 'radio',
    required: true,
    options: [
      { value: 'under_18', label: '18 岁以下' },
      { value: '18-25', label: '18–25 岁' },
      { value: '26-35', label: '26–35 岁' },
      { value: '36-45', label: '36–45 岁' },
      { value: '46+', label: '46 岁及以上' },
    ],
  },
  {
    id: '2',
    title: '你的性别',
    type: 'radio',
    required: true,
    options: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' },
      { value: 'prefer_not', label: '不便透露' },
    ],
  },
  {
    id: '3',
    title: '你每月可支配的数码/兴趣消费预算大约是？',
    type: 'radio',
    required: true,
    hint: '含潮玩、桌面设备、数码配件等，选大概档即可（区间含下限、不含上限）',
    options: [
      { value: 'under_2000', label: '不到 ¥2,000' },
      { value: '2000_5000', label: '¥2,000 – 5,000' },
      { value: 'over_5000', label: '¥5,000 及以上' },
      { value: 'unsure', label: '暂时不好说' },
    ],
  },
  {
    id: '4',
    title: '你是否购买过潮玩或桌面智能设备？',
    type: 'radio',
    required: true,
    hint: '潮玩如手办/盲盒；桌面智能如音箱、桌面机器人、智能摆件等',
    options: [
      { value: 'trendy_only', label: '只买过潮玩 / 手办' },
      { value: 'smart_only', label: '只买过桌面智能设备' },
      { value: 'both', label: '两种都买过' },
      { value: 'neither', label: '都没买过' },
    ],
  },
  {
    id: '5',
    title: '第一次看到 XOLOme X1 时，你觉得它更像什么？',
    type: 'radio',
    required: true,
    options: [
      { value: 'ai_device', label: 'AI 智能设备' },
      { value: 'hologram_player', label: '全息播放器' },
      { value: 'ip_collectible', label: 'IP 潮玩摆件' },
      { value: 'desktop_companion', label: '桌面陪伴伙伴' },
      { value: 'game_device', label: '游戏互动设备' },
      { value: 'other', label: '其他 / 说不清' },
    ],
  },
  {
    id: '5a',
    title: '可以简单描述一下你的感觉吗？',
    type: 'text',
    required: false,
    hint: '选填。用一句话写出第一印象即可',
    placeholder: '例：更像会动的潮玩 / 像桌面上的小伙伴 / 有点科幻说不清…',
    showIf: { qid: '5', values: ['other'] },
  },
  {
    id: '6',
    title: '你更常把这类产品跟什么比较？',
    type: 'radio',
    required: true,
    options: [
      { value: 'figure', label: '潮玩 / 手办 / 摆件' },
      { value: 'smart_speaker', label: '智能音箱 / 桌面机器人' },
      { value: 'monitor_gear', label: '显示器周边 / 桌搭配件' },
      { value: 'game_hw', label: '游戏设备 / 掌机周边' },
      { value: 'unclear', label: '说不清，更像新品类' },
    ],
  },
  {
    id: '7',
    title: '你日常的桌面使用场景是？（可多选）',
    type: 'checkbox',
    required: true,
    options: [
      { value: 'work', label: '工作学习' },
      { value: 'game', label: '游戏娱乐' },
      { value: 'video', label: '追剧影音' },
      { value: 'collection', label: '潮玩收藏' },
      { value: 'design', label: '创作设计' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    id: '8',
    title: '你平均每天在桌前大约多久？',
    type: 'radio',
    required: true,
    options: [
      { value: 'under_2h', label: '不到 2 小时' },
      { value: '2_4h', label: '2–4 小时' },
      { value: '4_8h', label: '4–8 小时' },
      { value: 'over_8h', label: '8 小时及以上' },
    ],
  },
  {
    id: '9',
    title: '当前 XOLOme 哪些功能最吸引你？（可多选）',
    type: 'checkbox',
    required: true,
    hint: '建议选最在意的 1–3 项；若都不太吸引，可选最后一项（与其他选项互斥）',
    options: [
      { value: 'ip_partner', label: 'IP 全息伙伴：角色裸眼 3D 桌面陪伴' },
      { value: 'hologram_album', label: '全息相册：照片/视频生成专属伙伴' },
      { value: 'game_companion', label: '游戏陪伴：游戏角色进设备互动' },
      { value: 'ai_assistant', label: 'AI 私人伙伴：聊天、提醒、查询' },
      { value: 'hologram_entertainment', label: '全息娱乐：音乐/视频全息呈现' },
      { value: 'none_attractive', label: '暂时都不太吸引' },
    ],
  },
  {
    id: '10',
    title: '如果只能先体验一个，你最想先试哪个？',
    type: 'radio',
    required: true,
    hint: '若暂时不想先试某一项，可选最后一项',
    showIf: {
      qid: '9',
      values: [
        'ip_partner',
        'hologram_album',
        'game_companion',
        'ai_assistant',
        'hologram_entertainment',
      ],
    },
    options: [
      { value: 'ip_partner', label: 'IP 全息伙伴' },
      { value: 'hologram_album', label: '全息相册' },
      { value: 'game_companion', label: '游戏陪伴' },
      { value: 'ai_assistant', label: 'AI 私人伙伴' },
      { value: 'hologram_entertainment', label: '全息娱乐' },
      { value: 'none_first', label: '都不想先试 / 先整体了解再说' },
    ],
  },
  // —— 第 11 题槽：由第 10 题决定；角标统一 11 / 11a… ——
  {
    id: '11',
    badge: '11',
    title: '如果主机支持换 IP 角色，并持续上新内容，你的兴趣程度是？',
    type: 'radio',
    required: true,
    hint: '指角色切换与持续上新；外壳 / 数字内容偏好见后续追问',
    showIf: { qid: '10', values: ['ip_partner'] },
    options: [
      { value: 'very_interested', label: '很感兴趣，会持续关注' },
      { value: 'interested', label: '有兴趣，看具体 IP 和价格' },
      { value: 'maybe', label: '一般，可以再了解' },
      { value: 'not_interested', label: '不太感兴趣' },
    ],
  },
  {
    id: '11a',
    badge: '11a',
    title: '换 IP 时你更看重外壳还是数字内容？',
    type: 'radio',
    required: false,
    hint: '选填，可直接点下一题跳过',
    showIf: [
      { qid: '10', values: ['ip_partner'] },
      { qid: '11', values: ['very_interested', 'interested'] },
    ],
    options: [
      { value: 'shell', label: '更看重外壳外观 / 收藏感' },
      { value: 'digital', label: '更看重数字内容（数字人、舞蹈等）' },
      { value: 'both', label: '两者都重要' },
    ],
  },
  {
    id: '11b',
    badge: '11b',
    title: '若单独购买外壳或数字内容包，你更能接受的单次花费是？',
    type: 'radio',
    required: false,
    hint: '选填。指单套外壳或单份数字内容包，不是整机',
    showIf: [
      { qid: '10', values: ['ip_partner'] },
      { qid: '11', values: ['very_interested', 'interested'] },
    ],
    options: [
      { value: 'under_100', label: '不到 ¥100' },
      { value: '100_300', label: '¥100 – 300' },
      { value: 'over_300', label: '¥300 及以上' },
      { value: 'bundle_only', label: '更希望和主机打包，不单独买' },
      { value: 'unsure', label: '暂时不好说' },
    ],
  },
  {
    id: '11c',
    badge: '11c',
    title: '你最想要的 IP / 角色是？',
    type: 'text',
    required: true,
    hint: '可写 1–3 个名称；没有特别想要的可写「暂无」',
    placeholder: '例：原神·雷电将军、初音未来；或写：暂无',
    showIf: [
      { qid: '10', values: ['ip_partner'] },
      { qid: '11', values: ['very_interested', 'interested'] },
    ],
  },
  {
    id: '11d',
    badge: '11d',
    title: '若推出该 IP 的限定外壳，你是否愿意额外加价？',
    type: 'radio',
    required: true,
    hint: '相对标准版主机外壳；若上题写了「暂无」，按你整体态度选即可',
    showIf: [
      { qid: '10', values: ['ip_partner'] },
      { qid: '11', values: ['very_interested', 'interested'] },
    ],
    options: [
      { value: 'yes_much', label: '愿意，限定外观值得加价' },
      { value: 'yes_little', label: '可以加一点，别太高' },
      { value: 'depends', label: '看具体 IP 与设计再决定' },
      { value: 'no', label: '不愿意，标准版就够' },
      { value: 'digital_only', label: '更在意数字内容，外壳无所谓' },
    ],
  },
  {
    id: '11ha',
    badge: '11',
    title: '你更想用全息相册做什么？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['hologram_album'] },
    options: [
      { value: 'family', label: '把家人/恋人做成桌面伙伴' },
      { value: 'self_pet', label: '把自己/宠物做成伙伴' },
      { value: 'moment', label: '收藏旅行/活动瞬间' },
      { value: 'unsure', label: '还没想好，先看效果' },
    ],
  },
  {
    id: '11hb',
    badge: '11a',
    title: '对「上传照片/视频生成伙伴」，你最在意？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['hologram_album'] },
    options: [
      { value: 'likeness', label: '像不像、好不好看' },
      { value: 'interact', label: '能不能互动聊天' },
      { value: 'privacy', label: '隐私安不安全' },
      { value: 'ease', label: '操作简不简单' },
    ],
  },
  {
    id: '11ai',
    badge: '11',
    title: '你最希望 AI 伙伴帮你做什么？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['ai_assistant'] },
    options: [
      { value: 'chat', label: '陪聊解闷' },
      { value: 'remind', label: '日程提醒 / 待办' },
      { value: 'qa', label: '查资料、答问题' },
      { value: 'mix', label: '以上都想要一点' },
    ],
  },
  {
    id: '11ab',
    badge: '11a',
    title: '你更能接受它怎样「开口」？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['ai_assistant'] },
    options: [
      { value: 'passive', label: '我问它才说' },
      { value: 'gentle', label: '适度主动提醒' },
      { value: 'active', label: '可以更主动陪伴' },
      { value: 'unsure', label: '不确定，看体验' },
    ],
  },
  {
    id: '11gc',
    badge: '11',
    title: '你更期待和什么游戏场景联动？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['game_companion'] },
    options: [
      { value: 'pc_console', label: '正在玩的 PC/主机游戏' },
      { value: 'mobile', label: '手机游戏' },
      { value: 'no_bind', label: '不绑具体游戏，角色能互动就行' },
      { value: 'unsure', label: '还不确定' },
    ],
  },
  {
    id: '11gb',
    badge: '11a',
    title: '游戏陪伴里你最看重？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['game_companion'] },
    options: [
      { value: 'look', label: '角色外观/出场效果' },
      { value: 'realtime', label: '对战或通关时的实时反馈' },
      { value: 'voice', label: '语音/表情互动' },
      { value: 'stable', label: '先能稳定连上再说' },
    ],
  },
  {
    id: '11he',
    badge: '11',
    title: '你最想用全息看什么？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['hologram_entertainment'] },
    options: [
      { value: 'music', label: '音乐 / 演唱会感' },
      { value: 'short', label: '短视频 / 二创' },
      { value: 'film', label: '影视片段' },
      { value: 'any', label: '都可以，看内容质量' },
    ],
  },
  {
    id: '11hb2',
    badge: '11a',
    title: '全息娱乐你更能接受怎样获取内容？',
    type: 'radio',
    required: true,
    showIf: { qid: '10', values: ['hologram_entertainment'] },
    options: [
      { value: 'builtin', label: '设备内置/官方更新' },
      { value: 'local', label: '自己导入本地文件' },
      { value: 'paid', label: '订阅或单次付费买内容包' },
      { value: 'unsure', label: '还没想好' },
    ],
  },
  {
    id: '12',
    title: '你觉得XOLOme X1主要放在哪里使用最合适？',
    type: 'radio',
    required: true,
    hint: '选一个最合适的摆放/使用位置（家庭或工位均可）',
    options: [
      { value: 'home_bedside', label: '卧室床头 / 床边休闲桌' },
      { value: 'home_living', label: '客厅茶几 / 共享空间' },
      { value: 'home_display', label: '潮玩收藏柜 / 展示位' },
      { value: 'home_study_casual', label: '家里书房的休闲一角（非主力工位）' },
      { value: 'desk_office', label: '公司 / 正式办公桌' },
      { value: 'desk_wfh', label: '居家办公 / 学习主桌' },
      { value: 'desk_game', label: '电竞 / 游戏主机位' },
      { value: 'desk_create', label: '创作设计桌（绘板、剪辑等）' },
      { value: 'unsure', label: '想用，但暂时无法确定' },
      { value: 'not_want', label: '我根本不想用它' },
    ],
  },
  {
    id: '13',
    title: '按你现在了解到的信息，哪个整机价位会让你更愿意认真考虑？',
    type: 'radio',
    required: true,
    hint: '指整机心理价，不含后续周边；区间含下限、不含上限',
    options: [
      { value: 'under_3000', label: '不到 ¥3,000' },
      { value: '3000_5000', label: '¥3,000 – 5,000' },
      { value: '5000_8000', label: '¥5,000 – 8,000' },
      { value: 'over_8000', label: '¥8,000 及以上' },
      { value: 'unsure', label: '暂时不好说' },
      { value: 'not_consider', label: '再便宜目前也不会考虑' },
    ],
  },
  {
    id: '14',
    title:
      '目前可用 ¥499 锁定首发体验资格（约 60 天可退，不是整机全款）。你更倾向？',
    type: 'radio',
    required: true,
    hint: '¥499 为定金/体验资格；整机另计。只了解意向，选「先多了解」或「以后再说」完全没问题',
    options: [
      { value: 'pay_499', label: '想先锁定体验资格' },
      { value: 'learn_more', label: '有兴趣，想先多了解再决定' },
      { value: 'wait_release', label: '等正式上市再说' },
      { value: 'not_now', label: '现阶段不太适合我' },
    ],
  },
  {
    id: '14a',
    title: '若你还在观望，主要卡在哪里？（可多选）',
    type: 'checkbox',
    required: false,
    hint: '选填，帮助我们改进',
    showIf: { qid: '14', values: ['learn_more', 'wait_release', 'not_now'] },
    options: [
      { value: 'price', label: '价格还需要再斟酌' },
      { value: 'content', label: '内容 / IP 生态不够确定' },
      { value: 'size_look', label: '外观或尺寸不确定是否合适' },
      { value: 'no_need_scene', label: '暂时想不到刚需场景' },
      { value: 'want_reviews', label: '不确定好不好用，想先看真人评测' },
      { value: 'brand_trust', label: '品牌 / 售后还不熟，再观望' },
      { value: 'compare_alt', label: '还在对比其他品类 / 产品' },
      { value: 'timing', label: '现在时机不对' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    id: '14b',
    title: '可以简单说一下「其他」方面的顾虑吗？',
    type: 'text',
    required: false,
    hint: '选填',
    placeholder: '例：担心售后、想等更多评测、预算安排等',
    showIf: [
      { qid: '14', values: ['learn_more', 'wait_release', 'not_now'] },
      { qid: '14a', values: ['other'] },
    ],
  },
  {
    id: '15',
    title: '按你现在的判断，如果考虑入手，你大概会在什么时候？',
    type: 'radio',
    required: true,
    hint: '按当前了解选即可；还不确定也可以如实选',
    options: [
      { value: 'asap', label: '尽快，想第一批体验' },
      { value: '1_3m', label: '1–3 个月内' },
      { value: '3_6m', label: '3–6 个月内' },
      { value: 'after_reviews', label: '等评价和实测出来再说' },
      { value: 'uncertain', label: '还不确定' },
    ],
  },
  {
    id: '16',
    title: '其他建议（选填）',
    type: 'text',
    required: false,
    hint: '欢迎写玩法、外观、内容或联名想法；有具体例子最有用',
    placeholder:
      '玩法建议：互动剧情、自定义动作、多角色对话等；也可写外观、内容生态、价格方面的想法…',
  },
  {
    id: '17',
    title: '你是从哪里了解到 XOLOme 的？（可多选）',
    type: 'checkbox',
    required: true,
    options: [
      { value: 'offline', label: '展会 / 线下活动' },
      { value: 'wechat', label: '微信（好友 / 群 / 公众号 / 视频号 / 小程序）' },
      { value: 'douyin', label: '抖音' },
      { value: 'bilibili', label: 'B站' },
      { value: 'xiaohongshu', label: '小红书' },
      { value: 'friend', label: '熟人当面推荐' },
      { value: 'search', label: '自己搜索了解到' },
      { value: 'other', label: '其他' },
    ],
  },
  {
    id: '18',
    title: '怎么称呼你（选填）',
    type: 'text',
    required: false,
    placeholder: '姓名或昵称',
  },
  {
    id: '19',
    title: '方便联系的方式（选填）',
    type: 'text',
    required: false,
    placeholder: '手机号或微信号，仅用于发券与活动通知',
  },
];

Page({
  data: {
    questions: QUESTIONS,
    totalSteps: 0,
    currentStep: 0,
    answers: {},
    currentQuestion: null,
    nextQuestion: null,
    isLastStep: false,
    isFirstStep: true,
    progressPercent: 0,
    submitting: false,
  },

  onLoad() {
    const cached = this.normalizeAnswerKeys(wx.getStorageSync(CACHE_KEY) || {});
    this.setData({ answers: cached, currentStep: 0 });
    this.refreshPages({ keepStep: false });
  },

  normalizeAnswerKeys(raw) {
    const out = {};
    Object.keys(raw || {}).forEach((k) => {
      out[String(k)] = raw[k];
    });
    return out;
  },

  answerOf(answers, qid) {
    const key = String(qid);
    if (answers[key] !== undefined) return answers[key];
    return undefined;
  },

  isQuestionVisible(q, answers) {
    if (!q.showIf) return true;
    const rules = Array.isArray(q.showIf) ? q.showIf : [q.showIf];
    return rules.every((rule) => {
      const ans = this.answerOf(answers, rule.qid);
      // 多选答案：任一命中 rule.values 即显示（如 14a 含 other → 14b）
      if (Array.isArray(ans)) {
        return rule.values.some((v) => ans.indexOf(v) !== -1);
      }
      return rule.values.indexOf(ans) !== -1;
    });
  },

  getVisibleQuestions(answers) {
    return QUESTIONS.filter((q) => this.isQuestionVisible(q, answers || this.data.answers));
  },

  buildPages(questions) {
    const pages = [];
    let i = 0;
    while (i < questions.length) {
      const q = questions[i];
      if (q.type === 'text') {
        const next = questions[i + 1];
        if (next && next.type === 'text' && !next.showIf && !q.showIf) {
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

  refreshPages({ keepStep = true, stayOnQid = null, answers = null } = {}) {
    const ans = answers || this.data.answers;
    const pages = this.buildPages(this.getVisibleQuestions(ans));
    let currentStep = this.data.currentStep || 0;

    if (stayOnQid) {
      const idx = pages.findIndex((page) =>
        page.some((q) => String(q.id) === String(stayOnQid))
      );
      if (idx >= 0) currentStep = idx;
    } else if (!keepStep) {
      currentStep = 0;
    }

    if (currentStep > pages.length - 1) currentStep = Math.max(0, pages.length - 1);

    this.setData({
      pages,
      totalSteps: pages.length,
      currentStep,
    });
    this.updateCurrentView();
  },

  clearInactiveBranchAnswers(answers, activeBranch) {
    const keep = new Set(BRANCH_ANSWER_KEYS[activeBranch] || []);
    ALL_BRANCH_KEYS.forEach((key) => {
      if (!keep.has(key)) delete answers[key];
    });
    return answers;
  },

  applyRadioAnswer(qid, value) {
    const key = String(qid);
    let answers = { ...this.data.answers, [key]: value };

    if (key === '5' && value !== 'other') delete answers['5a'];
    // IP 兴趣未达门槛时清掉追问（含已移除的 11e，兼容旧草稿）
    if (key === '11' && ['very_interested', 'interested'].indexOf(value) === -1) {
      delete answers['11a'];
      delete answers['11b'];
      delete answers['11c'];
      delete answers['11d'];
      delete answers['11e'];
    }
    if (key === '14' && value === 'pay_499') {
      delete answers['14a'];
      delete answers['14b'];
    }
    if (key === '10') {
      // none_first 不在 BRANCH_ANSWER_KEYS → 清掉全部 11 分支
      answers = this.clearInactiveBranchAnswers(answers, value);
    }

    this.setData({ answers });
    this.autoSave(answers);

    // 必须用最新 answers 重建（setData 异步，不能依赖 this.data.answers）
    if (key === '5' || key === '10' || key === '11' || key === '14') {
      this.refreshPages({ keepStep: true, stayOnQid: key, answers });
    }
  },

  getSubmitAnswers() {
    // 提交前再清一遍：非当前分支、已隐藏的追问，避免草稿残留进库
    let answers = { ...this.data.answers };
    const q9 = this.answerOf(answers, '9');
    const noneAttractive =
      Array.isArray(q9) && q9.length === 1 && q9[0] === 'none_attractive';
    if (noneAttractive) {
      delete answers['10'];
      ALL_BRANCH_KEYS.forEach((k) => delete answers[k]);
    } else {
      const topFeature = this.answerOf(answers, '10');
      answers = this.clearInactiveBranchAnswers(answers, topFeature);
    }
    if (this.answerOf(answers, '5') !== 'other') delete answers['5a'];
    if (['very_interested', 'interested'].indexOf(this.answerOf(answers, '11')) === -1) {
      delete answers['11a'];
      delete answers['11b'];
      delete answers['11c'];
      delete answers['11d'];
      delete answers['11e'];
    }
    if (this.answerOf(answers, '14') === 'pay_499') {
      delete answers['14a'];
      delete answers['14b'];
    }
    const barriers = this.answerOf(answers, '14a');
    if (!Array.isArray(barriers) || barriers.indexOf('other') === -1) {
      delete answers['14b'];
    }

    const visibleIds = new Set(this.getVisibleQuestions(answers).map((q) => String(q.id)));
    const out = {};
    Object.keys(answers).forEach((k) => {
      if (visibleIds.has(String(k))) out[k] = answers[k];
    });
    return out;
  },

  updateCurrentView() {
    const { pages, currentStep } = this.data;
    const pageQuestions = pages[currentStep] || [];
    const progressPercent = pages.length
      ? Math.round(((currentStep + 1) / pages.length) * 100)
      : 0;

    this.setData({
      currentQuestion: pageQuestions[0] || null,
      nextQuestion: pageQuestions[1] || null,
      isLastStep: currentStep === pages.length - 1,
      isFirstStep: currentStep === 0,
      progressPercent,
    });
  },

  applyCheckboxToggle(qid, value) {
    const key = String(qid);
    let prev = Array.isArray(this.data.answers[key]) ? this.data.answers[key].slice() : [];
    const NONE_ATTRACTIVE = 'none_attractive';

    if (key === '9') {
      // 「暂时都不太吸引」与其他兴趣互斥
      const idx = prev.indexOf(value);
      if (value === NONE_ATTRACTIVE) {
        prev = idx > -1 ? [] : [NONE_ATTRACTIVE];
      } else if (idx > -1) {
        prev.splice(idx, 1);
      } else {
        prev = prev.filter((v) => v !== NONE_ATTRACTIVE);
        prev.push(value);
      }
    } else {
      const idx = prev.indexOf(value);
      if (idx > -1) prev.splice(idx, 1);
      else prev.push(value);
    }

    const answers = { ...this.data.answers, [key]: prev };
    if (key === '14a' && prev.indexOf('other') === -1) delete answers['14b'];

    // Q9 选「暂时都不太吸引」：隐藏 Q10 与全部 11 分支，并清掉作答
    if (key === '9') {
      const onlyNone =
        prev.length === 1 && prev[0] === NONE_ATTRACTIVE;
      if (onlyNone || prev.indexOf(NONE_ATTRACTIVE) !== -1) {
        delete answers['10'];
        ALL_BRANCH_KEYS.forEach((k) => delete answers[k]);
      }
    }

    this.setData({ answers });
    this.autoSave(answers);

    if (key === '9' || key === '14a') {
      this.refreshPages({ keepStep: true, stayOnQid: key, answers });
    }
  },

  onTapOption(e) {
    const qid = e.currentTarget.dataset.qid;
    const value = e.currentTarget.dataset.value;
    const type = e.currentTarget.dataset.type;
    if (!qid || value === undefined || value === null || value === '') return;
    if (type === 'checkbox') this.applyCheckboxToggle(qid, value);
    else this.applyRadioAnswer(qid, value);
  },

  onTextInput(e) {
    const qid = String(e.currentTarget.dataset.qid);
    const answers = { ...this.data.answers, [qid]: e.detail.value };
    this.setData({ answers });
    this.autoSave(answers);
  },

  autoSave(answers) {
    wx.setStorageSync(CACHE_KEY, answers);
  },

  onPrev() {
    if (this.data.isFirstStep) return;
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 });
      this.updateCurrentView();
    }
  },

  onNext() {
    if (!this.validateCurrentPage()) return;
    if (this.data.currentStep < this.data.totalSteps - 1) {
      this.setData({ currentStep: this.data.currentStep + 1 });
      this.updateCurrentView();
    }
  },

  validateCurrentPage() {
    const { pages, currentStep, answers } = this.data;
    const pageQuestions = pages[currentStep] || [];
    for (const q of pageQuestions) {
      if (!q.required) continue;
      const ans = this.answerOf(answers, q.id);
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          wx.showToast({ title: '请至少选择一项', icon: 'none' });
          return false;
        }
      } else if (!ans || String(ans).trim() === '') {
        wx.showToast({ title: '请完成此题', icon: 'none' });
        return false;
      }
    }
    return true;
  },

  async onSubmit() {
    if (this.data.submitting) return;

    const visible = this.getVisibleQuestions();
    for (const q of visible) {
      if (!q.required) continue;
      const ans = this.answerOf(this.data.answers, q.id);
      if (q.type === 'checkbox') {
        if (!ans || ans.length === 0) {
          wx.showToast({ title: '请完成必答题', icon: 'none' });
          return;
        }
      } else if (!ans || String(ans).trim() === '') {
        wx.showToast({ title: '请完成必答题', icon: 'none' });
        return;
      }
    }

    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中...' });

    try {
      const result = await surveyService.submitSurvey(this.getSubmitAnswers());
      wx.removeStorageSync(CACHE_KEY);
      wx.hideLoading();

      const tip = result.alreadySubmitted
        ? '你已提交过问卷，券码仍然有效：'
        : '你的专属优惠码：';

      wx.showModal({
        title: '感谢参与！',
        content:
          tip +
          result.couponCode +
          '\n\n已发放 ¥500 首发代金券，支付时可抵扣。\n实际支付：¥4,499（原价 ¥4,999）' +
          (config.isMock ? '\n\n（当前为本地模拟，未写入云后台）' : ''),
        showCancel: true,
        confirmText: '去看看资格',
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
      wx.showToast({ title: '提交失败:' + (err.message || err), icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
