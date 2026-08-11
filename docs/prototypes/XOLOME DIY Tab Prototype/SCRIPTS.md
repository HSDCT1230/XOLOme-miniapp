# DIY Figwright 脚本清单

## 日常入口（请用这些）

| 入口 | 位置 | 说明 |
|------|------|------|
| `node build-diy-flow.mjs` | `tools/figwright/`（shim） | 转发到本目录权威源 |
| `node polish-diy-ui.mjs` | `tools/figwright/`（shim） | 转发到本目录权威源 |
| `scripts/build-diy-flow.mjs` | **本目录（权威）** | 清空并重建 6 屏；读 `covers-v2` + `aigc-templates.json` |
| `scripts/polish-diy-ui.mjs` | **本目录（权威）** | 中文字体 / 边框 / 比例抛光 |

前置：Figwright Connected → `127.0.0.1:3055`（见 `CONNECT_PLUGIN.txt`）。

```bash
cd d:\cursoe_code\tools\figwright
npm i
node build-diy-flow.mjs
```

本目录 `scripts/node_modules` 为 junction → `tools/figwright/node_modules`（ESM 解析 `@msgpack/msgpack`）。**勿删除** `tools/figwright/package.json` / `node_modules` / `plugin/`。

## 工程运行时（留在 tools/figwright）

| 路径 | 原因 |
|------|------|
| `tools/figwright/node_modules/` | RPC 依赖 |
| `tools/figwright/plugin/` | Figma 插件 |
| `tools/figwright/package.json` | 本地桥接工程 |
| `tools/figwright/scripts/*.mjs` | 历史/一次性修补脚本（多数仍可用） |

## 历史 / 一次性脚本（`tools/figwright/scripts/`）

按主题归类；默认不必再跑，全量以 `build-diy-flow.mjs` 为准。

### 构建与校验

- `wait-and-rebuild-diy.mjs` / `watch-and-build.mjs` — 等待插件后重建
- `audit-diy-prototype.mjs` / `wire-and-verify-flow.mjs` — 审计与连线校验（含标签期望）
- `wire-mid-flow.mjs` / `wire-remaining-flow.mjs` — 中后段流程接线
- `build-diy-prototype.legacy.mjs` — 旧版构建（covers/）

### 首页瀑布流 / 封面

- `fix-home-covers.mjs` / `replace-covers.mjs` / `fix-cover-fit.mjs`
- `rebalance-waterfall.mjs` / `reorder-waterfall.mjs` / `polish-waterfall-density.mjs`
- `enable-home-scroll.mjs` / `patch-overflow.mjs`
- `add-adopted-templates.mjs` / `remove-travel.mjs` / `renumber-after-remove-couple.mjs`
- `replace-clay-dog.mjs` / `replace-weather.mjs` / `replace-hero-bg.mjs`
- `replace-blindbox-*.mjs` — 盲盒封面迭代

### 标签 / DIY 入口

- `add-template-tags.mjs` / `restyle-template-tags.mjs` / `restructure-tags.mjs` / `move-tags-top-right.mjs`
- `add-diy-preview.mjs` / `add-original-diy-entry.mjs` / `finish-original-diy-entry.mjs`
- `redesign-diy-entry.mjs` / `fix-diy-entry-banner.mjs` / `clean-diy-entry-copy.mjs`
- `restore-search-bar.mjs`

### 中后屏

- `polish-page02.mjs` / `fix-page04-06.mjs` / `fix-page05-actions.mjs`
- `fix-display-layout.mjs` / `wait-rebuild-display-fix.mjs`
- `fix-shadows.mjs` / `fix-shadows-v2.mjs` / `fix-diy-ui.mjs`
- `apply-user-updates.mjs`

### AIGC 飞书表

- `write-aigc-sheet.mjs` / `write-aigc-sheet-api.mjs`
- `sheet-values.json` / `sheet-put-body.json` / `sheet-clear-body.json`

> 上述脚本里部分仍写死 `…/diy-waterfall/…`。当前 `diy-waterfall` 与本目录资产通过 junction / 硬链兼容；新脚本请改读本目录路径。

## 路径约定

| 用途 | 权威路径 |
|------|----------|
| 原型包根 | `XOLOME DIY Tab Prototype/`（workspace 根，与 Miniapp / tools 同级） |
| 正式封面 | `…/covers-v2/`（junction → `diy-waterfall/covers-v2`） |
| AIGC JSON | `…/aigc-templates.json` |
| 兼容旧包路径 | `XOLOme-Miniapp/docs/prototypes/XOLOME DIY Tab Prototype/` → junction 回本目录 |
| 兼容旧根 | `…/diy-waterfall/`（资产实体仍在此；AIGC 硬链回本目录） |
