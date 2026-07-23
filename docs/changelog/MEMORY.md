# XOLOme X1 首发预定小程序 — 项目长期记忆

## 项目概述
- 微信小程序：XOLOme X1 首发预定（市场调研 + 预定流程）
- 本机仓库：`D:\cursoe_code\XOLOme-Miniapp`
- GitHub：https://github.com/HSDCT1230/XOLOme-miniapp
- 小程序工程：`xolome-miniapp/`（开发者工具打开此层）
- 废弃路径：`E:\Xolome微信小程序\`（勿用）
- 当前版本：V2.1（用户认知路径重构版）

## 核心业务规则（不变）
- 预定阶梯：¥499体验资格(60天退)→+¥1,000确认购买¥1,499(30天退)→尾款¥3,000→发货
- 退款转代金券：超期未补足→7天调整期→转代金券365天
- 14种订单状态，完整状态机
- 金额用「分」存储，后端逻辑不可变

## V2.1 文案规范（用户端）
| 旧术语 | V2.1 用户端 | 内部代码 |
|--------|------------|----------|
| 意向金 | 体验资格 | DEPOSIT |
| 大定 | 确认购买 | CONFIRMATION |
| 宽限期 | 即将调整/有效期 | GRACE |
| 零售价 | ¥4,999 | - |
| 实付 | ¥4,499（含¥500代金券） | 449900分 |

## 技术架构
- 模拟验证：IS_MOCK=true，localStorage 替代数据库
- 上线：IS_MOCK=false + 云开发
- 品牌色：#6ec73b（XOLO绿）
- Logo：logo-bk.png（黑色版）

## 关键文件
- utils/constant.js — 状态码 + 文案映射
- utils/state-machine.js — 14状态流转 + 倒计时
- utils/mock-data.js — 模拟数据 CRUD + 统计
- utils/config.js — 金额/时间配置
- docs/XOLOme_X1_PRD.md — 完整PRD文档

## 开发原则
- 后端状态机 + 金额永远不变
- 仅修改用户端文案，内部注释保留旧术语
- WXML 必须使用 V2.1 文案，不含"意向金/大定/宽限期"
