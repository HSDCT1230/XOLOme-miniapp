// =====================================================
// utils/mock-data.js — 模拟数据层（替代云函数+数据库）
// 模拟验证阶段使用 localStorage 存储所有数据
// 正式版上线后删除此文件，替换为云函数调用
// =====================================================

const config = require('./config');
const { ORDER_STATUS, PAYMENT_TYPE, VOUCHER_SOURCE, VOUCHER_STATUS } = require('./constant');
const stateMachine = require('./state-machine');

const DAY_MS = 24 * 60 * 60 * 1000;

// ==================== 存储初始化 ====================

function initStorage() {
  if (!wx.getStorageSync('_xolome_init')) {
    wx.setStorageSync('orders', []);
    wx.setStorageSync('surveys', []);
    wx.setStorageSync('payments', []);
    wx.setStorageSync('refunds', []);
    wx.setStorageSync('vouchers', []);
    wx.setStorageSync('notifications', []);
    wx.setStorageSync('_xolome_init', true);
  }
}

// ==================== 工具方法 ====================

function uid() { return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8); }
function orderNo() { return 'XOL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function getAll(key) { return wx.getStorageSync(key) || []; }
function saveAll(key, data) { wx.setStorageSync(key, data); }
function findOne(key, predicate) { return (wx.getStorageSync(key) || []).find(predicate) || null; }
function findAll(key, predicate) { return (wx.getStorageSync(key) || []).filter(predicate); }
function updateOne(key, id, updates) {
  const list = wx.getStorageSync(key) || [];
  const idx = list.findIndex(item => item.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  saveAll(key, list);
  return list[idx];
}
function insertOne(key, item) {
  const list = wx.getStorageSync(key) || [];
  const newItem = { ...item, id: uid(), createdAt: new Date().toISOString() };
  list.push(newItem);
  saveAll(key, list);
  return newItem;
}

// ==================== 库存 ====================

// 真实占库：付 499 成功起占用；退款/转券/过期/券已用释放（与云函数 order 一致）
const STOCK_OCCUPYING = [
  ORDER_STATUS.DEPOSIT_PAID,
  ORDER_STATUS.DEPOSIT_GRACE,
  ORDER_STATUS.DEPOSIT_CONFIRMED,
  ORDER_STATUS.CONFIRMED_GRACE,
  ORDER_STATUS.LOCKED,
  ORDER_STATUS.FINAL_PAID,
  ORDER_STATUS.SHIPPED,
];

function getStockRemaining() {
  const orders = getAll('orders');
  const reserved = orders.filter((o) => STOCK_OCCUPYING.includes(o.status)).length;
  return Math.max(0, config.STOCK_TOTAL - reserved);
}

// ==================== 用户（模拟） ====================

function getUser() {
  return wx.getStorageSync('user');
}

function updateUser(updates) {
  const user = { ...wx.getStorageSync('user'), ...updates };
  wx.setStorageSync('user', user);
  return user;
}

// ==================== 问卷 ====================

function pickAnswer(data, key) {
  if (!data) return undefined;
  if (data[key] !== undefined) return data[key];
  return data[String(key)];
}

/** 与 cloudfunctions/survey flattenAnswers 对齐（题号 1–19 + 11 分支） */
function flattenSurveyAnswers(data) {
  const raw = data || {};
  return {
    age: pickAnswer(raw, 1) || null,
    gender: pickAnswer(raw, 2) || null,
    digitalBudget: pickAnswer(raw, 3) || null,
    purchaseHistory: pickAnswer(raw, 4) || null,
    firstImpression: pickAnswer(raw, 5) || null,
    firstImpressionNote: pickAnswer(raw, '5a') || '',
    compareCategory: pickAnswer(raw, 6) || null,
    scenarios: pickAnswer(raw, 7) || [],
    deskTime: pickAnswer(raw, 8) || null,
    coreInterests: pickAnswer(raw, 9) || [],
    topFeature: pickAnswer(raw, 10) || null,
    ipEcosystemInterest: pickAnswer(raw, 11) || null,
    ipFocusPreference: pickAnswer(raw, '11a') || null,
    addonPriceAccept: pickAnswer(raw, '11b') || null,
    wishIp: pickAnswer(raw, '11c') || '',
    ipShellPremium: pickAnswer(raw, '11d') || null,
    // v17：11e 已并入 11b；仅写 addonPriceAccept，ipMerchPayCap 固定 null 保留字段兼容
    // v18：Q12 preferredDeskScene 选项改为家庭+工位扁平单选（无大类分支）
    // v19：Q11 兴趣题去多桶（外壳/数字拆到 11a）；11a–11d 仅 very_interested/interested 可见
    // v20：Q9 none_attractive 隐藏 Q10/分支；Q10 可 none_first；Q13/Q15 去乐观前提；14a 增观望原因
    // v21：Q12 增 not_want；14a 合并 unproven→want_reviews；文案微调（无 flatten 结构变更）
    // topFeature 可为 null / none_first；priceRange 可含 not_consider
    ipMerchPayCap: null,
    albumUse: pickAnswer(raw, '11ha') || null,
    albumConcern: pickAnswer(raw, '11hb') || null,
    aiUse: pickAnswer(raw, '11ai') || null,
    aiProactive: pickAnswer(raw, '11ab') || null,
    gameScene: pickAnswer(raw, '11gc') || null,
    gamePriority: pickAnswer(raw, '11gb') || null,
    entertainmentContent: pickAnswer(raw, '11he') || null,
    entertainmentSource: pickAnswer(raw, '11hb2') || null,
    preferredDeskScene: pickAnswer(raw, 12) || null,
    priceRange: pickAnswer(raw, 13) || null,
    participation: pickAnswer(raw, 14) || null,
    barriers: pickAnswer(raw, '14a') || [],
    barrierNote: pickAnswer(raw, '14b') || '',
    buyTiming: pickAnswer(raw, 15) || null,
    otherSuggest: pickAnswer(raw, 16) || '',
    channels: pickAnswer(raw, 17) || [],
    displayName: pickAnswer(raw, 18) || '',
    contact: pickAnswer(raw, 19) || '',
  };
}

function submitSurvey(data) {
  const user = getUser();
  const flat = flattenSurveyAnswers(data);
  const survey = insertOne('surveys', {
    userId: user.id,
    data,
    ...flat,
    version: 'v21',
  });
  // 生成代金券码并持久化，供个人中心展示
  const couponCode = 'XOL5' + Math.random().toString(36).slice(2, 10).toUpperCase();
  const saved = updateOne('surveys', survey.id, { couponCode });
  return { ...(saved || survey), couponCode, alreadySubmitted: false };
}

function getMySurvey() {
  const user = getUser();
  return findOne('surveys', s => s.userId === user.id);
}

// ==================== 认知数据统计（V2.1:用于融资BP和市场分析）====================

// 统计第一眼产品认知分类比例
function getImpressionStats() {
  const surveys = getAll('surveys');
  const total = surveys.filter(s => s.firstImpression).length;
  if (total === 0) return { total: 0, distribution: [], groups: [] };

  // 按value统计
  const valueCount = {};
  surveys.forEach(s => {
    if (s.firstImpression) {
      valueCount[s.firstImpression] = (valueCount[s.firstImpression] || 0) + 1;
    }
  });

  // 转换为分布数组
  const distribution = Object.keys(valueCount).map(value => ({
    value,
    count: valueCount[value],
    percent: Math.round((valueCount[value] / total) * 100),
  })).sort((a, b) => b.count - a.count);

  // 按group聚合
  const { FIRST_IMPRESSION } = require('./constant');
  const groupCount = {};
  distribution.forEach(item => {
    const group = FIRST_IMPRESSION[item.value]?.group || '其他';
    groupCount[group] = (groupCount[group] || 0) + item.count;
  });
  const groups = Object.keys(groupCount).map(name => ({
    name,
    count: groupCount[name],
    percent: Math.round((groupCount[name] / total) * 100),
  })).sort((a, b) => b.count - a.count);

  return { total, distribution, groups };
}

// 统计核心兴趣排名
function getInterestStats() {
  const surveys = getAll('surveys');
  const total = surveys.filter(s => s.coreInterests && s.coreInterests.length > 0).length;
  if (total === 0) return { total: 0, ranking: [] };

  const interestCount = {};
  surveys.forEach(s => {
    if (Array.isArray(s.coreInterests)) {
      s.coreInterests.forEach(item => {
        interestCount[item] = (interestCount[item] || 0) + 1;
      });
    }
  });

  const { CORE_INTEREST } = require('./constant');
  const ranking = Object.keys(interestCount).map(value => ({
    value,
    label: CORE_INTEREST[value]?.label || value,
    count: interestCount[value],
    percent: Math.round((interestCount[value] / total) * 100),
  })).sort((a, b) => b.count - a.count);

  return { total, ranking };
}

// ==================== 订单 ====================

// 一人一有效单：转券/已退/已取消/已发货等终态允许再建（避免转券后无法用券死锁）
const TERMINAL_FOR_CREATE = [
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.EXPIRED,
  ORDER_STATUS.VOUCHER_USED,
  ORDER_STATUS.DEPOSIT_VOUCHER,
  ORDER_STATUS.CONFIRMED_VOUCHER,
  ORDER_STATUS.SHIPPED,
];

function createOrder(data = {}) {
  const user = getUser();
  const stock = getStockRemaining();
  if (stock <= 0) throw new Error('库存不足');

  const active = findAll('orders', (o) =>
    o.userId === user.id && !TERMINAL_FOR_CREATE.includes(o.status)
  );
  if (active.length > 0) throw new Error('您已有有效订单，请先完成或取消当前订单');

  const order = insertOne('orders', {
    userId: user.id,
    orderNo: orderNo(),
    status: ORDER_STATUS.PENDING_DEPOSIT,
    depositAmount: config.PRICE.DEPOSIT,
    confirmationAmount: config.PRICE.CONFIRMATION,
    confirmedAmount: config.PRICE.CONFIRMED_TOTAL,
    finalAmount: config.PRICE.FINAL,
    totalAmount: config.PRICE.WITH_COUPON,
    retailAmount: config.PRICE.RETAIL,
    couponCode: data.couponCode || null,
    // 物流
    shippingName: '',
    shippingPhone: '',
    shippingProvince: '',
    shippingCity: '',
    shippingDistrict: '',
    shippingAddress: '',
    trackingNumber: '',
  });
  return order;
}

function getOrder(id) {
  const order = findOne('orders', o => o.id === id);
  if (!order) return null;
  // 附加阶段计算信息
  const stage = stateMachine.calcOrderStage(order);
  return { ...order, stage };
}

function getMyOrders() {
  const user = getUser();
  // 刷新宽限期 / 转券等时效状态，保证订单中心信息准确
  try {
    runScheduler();
  } catch (e) {
    /* ignore */
  }
  return findAll('orders', (o) => o.userId === user.id).reverse();
}

function getOrderPayments(orderId) {
  return findAll('payments', (p) => p.orderId === orderId);
}

function getOrderByNo(orderNo) {
  return findOne('orders', o => o.orderNo === orderNo);
}

// ---- 支付（模拟） ----
function mockPay(orderId, amount, paymentType) {
  const order = findOne('orders', o => o.id === orderId);
  if (!order) throw new Error('订单不存在');

  const now = new Date().toISOString();

  // 根据支付类型更新订单状态
  let newStatus;
  let updates = {};

  switch (paymentType) {
    case 'DEPOSIT':
      if (order.status !== ORDER_STATUS.PENDING_DEPOSIT) throw new Error('订单状态不正确');
      newStatus = ORDER_STATUS.DEPOSIT_PAID;
      updates = stateMachine.buildOrderTimeline(order, 'DEPOSIT');
      break;

    case 'CONFIRMATION':
      if (!stateMachine.canSupplement(order)) throw new Error('当前不可补足');
      newStatus = ORDER_STATUS.DEPOSIT_CONFIRMED;
      updates = stateMachine.buildOrderTimeline(order, 'CONFIRMATION');
      break;

    case 'FINAL':
      if (!stateMachine.canPayFinal(order)) throw new Error('当前不可付尾款');
      newStatus = ORDER_STATUS.FINAL_PAID;
      updates = stateMachine.buildOrderTimeline(order, 'FINAL');
      break;

    default:
      throw new Error('未知支付类型');
  }

  // 记录支付流水
  insertOne('payments', {
    orderId: order.id,
    userId: order.userId,
    transactionId: 'mock_txn_' + Date.now(),
    outTradeNo: 'mock_out_' + Date.now(),
    type: paymentType,
    amount: amount,
    status: 'SUCCESS',
    paidAt: now,
  });

  // 更新订单
  const updated = updateOne('orders', orderId, {
    ...updates,
    status: newStatus,
  });

  return updated;
}

// ---- 确认继续购买（大定阶段 → LOCKED） ----
function confirmContinue(orderId) {
  const order = findOne('orders', o => o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (!stateMachine.canConfirmContinue(order)) throw new Error('当前不可确认');

  const updates = stateMachine.buildOrderTimeline(order, 'LOCK');
  return updateOne('orders', orderId, {
    ...updates,
    status: ORDER_STATUS.LOCKED,
  });
}

// ---- 申请退款 ----
function applyRefund(orderId, reason = '') {
  const order = findOne('orders', o => o.id === orderId);
  if (!order) throw new Error('订单不存在');
  if (!stateMachine.canRefund(order)) throw new Error('当前不可退款');

  // 计算退款金额
  let refundAmount;
  if (order.status === ORDER_STATUS.DEPOSIT_CONFIRMED || order.status === ORDER_STATUS.CONFIRMED_GRACE) {
    refundAmount = config.PRICE.CONFIRMED_TOTAL;
  } else {
    refundAmount = config.PRICE.DEPOSIT;
  }

  // 记录退款
  insertOne('refunds', {
    orderId: order.id,
    userId: order.userId,
    amount: refundAmount,
    reason: reason,
    status: 'SUCCESS',
    refundId: 'mock_refund_' + Date.now(),
    processedAt: new Date().toISOString(),
  });

  // 更新订单状态
  return updateOne('orders', orderId, {
    status: ORDER_STATUS.REFUNDED,
  });
}

// ==================== 定时任务：状态流转（手动触发，用于模拟测试） ====================

function runScheduler(mockNow = null) {
  const now = mockNow ? new Date(mockNow) : new Date();
  const nowISO = now.toISOString();
  const orders = getAll('orders');
  const results = [];

  for (const order of orders) {
    let newStatus = null;
    let extraActions = [];

    // 1. 意向金60天到期 → 进入宽限期
    if (order.status === ORDER_STATUS.DEPOSIT_PAID && order.refundDeadline && nowISO > order.refundDeadline) {
      newStatus = ORDER_STATUS.DEPOSIT_GRACE;
    }

    // 2. 意向金宽限期到期 → 转代金券
    if (order.status === ORDER_STATUS.DEPOSIT_GRACE && order.graceDeadline && nowISO > order.graceDeadline) {
      newStatus = ORDER_STATUS.DEPOSIT_VOUCHER;
      const voucherDeadline = new Date(now.getTime() + config.TIME.VOUCHER_VALID * DAY_MS).toISOString();
      extraActions.push(() => {
        insertOne('vouchers', {
          userId: order.userId,
          orderId: order.id,
          voucherNo: 'VC' + Date.now().toString(36).toUpperCase(),
          amount: config.PRICE.DEPOSIT,
          sourceType: VOUCHER_SOURCE.DEPOSIT_VOUCHER,
          status: VOUCHER_STATUS.ACTIVE,
          expiredAt: voucherDeadline,
        });
      });
    }

    // 3. 大定30天到期 → 进入宽限期
    if (order.status === ORDER_STATUS.DEPOSIT_CONFIRMED && order.refundDeadline && nowISO > order.refundDeadline) {
      newStatus = ORDER_STATUS.CONFIRMED_GRACE;
    }

    // 4. 大定宽限期到期 → 转代金券
    if (order.status === ORDER_STATUS.CONFIRMED_GRACE && order.graceDeadline && nowISO > order.graceDeadline) {
      newStatus = ORDER_STATUS.CONFIRMED_VOUCHER;
      const voucherDeadline = new Date(now.getTime() + config.TIME.VOUCHER_VALID * DAY_MS).toISOString();
      extraActions.push(() => {
        insertOne('vouchers', {
          userId: order.userId,
          orderId: order.id,
          voucherNo: 'VC' + Date.now().toString(36).toUpperCase(),
          amount: config.PRICE.CONFIRMED_TOTAL,
          sourceType: VOUCHER_SOURCE.CONFIRMED_VOUCHER,
          status: VOUCHER_STATUS.ACTIVE,
          expiredAt: voucherDeadline,
        });
      });
    }

    // 5. 代金券到期
    if ([ORDER_STATUS.DEPOSIT_VOUCHER, ORDER_STATUS.CONFIRMED_VOUCHER].includes(order.status) &&
        order.voucherDeadline && nowISO > order.voucherDeadline) {
      newStatus = ORDER_STATUS.EXPIRED;
      // 同时过期关联的 voucher 记录
      extraActions.push(() => {
        const vouchers = getAll('vouchers');
        const vouchersToExpire = vouchers.filter(v => v.orderId === order.id && v.status === VOUCHER_STATUS.ACTIVE);
        vouchersToExpire.forEach(v => updateOne('vouchers', v.id, { status: VOUCHER_STATUS.EXPIRED }));
      });
    }

    if (newStatus) {
      const updated = updateOne('orders', order.id, { status: newStatus });
      extraActions.forEach(fn => fn());
      results.push({ orderId: order.id, from: order.status, to: newStatus });
    }
  }

  return { processed: results.length, details: results, mockTime: nowISO };
}

// ==================== 代金券 ====================

function getMyVouchers() {
  const user = getUser();
  return findAll('vouchers', v => v.userId === user.id).reverse();
}

function getVoucher(id) {
  return findOne('vouchers', v => v.id === id);
}

// ==================== 通知 ====================

function getMyNotifications() {
  const user = getUser();
  return findAll('notifications', n => n.userId === user.id).reverse();
}

function addNotification(userId, scene, orderId, content) {
  return insertOne('notifications', {
    userId,
    orderId,
    scene,
    content,
    status: 'SENT',
    sentAt: new Date().toISOString(),
  });
}

// ==================== 测试辅助 ====================

function resetAllData() {
  wx.setStorageSync('orders', []);
  wx.setStorageSync('surveys', []);
  wx.setStorageSync('payments', []);
  wx.setStorageSync('refunds', []);
  wx.setStorageSync('vouchers', []);
  wx.setStorageSync('notifications', []);
}

// 模拟时间加速：将订单的时间线向前推移N天（用于测试）
function fastForward(orderId, days) {
  const order = findOne('orders', o => o.id === orderId);
  if (!order) throw new Error('订单不存在');

  const shift = (dateStr) => {
    if (!dateStr) return dateStr;
    return new Date(new Date(dateStr).getTime() - days * DAY_MS).toISOString();
  };

  const shifted = {
    ...order,
    depositPaidAt: shift(order.depositPaidAt),
    depositConfirmedAt: shift(order.depositConfirmedAt),
    refundDeadline: shift(order.refundDeadline),
    graceDeadline: shift(order.graceDeadline),
    voucherDeadline: shift(order.voucherDeadline),
  };

  return updateOne('orders', orderId, shifted);
}

module.exports = {
  initStorage,
  getStockRemaining,
  getUser,
  updateUser,
  // 问卷
  submitSurvey,
  getMySurvey,
  // V2.1:认知数据统计
  getImpressionStats,
  getInterestStats,
  // 订单
  createOrder,
  getOrder,
  getMyOrders,
  getOrderByNo,
  getOrderPayments,
  mockPay,
  confirmContinue,
  applyRefund,
  // 定时任务
  runScheduler,
  // 代金券
  getMyVouchers,
  getVoucher,
  // 通知
  getMyNotifications,
  addNotification,
  // 测试
  resetAllData,
  fastForward,
};
