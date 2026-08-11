# XOLOME DIY Tab Prototype

DIY Tab 原型工程包：标签体系、六屏流程、AIGC 规格、封面素材与 Figwright 构建脚本。

## 为何放在这里

路径：`XOLOME DIY Tab Prototype/`（workspace 根目录，与 `XOLOme-Miniapp`、`tools` 同级）

- DIY 是小程序独立 Tab，工程包与小程序仓库平级，避免埋在 Miniapp docs 下
- 文件夹名与 Figma 文件一致，方便设计与工程对齐
- Figwright 运行时仍在 `tools/figwright/`（插件 + `node_modules`），此处放**规范与主构建脚本**

兼容：旧路径 `XOLOme-Miniapp/docs/prototypes/XOLOME DIY Tab Prototype/` 为 junction → 本目录。

## Figma

- 文件：[XOLOME DIY Tab Prototype](https://www.figma.com/design/FX6OEIxqZvFfNkNgytpTXr)
- 飞书 AIGC 表：https://ycn4bd3jvyxg.feishu.cn/wiki/VKxpwEsEQihXAbkm4OZctUg4nDe

## 快速重建

1. Figma Desktop 打开上述文件 → Plugins → Figwright → **Connected**（详见 `CONNECT_PLUGIN.txt`）
2. 在仓库执行：

```bash
cd tools/figwright
npm i
node build-diy-flow.mjs   # 全量重建 6 屏（shim → 本目录 scripts/）
node polish-diy-ui.mjs    # 轻量 UI 抛光
```

也可直接：

```bash
cd tools/figwright
set NODE_PATH=%CD%\node_modules
node "..\..\XOLOME DIY Tab Prototype\scripts\build-diy-flow.mjs"
```

## 目录结构

```
XOLOME DIY Tab Prototype/
  README.md                 # 本说明
  TAGS.md                   # 首页标签体系
  FEATURES.md               # 六屏流程与能力
  SCRIPTS.md                # 脚本清单与入口
  AIGC-PROMPT-SPEC.md       # AIGC 提示词规格（人读）
  aigc-templates.json       # AIGC 机器可读配置
  CONNECT_PLUGIN.txt        # Figwright 连接说明（副本）
  scripts/
    build-diy-flow.mjs      # 主构建（权威源）
    polish-diy-ui.mjs       # UI 抛光（权威源）
    node_modules/           # → junction → tools/figwright/node_modules
  covers-v2/                # → junction → diy-waterfall/covers-v2（正式封面）
  covers-v2/options/chaowan-previews/  # 潮玩 A/B 预览（勿删）
  assets/                   # → junction → diy-waterfall/assets
  covers/                   # → junction → 早期封面
  samples/                  # → junction → 风格样张
```

兼容路径：`XOLOme-Miniapp/docs/prototypes/diy-waterfall/` 仍保留资产实体与 AIGC 文件硬链/符号链接，旧脚本路径继续可用。

## 文档索引

| 文档 | 内容 |
|------|------|
| [TAGS.md](./TAGS.md) | 标签顺序、含义、模板映射 |
| [FEATURES.md](./FEATURES.md) | 01→06 流程屏能力 |
| [SCRIPTS.md](./SCRIPTS.md) | Figwright 脚本入口与历史脚本 |
| [AIGC-PROMPT-SPEC.md](./AIGC-PROMPT-SPEC.md) | 图生图 / 图生视频规格 |

## 约定摘要

- 画板宽 **390**；流程屏高 **844**；首页为可滚动长瀑布流
- 品牌绿 `#6ec73b`；中文字体 **Microsoft YaHei**
- **不画 Tab Bar**（由小程序底栏耦合）
- 首页入口：`真人全息动态`（通栏）+ **17** 个风格模板
