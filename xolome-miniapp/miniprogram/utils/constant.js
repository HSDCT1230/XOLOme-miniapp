// =====================================================
// utils/constant.js — 所有常量定义
// =====================================================

// ---- 订单状态枚举（后端内部使用,前端不直接展示） ----
const ORDER_STATUS = {
  PENDING_DEPOSIT:   'PENDING_DEPOSIT',    // 待付体验资格(¥499)
  DEPOSIT_PAID:      'DEPOSIT_PAID',       // 体验资格有效(60天可退)
  DEPOSIT_GRACE:     'DEPOSIT_GRACE',      // 体验资格即将调整(内部状态)
  DEPOSIT_VOUCHER:   'DEPOSIT_VOUCHER',    // 体验资格转代金券
  DEPOSIT_CONFIRMED: 'DEPOSIT_CONFIRMED',  // 已确认购买(30天可退)
  CONFIRMED_GRACE:   'CONFIRMED_GRACE',    // 确认购买即将调整(内部状态)
  CONFIRMED_VOUCHER: 'CONFIRMED_VOUCHER',  // 确认购买转代金券
  LOCKED:            'LOCKED',             // 锁定,等待尾款
  FINAL_PAID:        'FINAL_PAID',         // 尾款已付
  SHIPPED:           'SHIPPED',            // 已发货
  REFUNDED:          'REFUNDED',           // 已退款（终态）
  CANCELLED:         'CANCELLED',          // 已取消（终态）
  VOUCHER_USED:      'VOUCHER_USED',       // 代金券已使用（终态）
  EXPIRED:           'EXPIRED',            // 已过期（终态）
};

// ---- 订单状态中文（V2.1:面向用户,只显示业务语义,隐藏内部状态码） ----
const STATUS_TEXT = {
  PENDING_DEPOSIT:   '待支付体验资格',
  DEPOSIT_PAID:      '体验资格有效',
  DEPOSIT_GRACE:     '体验资格即将调整',  // 不显示"宽限期"术语
  DEPOSIT_VOUCHER:   '已转为首发代金券',
  DEPOSIT_CONFIRMED: '已确认购买',
  CONFIRMED_GRACE:   '确认购买即将调整',
  CONFIRMED_VOUCHER: '已转为代金券',
  LOCKED:            '已锁定 · 待付尾款',
  FINAL_PAID:        '已完成支付 · 等待发货',
  SHIPPED:           '已发货',
  REFUNDED:          '已退款',
  CANCELLED:         '已取消',
  VOUCHER_USED:      '已使用',
  EXPIRED:           '已过期',
};

// 面向用户的退款状态标签
const REFUND_STATUS_TEXT = {
  // 体验资格阶段(¥499)
  DEPOSIT_REFUNDABLE: '体验资格60天内可退',
  DEPOSIT_GRACE_NEAR: '体验资格即将转为代金券',  // 进入宽限期
  DEPOSIT_VOUCHERED:  '已转为首发代金券',
  // 确认购买阶段(¥1,499)
  CONFIRMED_REFUNDABLE: '30天内可申请退款',
  CONFIRMED_GRACE_NEAR: '即将转为代金券',
  CONFIRMED_VOUCHERED:  '已转为代金券',
  // 锁定后不可退
  LOCKED_NO_REFUND:    '订单已锁定,不可退款',
  // 终态
  REFUNDED_DONE:       '退款已到账',
  SHIPPED_DONE:        '已发货,不可退款',
};

// ---- 支付类型 ----
const PAYMENT_TYPE = {
  DEPOSIT:      'DEPOSIT',       // ¥499 意向金
  CONFIRMATION: 'CONFIRMATION',  // ¥1,000 补款
  FINAL:        'FINAL',         // ¥3,000 尾款
  REFUND:       'REFUND',        // 退款
};

// ---- 代金券来源 ----
const VOUCHER_SOURCE = {
  DEPOSIT_VOUCHER:   'DEPOSIT_VOUCHER',    // 来自意向金
  CONFIRMED_VOUCHER: 'CONFIRMED_VOUCHER',  // 来自大定
};

// ---- 代金券状态 ----
const VOUCHER_STATUS = {
  ACTIVE:  'ACTIVE',
  USED:    'USED',
  EXPIRED: 'EXPIRED',
};

// ---- 通知场景 ----
const NOTIFY_SCENE = {
  DEPOSIT_PAID:           'DEPOSIT_PAID',            // 意向金支付成功
  DEPOSIT_WARNING:        'DEPOSIT_WARNING',         // 提前3天预警
  DEPOSIT_GRACE_START:    'DEPOSIT_GRACE_START',     // 进入宽限期
  DEPOSIT_GRACE_DAILY:    'DEPOSIT_GRACE_DAILY',     // 宽限期每日提醒
  DEPOSIT_TO_VOUCHER:     'DEPOSIT_TO_VOUCHER',      // 转代金券
  CONFIRMED_PAID:         'CONFIRMED_PAID',           // 补足成功
  CONFIRMED_WARNING:      'CONFIRMED_WARNING',        // 提前3天预警
  CONFIRMED_GRACE_START:  'CONFIRMED_GRACE_START',    // 进入宽限期
  CONFIRMED_GRACE_DAILY:  'CONFIRMED_GRACE_DAILY',    // 宽限期每日提醒
  CONFIRMED_TO_VOUCHER:   'CONFIRMED_TO_VOUCHER',     // 转代金券
  FINAL_PAID:             'FINAL_PAID',               // 尾款支付成功
  SHIPPED:                'SHIPPED',                  // 已发货
  VOUCHER_WARNING_35:     'VOUCHER_WARNING_35',       // 代金券35天预警
  VOUCHER_WARNING_5:      'VOUCHER_WARNING_5',        // 代金券5天预警
  VOUCHER_EXPIRED:        'VOUCHER_EXPIRED',          // 代金券过期
};

// ---- 第一眼产品认知（V2.1:用于融资BP和市场分析） ----
const FIRST_IMPRESSION = {
  ai_device:           { value: 'ai_device',           label: 'AI智能设备',         group: 'AI设备' },
  hologram_player:     { value: 'hologram_player',     label: '全息播放器',         group: 'AI设备' },
  ip_collectible:      { value: 'ip_collectible',      label: 'IP潮玩摆件',         group: 'IP潮玩' },
  desktop_companion:   { value: 'desktop_companion',   label: '桌面陪伴伙伴',       group: '桌面伙伴' },
  game_device:         { value: 'game_device',         label: '游戏互动设备',       group: '游戏设备' },
  other:               { value: 'other',               label: '其他',               group: '其他' },
};

// ---- 核心兴趣（Q3功能选项,V2.1:用户兴趣排名统计） ----
const CORE_INTEREST = {
  ip_partner:             { value: 'ip_partner',             label: 'IP全息伙伴' },
  hologram_album:         { value: 'hologram_album',         label: '全息相册' },
  game_companion:         { value: 'game_companion',         label: '游戏陪伴' },
  ai_assistant:           { value: 'ai_assistant',           label: 'AI私人伙伴' },
  hologram_entertainment: { value: 'hologram_entertainment', label: '全息娱乐' },
};

// ---- 状态流转规则 ----
const STATE_TRANSITIONS = {
  [ORDER_STATUS.PENDING_DEPOSIT]:   [ORDER_STATUS.DEPOSIT_PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.DEPOSIT_PAID]:      [ORDER_STATUS.DEPOSIT_CONFIRMED, ORDER_STATUS.DEPOSIT_GRACE, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.DEPOSIT_GRACE]:     [ORDER_STATUS.DEPOSIT_CONFIRMED, ORDER_STATUS.DEPOSIT_VOUCHER, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.DEPOSIT_VOUCHER]:   [ORDER_STATUS.VOUCHER_USED, ORDER_STATUS.EXPIRED],
  [ORDER_STATUS.DEPOSIT_CONFIRMED]: [ORDER_STATUS.LOCKED, ORDER_STATUS.CONFIRMED_GRACE, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CONFIRMED_GRACE]:   [ORDER_STATUS.LOCKED, ORDER_STATUS.CONFIRMED_VOUCHER, ORDER_STATUS.REFUNDED],
  [ORDER_STATUS.CONFIRMED_VOUCHER]: [ORDER_STATUS.VOUCHER_USED, ORDER_STATUS.EXPIRED],
  [ORDER_STATUS.LOCKED]:            [ORDER_STATUS.FINAL_PAID],
  [ORDER_STATUS.FINAL_PAID]:        [ORDER_STATUS.SHIPPED],
};

module.exports = {
  ORDER_STATUS,
  STATUS_TEXT,
  REFUND_STATUS_TEXT,
  PAYMENT_TYPE,
  VOUCHER_SOURCE,
  VOUCHER_STATUS,
  NOTIFY_SCENE,
  STATE_TRANSITIONS,
  FIRST_IMPRESSION,
  CORE_INTEREST,
};
