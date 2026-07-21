// =====================================================
// utils/state-machine.js — 订单状态机（核心业务逻辑）
// =====================================================

const { ORDER_STATUS, STATE_TRANSITIONS } = require('./constant');
const config = require('./config');
const DAY_MS = 24 * 60 * 60 * 1000;

// ---- 状态流转校验 ----
function isValidTransition(from, to) {
  const allowed = STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// ---- 判断是否可以退款 ----
function canRefund(order) {
  const now = Date.now();
  const graceDeadline = order.graceDeadline ? new Date(order.graceDeadline).getTime() : 0;

  const refundableStates = [
    ORDER_STATUS.DEPOSIT_PAID,
    ORDER_STATUS.DEPOSIT_GRACE,
    ORDER_STATUS.DEPOSIT_CONFIRMED,
    ORDER_STATUS.CONFIRMED_GRACE,
  ];

  return refundableStates.includes(order.status) && now < graceDeadline;
}

// ---- 判断是否可以补足意向金（¥499 → ¥1,499） ----
function canSupplement(order) {
  const refundableStates = [ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.DEPOSIT_GRACE];
  return refundableStates.includes(order.status);
}

// ---- 判断是否可以确认继续购买（大定阶段） ----
function canConfirmContinue(order) {
  const confirmableStates = [ORDER_STATUS.DEPOSIT_CONFIRMED, ORDER_STATUS.CONFIRMED_GRACE];
  return confirmableStates.includes(order.status);
}

// ---- 判断是否可以支付尾款 ----
function canPayFinal(order) {
  return order.status === ORDER_STATUS.LOCKED;
}

// ---- 计算订单阶段信息（用于前端展示） ----
function calcOrderStage(order) {
  const now = Date.now();
  const refundDeadline = order.refundDeadline ? new Date(order.refundDeadline).getTime() : 0;
  const graceDeadline = order.graceDeadline ? new Date(order.graceDeadline).getTime() : 0;
  const voucherDeadline = order.voucherDeadline ? new Date(order.voucherDeadline).getTime() : 0;

  const base = {
    status: order.status,
    stageIndex: -1,
    canRefund: false,
    canSupplement: false,
    canConfirmContinue: false,
    canPayFinal: false,
    countdown: null,
    countdownLabel: '',
    statusText: '',
    statusColor: '#999',
    actionText: '',
    actionType: '', // primary | accent | danger | outline
    nextAmount: 0,
  };

  switch (order.status) {
    // ===== 体验资格阶段（V2.1 面向用户文案）=====
    case ORDER_STATUS.PENDING_DEPOSIT:
      return {
        ...base, stageIndex: 0,
        statusText: '待支付 ¥499 体验资格',
        statusColor: '#ff8f00',
        actionText: '立即支付 ¥499',
        actionType: 'primary',
        nextAmount: config.PRICE.DEPOSIT,
      };

    case ORDER_STATUS.DEPOSIT_PAID:
      return {
        ...base, stageIndex: 0,
        canRefund: now < refundDeadline,
        canSupplement: true,
        countdown: refundDeadline,
        countdownLabel: '体验资格有效期',  // V2.1:不再显示"退款窗口倒计时"
        statusText: '体验资格有效 · 60天内可退',
        statusColor: '#6ec73b',
        actionText: '补足 ¥1,000 确认购买',
        actionType: 'accent',
        nextAmount: config.PRICE.CONFIRMATION,
      };

    case ORDER_STATUS.DEPOSIT_GRACE:
      return {
        ...base, stageIndex: 0,
        canRefund: now < graceDeadline,
        canSupplement: true,
        countdown: graceDeadline,
        countdownLabel: '体验资格即将调整',  // V2.1:不显示"宽限期"
        statusText: '请尽快确认 · 否则将转为代金券',  // V2.1:不显示"7天后转代金券"
        statusColor: '#ff595f',
        actionText: '补足 ¥1,000 或申请退款',
        actionType: 'accent',
        nextAmount: config.PRICE.CONFIRMATION,
      };

    case ORDER_STATUS.DEPOSIT_VOUCHER:
      return {
        ...base, stageIndex: 0,
        countdown: voucherDeadline,
        countdownLabel: '代金券有效期',
        statusText: '¥499 已转为首发代金券',  // V2.1:移除"(365天有效)"括号
        statusColor: '#6ec73b',
        actionText: '查看代金券',
        actionType: 'outline',
      };

    // ===== 确认购买阶段（V2.1 面向用户文案）=====
    case ORDER_STATUS.DEPOSIT_CONFIRMED:
      return {
        ...base, stageIndex: 1,
        canRefund: now < refundDeadline,
        canConfirmContinue: true,
        countdown: refundDeadline,
        countdownLabel: '确认购买有效期',  // V2.1:不显示"犹豫期"
        statusText: '已确认购买 · 30天内可退',
        statusColor: '#6ec73b',
        actionText: '确认继续购买',
        actionType: 'primary',
      };

    case ORDER_STATUS.CONFIRMED_GRACE:
      return {
        ...base, stageIndex: 1,
        canRefund: now < graceDeadline,
        canConfirmContinue: true,
        countdown: graceDeadline,
        countdownLabel: '即将调整',  // V2.1:不显示"宽限期倒计时"
        statusText: '请尽快确认 · 否则将转为代金券',
        statusColor: '#ff595f',
        actionText: '请确认是否继续',
        actionType: 'primary',
      };

    case ORDER_STATUS.CONFIRMED_VOUCHER:
      return {
        ...base, stageIndex: 1,
        countdown: voucherDeadline,
        countdownLabel: '代金券有效期',
        statusText: '¥1,499 已转为代金券',
        statusColor: '#6ec73b',
        actionText: '查看代金券',
        actionType: 'outline',
      };

    // ===== 后续阶段 =====
    case ORDER_STATUS.LOCKED:
      return {
        ...base, stageIndex: 2,
        canPayFinal: true,
        statusText: '已锁定 · 等待支付尾款',
        statusColor: '#6ec73b',
        actionText: '支付尾款 ¥3,000',
        actionType: 'primary',
        nextAmount: config.PRICE.FINAL,
      };

    case ORDER_STATUS.FINAL_PAID:
      return {
        ...base, stageIndex: 3,
        statusText: '已完成支付 · 等待发货',
        statusColor: '#4589d6',
        actionText: '预计2026年12月31日发货',
        actionType: 'outline',
      };

    case ORDER_STATUS.SHIPPED:
      return {
        ...base, stageIndex: 4,
        statusText: '已发货',
        statusColor: '#6ec73b',
      };

    // ===== 终态 =====
    case ORDER_STATUS.REFUNDED:
      return { ...base, stageIndex: -1, statusText: '已退款', statusColor: '#999' };
    case ORDER_STATUS.CANCELLED:
      return { ...base, stageIndex: -1, statusText: '已取消', statusColor: '#999' };
    case ORDER_STATUS.VOUCHER_USED:
      return { ...base, stageIndex: -1, statusText: '代金券已使用', statusColor: '#6ec73b' };
    case ORDER_STATUS.EXPIRED:
      return { ...base, stageIndex: -1, statusText: '已过期', statusColor: '#999' };

    default:
      return base;
  }
}

// ---- 创建订单默认时间线（支付回调时调用） ----
function buildOrderTimeline(order, paymentType) {
  const now = new Date();
  const timeline = {};

  switch (paymentType) {
    case 'DEPOSIT':
      timeline.depositPaidAt = now.toISOString();
      timeline.refundDeadline = new Date(now.getTime() + config.TIME.DEPOSIT_REFUND * DAY_MS).toISOString();
      timeline.graceDeadline = new Date(now.getTime() + (config.TIME.DEPOSIT_REFUND + config.TIME.DEPOSIT_GRACE) * DAY_MS).toISOString();
      break;

    case 'CONFIRMATION':
      timeline.depositConfirmedAt = now.toISOString();
      timeline.confirmedAmount = config.PRICE.CONFIRMED_TOTAL;
      timeline.refundDeadline = new Date(now.getTime() + config.TIME.CONFIRMED_REFUND * DAY_MS).toISOString();
      timeline.graceDeadline = new Date(now.getTime() + (config.TIME.CONFIRMED_REFUND + config.TIME.CONFIRMED_GRACE) * DAY_MS).toISOString();
      break;

    case 'FINAL':
      timeline.finalPaidAt = now.toISOString();
      break;

    case 'LOCK':
      timeline.lockedAt = now.toISOString();
      break;
  }

  return { ...order, ...timeline, updatedAt: now.toISOString() };
}

// ---- 获取预计金额明细（V2.1:用户友好文案）----
function getAmountBreakdown(order) {
  return [
    { label: '体验资格', amount: order.depositAmount || config.PRICE.DEPOSIT, paid: order.status !== ORDER_STATUS.PENDING_DEPOSIT },
    { label: '确认购买', amount: order.confirmationAmount || config.PRICE.CONFIRMATION, paid: order.status !== ORDER_STATUS.PENDING_DEPOSIT && order.status !== ORDER_STATUS.DEPOSIT_PAID && order.status !== ORDER_STATUS.DEPOSIT_GRACE && order.status !== ORDER_STATUS.DEPOSIT_VOUCHER },
    { label: '尾款', amount: order.finalAmount || config.PRICE.FINAL, paid: order.status === ORDER_STATUS.FINAL_PAID || order.status === ORDER_STATUS.SHIPPED },
  ];
}

module.exports = {
  isValidTransition,
  canRefund,
  canSupplement,
  canConfirmContinue,
  canPayFinal,
  calcOrderStage,
  buildOrderTimeline,
  getAmountBreakdown,
};
