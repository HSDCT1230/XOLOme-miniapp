// =====================================================
// utils/order-summary.js — 订单中心：按付款阶段汇总必要信息
// 三阶段：体验资格 ¥499 → 确认购买 累计¥1,499 → 尾款 ¥3,000
// =====================================================

const config = require('./config');
const { ORDER_STATUS } = require('./constant');
const SM = require('./state-machine');

const STAGE_META = [
  { index: 0, key: 'deposit', label: '体验资格', short: '资格', amount: config.PRICE.DEPOSIT },
  { index: 1, key: 'confirm', label: '确认购买', short: '确认', amount: config.PRICE.CONFIRMED_TOTAL },
  { index: 2, key: 'final', label: '尾款', short: '尾款', amount: config.PRICE.FINAL },
  { index: 3, key: 'ship', label: '发货', short: '发货', amount: 0 },
];

const TERMINAL = [
  ORDER_STATUS.REFUNDED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.VOUCHER_USED,
  ORDER_STATUS.EXPIRED,
];

const VOUCHER_LIKE = [ORDER_STATUS.DEPOSIT_VOUCHER, ORDER_STATUS.CONFIRMED_VOUCHER];

function fen2yuan(fen) {
  const n = Number(fen) || 0;
  return (n / 100).toFixed(n % 100 === 0 ? 0 : 2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return (
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

function formatCountdown(ms) {
  if (ms <= 0) return '已到期';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return '剩 ' + days + ' 天';
  if (hours > 0) return '剩 ' + hours + ' 小时';
  const minutes = Math.max(1, Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)));
  return '剩 ' + minutes + ' 分钟';
}

/** 已付金额（分）：按状态机真实阶段推算 */
function calcPaidFen(order) {
  const s = order.status;
  if (s === ORDER_STATUS.PENDING_DEPOSIT || s === ORDER_STATUS.CANCELLED) return 0;
  if (s === ORDER_STATUS.REFUNDED) {
    // 退款前已付：有确认时间按确认总额，否则体验资格
    if (order.depositConfirmedAt || order.confirmedAmount) {
      return order.confirmedAmount || config.PRICE.CONFIRMED_TOTAL;
    }
    return order.depositAmount || config.PRICE.DEPOSIT;
  }
  if (
    s === ORDER_STATUS.DEPOSIT_PAID ||
    s === ORDER_STATUS.DEPOSIT_GRACE ||
    s === ORDER_STATUS.DEPOSIT_VOUCHER
  ) {
    return order.depositAmount || config.PRICE.DEPOSIT;
  }
  if (
    s === ORDER_STATUS.DEPOSIT_CONFIRMED ||
    s === ORDER_STATUS.CONFIRMED_GRACE ||
    s === ORDER_STATUS.CONFIRMED_VOUCHER ||
    s === ORDER_STATUS.LOCKED
  ) {
    return order.confirmedAmount || config.PRICE.CONFIRMED_TOTAL;
  }
  if (s === ORDER_STATUS.FINAL_PAID || s === ORDER_STATUS.SHIPPED || s === ORDER_STATUS.VOUCHER_USED) {
    return order.totalAmount || config.PRICE.WITH_COUPON;
  }
  if (s === ORDER_STATUS.EXPIRED) {
    return 0;
  }
  return 0;
}

/** 最近一次关键付款时间 */
function latestPaidAt(order) {
  return order.finalPaidAt || order.lockedAt || order.depositConfirmedAt || order.depositPaidAt || order.createdAt || '';
}

/**
 * 单笔订单 → 订单中心卡片所需全部字段
 */
function buildOrderSummary(order) {
  if (!order) return null;

  const stage = SM.calcOrderStage(order);
  const breakdown = SM.getAmountBreakdown(order);
  const isTerminal = TERMINAL.includes(order.status);
  const isVoucher = VOUCHER_LIKE.includes(order.status);
  const isUrgent =
    order.status === ORDER_STATUS.DEPOSIT_GRACE || order.status === ORDER_STATUS.CONFIRMED_GRACE;

  const paidFen = calcPaidFen(order);
  const nextFen = stage.nextAmount || 0;

  // 进度点：0~3，终态/代金券不点亮发货
  let progressIndex = typeof stage.stageIndex === 'number' ? stage.stageIndex : -1;
  if (isTerminal || isVoucher) progressIndex = Math.max(progressIndex, 0);

  const progressSteps = STAGE_META.map((m) => ({
    ...m,
    amountY: m.amount ? fen2yuan(m.amount) : '',
    done: progressIndex > m.index || (progressIndex === m.index && (isTerminal || order.status === ORDER_STATUS.SHIPPED || order.status === ORDER_STATUS.FINAL_PAID)),
    current: progressIndex === m.index && !isTerminal,
  }));

  // 待办优先级（越小越优先展示）
  let priority = 50;
  if (isUrgent) priority = 1;
  else if (stage.canPayFinal) priority = 2;
  else if (stage.canSupplement) priority = 3;
  else if (stage.canConfirmContinue) priority = 4;
  else if (stage.canRefund) priority = 5;
  else if (isVoucher) priority = 20;
  else if (isTerminal) priority = 90;
  else priority = 10;

  let countdownText = '';
  if (stage.countdown) {
    const diff = new Date(stage.countdown).getTime() - Date.now();
    countdownText = formatCountdown(diff);
  }

  const stageLabel =
    progressIndex >= 0 && progressIndex < STAGE_META.length
      ? '阶段' + (progressIndex + 1) + ' · ' + STAGE_META[progressIndex].label
      : isTerminal
        ? '已结束'
        : '订单';

  // 付款记录摘要（必要节点）
  const records = [];
  if (order.createdAt) records.push({ label: '下单', time: formatTime(order.createdAt) });
  if (order.depositPaidAt) {
    records.push({
      label: '体验资格 ¥' + fen2yuan(order.depositAmount || config.PRICE.DEPOSIT),
      time: formatTime(order.depositPaidAt),
    });
  }
  if (order.depositConfirmedAt) {
    records.push({
      label: '确认购买 累计¥' + fen2yuan(order.confirmedAmount || config.PRICE.CONFIRMED_TOTAL),
      time: formatTime(order.depositConfirmedAt),
    });
  }
  if (order.lockedAt) records.push({ label: '订单锁定', time: formatTime(order.lockedAt) });
  if (order.finalPaidAt) {
    records.push({
      label: '尾款 ¥' + fen2yuan(order.finalAmount || config.PRICE.FINAL),
      time: formatTime(order.finalPaidAt),
    });
  }

  // 待办文案
  let todoText = '';
  let todoType = ''; // pay | confirm | refund | voucher | none
  if (stage.canSupplement) {
    todoText = stage.actionText || '补足确认购买';
    todoType = 'pay';
  } else if (stage.canConfirmContinue) {
    todoText = stage.actionText || '确认继续购买';
    todoType = 'confirm';
  } else if (stage.canPayFinal) {
    todoText = stage.actionText || '支付尾款';
    todoType = 'pay';
  } else if (isVoucher) {
    todoText = '查看代金券';
    todoType = 'voucher';
  } else if (stage.canRefund) {
    todoText = '可申请退款';
    todoType = 'refund';
  } else if (order.status === ORDER_STATUS.FINAL_PAID) {
    todoText = '等待发货';
    todoType = 'none';
  } else if (order.status === ORDER_STATUS.SHIPPED) {
    todoText = '已发货';
    todoType = 'none';
  }

  return {
    id: order.id,
    orderNo: order.orderNo,
    status: order.status,
    createdAt: formatTime(order.createdAt),
    latestPaidAt: formatTime(latestPaidAt(order)),
    couponCode: order.couponCode || '',

    // 阶段
    stageIndex: progressIndex,
    stageLabel,
    statusText: stage.statusText || order.status,
    statusColor: stage.statusColor || '#999',
    isTerminal,
    isVoucher,
    isUrgent,
    priority,
    hasTodo: !!(todoText && todoType && todoType !== 'none'),

    // 金额
    paidFen,
    paidY: fen2yuan(paidFen),
    nextFen,
    nextY: nextFen ? fen2yuan(nextFen) : '',
    totalY: fen2yuan(order.totalAmount || config.PRICE.WITH_COUPON),
    retailY: fen2yuan(order.retailAmount || config.PRICE.RETAIL),

    // 倒计时 / 待办
    countdownLabel: stage.countdownLabel || '',
    countdownText,
    todoText,
    todoType,
    actionText: stage.actionText || '',
    canRefund: !!stage.canRefund,
    canSupplement: !!stage.canSupplement,
    canConfirmContinue: !!stage.canConfirmContinue,
    canPayFinal: !!stage.canPayFinal,

    // 明细与进度
    breakdown: breakdown.map((b) => ({
      label: b.label,
      amountY: fen2yuan(b.amount),
      paid: !!b.paid,
    })),
    progressSteps,
    records,
  };
}

/** 多笔订单排序：紧急 → 待付款 → 进行中 → 代金券 → 终态；同组新单在前 */
function sortSummaries(list) {
  return (list || []).slice().sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return (b.orderNo || '').localeCompare(a.orderNo || '');
  });
}

/** 订单中心顶部概览 */
function buildCenterOverview(summaries, voucherCount) {
  const list = summaries || [];
  const ongoing = list.filter((o) => !o.isTerminal);
  const ended = list.filter((o) => o.isTerminal);
  const todo = list.filter((o) => o.hasTodo || o.isUrgent);
  const urgent = list.filter((o) => o.isUrgent);
  const primary = sortSummaries(todo)[0] || sortSummaries(ongoing)[0] || null;

  return {
    totalCount: list.length,
    ongoingCount: ongoing.length,
    endedCount: ended.length,
    todoCount: todo.length,
    urgentCount: urgent.length,
    voucherCount: voucherCount || 0,
    primary,
  };
}

module.exports = {
  STAGE_META,
  TERMINAL,
  fen2yuan,
  buildOrderSummary,
  sortSummaries,
  buildCenterOverview,
};
