# XOLOme X1 首发预定 · 微信小程序

> 模拟验证版 · 符合微信小程序标准目录结构

## 目录结构

```
xolome-miniapp/                 ← 用微信开发者工具打开本目录
├── project.config.json         # 项目配置（含上传忽略规则）
├── project.private.config.json # 本机私有配置（勿提交）
├── README.md
├── miniprogram/                # 小程序前端（miniprogramRoot）
│   ├── app.js / app.json / app.wxss
│   ├── sitemap.json
│   ├── pages/                  # 主包页面
│   │   ├── index/              # 首页
│   │   ├── survey/             # 问卷
│   │   ├── preorder/           # 预定
│   │   └── order-detail/       # 订单详情
│   ├── subpackages/            # 分包
│   │   ├── order-list/
│   │   ├── refund/
│   │   ├── final-payment/
│   │   ├── voucher/
│   │   └── user-center/
│   ├── components/             # 自定义组件
│   ├── utils/                  # 工具与业务逻辑
│   └── images/                 # 静态资源
│       ├── brand/              # Logo
│       ├── hero/               # 首页轮播
│       ├── feature/            # 核心体验图
│       └── collab/             # 联名海报
└── cloudfunctions/             # 云函数（cloudfunctionRoot）
    ├── auth / survey / order / payment / refund
    ├── voucher / notification / scheduler
    └── mockPayment / mockNotification
```

## 导入项目

1. 打开微信开发者工具 → 导入项目  
2. 目录选择：`xolome-miniapp/`  
3. AppID：可留空（测试号）或使用 `project.config.json` 中的 AppID  
4. 编译预览

## 模拟 / 正式

| | 模拟验证 | 正式上线 |
|--|---------|---------|
| 开关 | `utils/config.js` → `IS_MOCK = true` | `IS_MOCK = false` |
| 数据 | localStorage | 云开发数据库 |
| 支付 | mockPay | 微信支付 |

## 文档

完整文档在仓库上级目录 `../docs/`：

- 开发入门 / overview  
- PRD / 模拟验证指南 / 微信申请流程  
- 颜色规范说明  

## 上传注意事项

`project.config.json` → `packOptions.ignore` 已忽略：

- `node_modules` / `.workbuddy` / `__MACOSX`  
- `.DS_Store` / `*.md` / `*.map`  
