/**
 * Rebuild DIY prototype: numbered home templates + existing DIY flow (new UI style).
 * Requires Figwright plugin Connected.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { encode, decode } from '@msgpack/msgpack';
import { HUBS, allTemplates, replicaOf, stylizeOf } from '../hub-taxonomy.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Prototype root: …/XOLOME DIY Tab Prototype */
const PROTO_ROOT = join(__dirname, '..');
const COVER_DIR = join(PROTO_ROOT, 'covers-v2');
const AIGC_SPEC = JSON.parse(
  readFileSync(join(PROTO_ROOT, 'aigc-templates.json'), 'utf8'),
);
const RPC = 'http://127.0.0.1:3055/rpc';

/** Demo plays on page 04 — clay dog as default example; real app switches by template_id. */
const DEMO_PLAYS = (AIGC_SPEC.templates.find((t) => t.id === 'tpl_12_clay_dog')?.plays || []).map(
  (p) => p.name,
);

/** Flat list for counts / wiring helpers */
const TEMPLATES = allTemplates();
const COL_W = 181;

const C = {
  bg: { r: 0.965, g: 0.968, b: 0.975 },
  /** 首页暖石灰底，避免死白空洞 */
  homeBg: { r: 0.965, g: 0.962, b: 0.955 },
  white: { r: 1, g: 1, b: 1 },
  ink: { r: 0.12, g: 0.12, b: 0.14 },
  muted: { r: 0.55, g: 0.56, b: 0.6 },
  green: { r: 110 / 255, g: 199 / 255, b: 59 / 255 },
  soft: { r: 0.94, g: 0.945, b: 0.955 },
  line: { r: 0.9, g: 0.91, b: 0.93 },
  dark: { r: 0.12, g: 0.14, b: 0.13 },
  /** Cover placeholder before image load */
  dot: { r: 0.92, g: 0.925, b: 0.935 },
};

/** Top → bottom linear gradient (Figma affine). */
async function fillLinearVertical(nodeId, stops) {
  await rpc('set_fills', {
    nodeId,
    fills: [
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: stops,
        // Rotate default L→R into T→B
        gradientTransform: [
          [0, 1, 0],
          [-1, 0, 1],
        ],
      },
    ],
  });
}

async function rpc(toolName, args = {}) {
  const requestId = randomUUID();
  const body = encode({ requestId, toolName, args });
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/msgpack', host: '127.0.0.1:3055' },
    body,
  });
  const decoded = decode(Buffer.from(await res.arrayBuffer()));
  if (decoded.kind === 'err') throw new Error(`${toolName}: ${decoded.message}`);
  return decoded.result;
}

async function fill(id, color, opacity = 1) {
  await rpc('set_fills', { nodeId: id, fills: [{ type: 'SOLID', color, opacity }] });
}

async function shadow(id, y = 8, r = 24, a = 0.08) {
  await rpc('set_effects', {
    nodeId: id,
    effects: [{
      type: 'DROP_SHADOW',
      visible: true,
      radius: r,
      color: { r: 0, g: 0, b: 0, a },
      offset: { x: 0, y },
      spread: 0,
    }],
  });
}

async function text(parentId, characters, { size = 14, style = 'Regular', color = C.ink } = {}) {
  const t = await rpc('create_text', { parentId, characters });
  // Inter 对中文显示不佳；微软雅黑仅 Regular/Bold
  const yahei = style === 'Bold' || style === 'Semi Bold' ? 'Bold' : 'Regular';
  await rpc('set_text_properties', {
    nodeId: t.nodeId,
    fontSize: size,
    fontName: { family: 'Microsoft YaHei', style: yahei },
    lineHeight: { unit: 'PERCENT', value: 140 },
  });
  await fill(t.nodeId, color);
  return t.nodeId;
}

/** Figwright create_frame defaults to 100×100; FIXED sizing can snap back to 100 — always re-assert. */
async function size(nodeId, width, height) {
  await rpc('resize_nodes', { nodeIds: [nodeId], width, height });
}

/** Lock width only; keep/reassert vertical HUG so card content is not crushed to a fixed short height. */
async function sizeWidthHug(nodeId, width) {
  const n = await rpc('get_node', { nodeId });
  const h = Math.max(40, n.node?.height || 120);
  await rpc('resize_nodes', { nodeIds: [nodeId], width, height: h });
  await rpc('set_layout_props', {
    nodeId,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'HUG',
  });
}

function b64(file) {
  return readFileSync(join(COVER_DIR, file)).toString('base64');
}

function imageAspect(file) {
  const buf = readFileSync(join(COVER_DIR, file));
  // PNG
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    if (w > 0 && h > 0 && w < 100000 && h < 100000) return w / h;
  }
  // JPEG (also catch misnamed .png that is actually JPEG)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      // SOF0/1/2
      if (marker >= 0xc0 && marker <= 0xc3) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        if (w > 0 && h > 0) return w / h;
      }
      i += 2 + len;
    }
  }
  return 3 / 4;
}

/** @deprecated use imageAspect — kept name for call sites */
function pngAspect(file) {
  return imageAspect(file);
}

/**
 * Cover the wrap completely (object-fit: cover):
 * image rect fills wrap (+ slight overscan), scaleMode FILL — no letterbox gaps.
 */
async function placeFittedImage({ parentId, name, file, wrapW, wrapH, bleed = 3, bleedBottom }) {
  // Slight bleed so rounded card corners never reveal wrap fill as a “photo edge”
  // bleedBottom defaults to bleed; set 0 for hub banners so feet aren't clipped
  const b = bleed;
  const bb = bleedBottom === undefined ? bleed : bleedBottom;
  const iw = Math.max(1, Math.round(wrapW + b * 2));
  const ih = Math.max(1, Math.round(wrapH + b + bb));
  const x = -b;
  const y = -b;
  const img = await rpc('import_image', {
    data: b64(file),
    name,
    parentId,
    width: iw,
    height: ih,
    scaleMode: 'FILL',
    x,
    y,
  });
  for (let i = 0; i < 2; i++) {
    await rpc('resize_nodes', { nodeIds: [img.nodeId], width: iw, height: ih });
    await rpc('set_position', { nodeId: img.nodeId, x, y });
  }
  return img.nodeId;
}

/**
 * Show full subject inside wrap (object-fit: contain) — for 复刻示意图需露全身/全貌.
 * Inset padding keeps feet/head clear of rounded-corner clipping.
 */
async function placeContainImage({ parentId, name, file, wrapW, wrapH, inset = 8 }) {
  const aspect = imageAspect(file);
  const maxW = Math.max(1, wrapW - inset * 2);
  const maxH = Math.max(1, wrapH - inset * 2);
  let iw = maxW;
  let ih = maxW / aspect;
  if (ih > maxH) {
    ih = maxH;
    iw = maxH * aspect;
  }
  iw = Math.max(1, Math.round(iw));
  ih = Math.max(1, Math.round(ih));
  const x = Math.round((wrapW - iw) / 2);
  const y = Math.round((wrapH - ih) / 2);
  const img = await rpc('import_image', {
    data: b64(file),
    name,
    parentId,
    width: iw,
    height: ih,
    scaleMode: 'FILL',
    x,
    y,
  });
  for (let i = 0; i < 2; i++) {
    await rpc('resize_nodes', { nodeIds: [img.nodeId], width: iw, height: ih });
    await rpc('set_position', { nodeId: img.nodeId, x, y });
  }
  return img.nodeId;
}

async function phone(name, index) {
  // Space screens horizontally so they never overlap (390 + 60 gap)
  const x = index * (390 + 60);
  const f = await rpc('create_frame', { name, x, y: 0, width: 390, height: 844 });
  await fill(f.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: f.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', {
    nodeId: f.nodeId,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
  });
  await size(f.nodeId, 390, 844);
  return f.nodeId;
}

/** Shared back-to-home control used across upload + mid-flow screens */
async function makeBackHome(parentId, label = '‹ 首页') {
  const back = await rpc('create_frame', { name: 'Back/首页', parentId });
  await rpc('set_fills', { nodeId: back.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: back.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 4,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  });
  await rpc('set_layout_props', {
    nodeId: back.nodeId,
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'HUG',
  });
  await text(back.nodeId, label, { size: 15, style: 'Medium', color: C.green });
  return back.nodeId;
}

async function waitPlugin() {
  for (let i = 0; i < 90; i++) {
    try {
      const j = await (await fetch('http://127.0.0.1:3055/ping')).json();
      if (j.plugins > 0) return j;
      // Also try a cheap RPC — some sessions report plugins:0 while still writable
      if (i > 0 && i % 5 === 0) {
        const requestId = randomUUID();
        const body = encode({ requestId, toolName: 'get_document', args: {} });
        const res = await fetch(RPC, {
          method: 'POST',
          headers: { 'content-type': 'application/msgpack' },
          body,
          signal: AbortSignal.timeout(8000),
        });
        const decoded = decode(Buffer.from(await res.arrayBuffer()));
        if (decoded.kind !== 'err') return j;
      }
    } catch {
      /* keep waiting */
    }
    if (i % 10 === 0) console.log(`Waiting for Figwright Connected… (${i}s)`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('plugin not connected — open Figma → Plugins → Figwright → Connected');
}

/** Level-1：三大类入口 — 上图下文，图片满铺；文案区精简（无短横线/类目标签） */
async function createHubCard(parentId, hub, panelH) {
  const W = 358;
  const H = panelH;
  const INFO_H = 58;
  const MEDIA_H = Math.max(120, H - INFO_H);

  const diy = await rpc('create_frame', {
    name: `Hub/${hub.id} ${hub.name}`,
    parentId,
    width: W,
    height: H,
  });
  await fill(diy.nodeId, C.white);
  await rpc('set_corner_radius', { nodeId: diy.nodeId, radius: 18 });
  await rpc('set_auto_layout', {
    nodeId: diy.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', {
    nodeId: diy.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
  });
  await size(diy.nodeId, W, H);
  await shadow(diy.nodeId, 4, 16, 0.05);

  const cover = await rpc('create_frame', {
    name: `CoverWrap/Hub/${hub.id}`,
    parentId: diy.nodeId,
    width: W,
    height: MEDIA_H,
  });
  // Match hub-banner studio field (~247/255) so any subpixel gap isn't a grey plate edge
  await fill(cover.nodeId, { r: 0.968, g: 0.968, b: 0.965 });
  await rpc('set_auto_layout', { nodeId: cover.nodeId, layoutMode: 'NONE' });
  await rpc('set_layout_props', {
    nodeId: cover.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
  });
  await size(cover.nodeId, W, MEDIA_H);
  // 首页入口：资源已预合成满幅横图（全身含脚 + 棚拍侧填），FILL 满铺；底边不 bleed 以免裁脚
  await placeFittedImage({
    parentId: cover.nodeId,
    name: `Cover/Hub/${hub.id}`,
    file: hub.cover,
    wrapW: W,
    wrapH: MEDIA_H,
    bleedBottom: 0,
  });

  const info = await rpc('create_frame', {
    name: 'HubInfo',
    parentId: diy.nodeId,
    height: INFO_H,
  });
  await fill(info.nodeId, { r: 0.97, g: 0.985, b: 0.96 });
  await rpc('set_auto_layout', {
    nodeId: info.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 14,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    itemSpacing: 10,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: info.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
  });
  await size(info.nodeId, W, INFO_H);

  const left = await rpc('create_frame', { name: 'HubText', parentId: info.nodeId });
  await rpc('set_fills', { nodeId: left.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: left.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 2,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', {
    nodeId: left.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });

  // 精简：去掉「短横线 + 真人/宠物/玩具」类目标签行
  await text(left.nodeId, hub.name, { size: 16, style: 'Bold' });
  {
    const sub = await text(left.nodeId, hub.blurb, { size: 11, color: C.muted });
    try {
      await rpc('set_layout_props', {
        nodeId: sub,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
      });
      await rpc('set_text_properties', { nodeId: sub, textAutoResize: 'HEIGHT' });
    } catch {
      /* optional */
    }
  }

  const cta = await rpc('create_frame', {
    name: `CTA/Hub/${hub.id}`,
    parentId: info.nodeId,
    height: 30,
  });
  await fill(cta.nodeId, C.white);
  await rpc('set_strokes', {
    nodeId: cta.nodeId,
    strokes: [{ type: 'SOLID', color: C.green, opacity: 0.55 }],
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
  });
  await rpc('set_corner_radius', { nodeId: cta.nodeId, radius: 15 });
  await rpc('set_auto_layout', {
    nodeId: cta.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 12,
    paddingRight: 12,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: cta.nodeId,
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'FIXED',
  });
  await size(cta.nodeId, 84, 30);
  await text(cta.nodeId, hub.cta || '玩一下', { size: 12, style: 'Bold', color: C.green });

  return diy.nodeId;
}


/** Level-2：首位突出「复刻」+ 下方变身风格瀑布流 */
async function buildHubWaterfallPage(hub, index) {
  const replica = replicaOf(hub);
  const styles = stylizeOf(hub);
  const page = await phone(`01${hub.id === 'person' ? 'a' : hub.id === 'pet' ? 'b' : 'c'} ${hub.name}·风格`, index);
  const nav = await rpc('create_frame', { name: 'Nav', parentId: page, height: 48 });
  await fill(nav.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: nav.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 16,
    paddingRight: 16,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: nav.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
  });
  await size(nav.nodeId, 390, 48);
  const back = await rpc('create_frame', { name: 'Back/首页', parentId: nav.nodeId });
  await rpc('set_fills', { nodeId: back.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: back.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 4,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
  });
  await rpc('set_layout_props', {
    nodeId: back.nodeId,
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'HUG',
  });
  await text(back.nodeId, '‹ 首页', { size: 15, style: 'Medium', color: C.green });
  await text(nav.nodeId, hub.tag, { size: 15, style: 'Semi Bold' });

  const head = await rpc('create_frame', { name: 'Header', parentId: page, width: 390 });
  await fill(head.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: head.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 8,
    itemSpacing: 4,
  });
  await rpc('set_layout_props', {
    nodeId: head.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(head.nodeId, hub.name, { size: 22, style: 'Bold' });
  await text(head.nodeId, '快来试玩魔法变身术吧', { size: 12, color: C.muted });

  const body = await rpc('create_frame', { name: 'Body', parentId: page, width: 390 });
  await fill(body.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: body.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 28,
    itemSpacing: 12,
  });
  await rpc('set_layout_props', {
    nodeId: body.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
    layoutAlign: 'STRETCH',
  });

  // ── 突出的复刻入口（二级页第一位）──
  const feat = await rpc('create_frame', {
    name: `Replica/${hub.id} ${replica.name}`,
    parentId: body.nodeId,
    width: 370,
  });
  await fill(feat.nodeId, { r: 0.96, g: 0.985, b: 0.95 });
  await rpc('set_corner_radius', { nodeId: feat.nodeId, radius: 18 });
  await rpc('set_strokes', {
    nodeId: feat.nodeId,
    strokes: [{ type: 'SOLID', color: C.green, opacity: 0.6 }],
    strokeWeight: 1.5,
    strokeAlign: 'INSIDE',
  });
  await shadow(feat.nodeId, 4, 16, 0.08);
  await rpc('set_auto_layout', {
    nodeId: feat.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 12,
    itemSpacing: 14,
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: feat.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });

  const rCover = await rpc('create_frame', {
    name: `CoverWrap/Replica/${hub.id}`,
    parentId: feat.nodeId,
    width: 112,
    height: 168,
  });
  await fill(rCover.nodeId, C.white);
  await rpc('set_corner_radius', { nodeId: rCover.nodeId, radius: 14 });
  await rpc('set_auto_layout', { nodeId: rCover.nodeId, layoutMode: 'NONE' });
  await rpc('set_layout_props', {
    nodeId: rCover.nodeId,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
  });
  await size(rCover.nodeId, 112, 168);
  // 复刻示意图：contain 保证全身/全貌（脚）可见
  await placeContainImage({
    parentId: rCover.nodeId,
    name: `Cover/Replica/${hub.id}`,
    file: replica.file,
    wrapW: 112,
    wrapH: 168,
    inset: 4,
  });
  const rBadge = await rpc('create_frame', { name: 'Badge/复刻', parentId: rCover.nodeId });
  await fill(rBadge.nodeId, C.green);
  await rpc('set_corner_radius', { nodeId: rBadge.nodeId, radius: 8 });
  await rpc('set_auto_layout', {
    nodeId: rBadge.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 3,
    paddingBottom: 3,
  });
  await rpc('set_layout_props', {
    nodeId: rBadge.nodeId,
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'HUG',
  });
  await text(rBadge.nodeId, '复刻', { size: 10, style: 'Semi Bold', color: C.white });
  await rpc('set_position', { nodeId: rBadge.nodeId, x: 8, y: 8 });

  const rInfo = await rpc('create_frame', { name: 'ReplicaInfo', parentId: feat.nodeId });
  await rpc('set_fills', { nodeId: rInfo.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: rInfo.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 8,
  });
  await rpc('set_layout_props', {
    nodeId: rInfo.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  // 页头保留「XX全息动态」；复刻大卡：真人用「原比例全息动态」，其余仍用 hub.name
  await text(rInfo.nodeId, hub.id === 'person' ? '原比例全息动态' : hub.name, {
    size: 20,
    style: 'Bold',
  });
  {
    const sub = await text(rInfo.nodeId, hub.replicaBlurb || '白底轻轻落一影，原模原样还是你，先不玩变身哦', {
      size: 12,
      color: C.muted,
    });
    try {
      await rpc('set_layout_props', {
        nodeId: sub,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
      });
      await rpc('set_text_properties', { nodeId: sub, textAutoResize: 'HEIGHT' });
    } catch {
      /* optional */
    }
  }
  const rCta = await rpc('create_frame', {
    name: `CTA/Replica/${hub.id}`,
    parentId: rInfo.nodeId,
    height: 32,
  });
  await fill(rCta.nodeId, C.white);
  await rpc('set_strokes', {
    nodeId: rCta.nodeId,
    strokes: [{ type: 'SOLID', color: C.green, opacity: 0.5 }],
    strokeWeight: 1,
    strokeAlign: 'INSIDE',
  });
  await rpc('set_corner_radius', { nodeId: rCta.nodeId, radius: 16 });
  await rpc('set_auto_layout', {
    nodeId: rCta.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 14,
    paddingRight: 14,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: rCta.nodeId,
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'FIXED',
  });
  await size(rCta.nodeId, 96, 32);
  await text(rCta.nodeId, '立即复刻', { size: 13, style: 'Medium', color: C.green });

  // ── 变身风格瀑布流 ──
  const sec = await rpc('create_frame', { name: 'Section', parentId: body.nodeId });
  await fill(sec.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: sec.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: sec.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(sec.nodeId, '变身风格', { size: 18, style: 'Bold' });
  // 不展示模板数量 / 箭头

  const grid = await rpc('create_frame', { name: 'Waterfall', parentId: body.nodeId });
  await fill(grid.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: grid.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 8,
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', {
    nodeId: grid.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });

  const colL = await rpc('create_frame', { name: 'Col L', parentId: grid.nodeId, width: COL_W });
  const colR = await rpc('create_frame', { name: 'Col R', parentId: grid.nodeId, width: COL_W });
  for (const col of [colL, colR]) {
    await fill(col.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: col.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
    });
    await rpc('set_layout_props', {
      nodeId: col.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
    });
    await size(col.nodeId, COL_W, 100);
  }

  for (let i = 0; i < styles.length; i++) {
    const tpl = styles[i];
    const col = i % 2 === 0 ? colL : colR;
    const card = await rpc('create_frame', {
      name: `Card/${hub.id}/${tpl.n} ${tpl.name}`,
      parentId: col.nodeId,
      width: COL_W,
    });
    await fill(card.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: card.nodeId, radius: 16 });
    await shadow(card.nodeId, 3, 12, 0.06);
    await rpc('set_auto_layout', {
      nodeId: card.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
    });
    await rpc('set_layout_props', {
      nodeId: card.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
      clipsContent: true,
    });
    await sizeWidthHug(card.nodeId, COL_W);

    const coverWrap = await rpc('create_frame', {
      name: `CoverWrap/${tpl.n}`,
      parentId: card.nodeId,
      width: COL_W,
      height: tpl.h,
    });
    await fill(coverWrap.nodeId, C.white);
    await rpc('set_auto_layout', { nodeId: coverWrap.nodeId, layoutMode: 'NONE' });
    await rpc('set_layout_props', {
      nodeId: coverWrap.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(coverWrap.nodeId, COL_W, tpl.h);
    // 瀑布流封面默认 contain，避免 FILL 裁掉头脚/物件导致「显示不全」
    if (tpl.fit === 'cover') {
      await placeFittedImage({
        parentId: coverWrap.nodeId,
        name: `Cover/${tpl.n}`,
        file: tpl.file,
        wrapW: COL_W,
        wrapH: tpl.h,
      });
    } else {
      await placeContainImage({
        parentId: coverWrap.nodeId,
        name: `Cover/${tpl.n}`,
        file: tpl.file,
        wrapW: COL_W,
        wrapH: tpl.h,
        inset: 6,
      });
    }

    const badge = await rpc('create_frame', {
      name: 'Badge/变身',
      parentId: coverWrap.nodeId,
    });
    await fill(badge.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: badge.nodeId, radius: 8 });
    await rpc('set_auto_layout', {
      nodeId: badge.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
    });
    await rpc('set_layout_props', {
      nodeId: badge.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(badge.nodeId, '变身', {
      size: 10,
      style: 'Semi Bold',
      color: C.green,
    });
    {
      const b = await rpc('get_node', { nodeId: badge.nodeId });
      const tw = b.node?.width ?? 36;
      await rpc('set_position', {
        nodeId: badge.nodeId,
        x: Math.max(8, COL_W - tw - 8),
        y: 8,
      });
    }

    const meta = await rpc('create_frame', { name: 'Meta', parentId: card.nodeId });
    await fill(meta.nodeId, C.white);
    await rpc('set_auto_layout', {
      nodeId: meta.nodeId,
      layoutMode: 'VERTICAL',
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 12,
      itemSpacing: 2,
    });
    await rpc('set_layout_props', {
      nodeId: meta.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    await text(meta.nodeId, tpl.n, { size: 11, style: 'Semi Bold', color: C.green });
    {
      const titleId = await text(meta.nodeId, tpl.name, { size: 13, style: 'Medium' });
      try {
        await rpc('set_layout_props', {
          nodeId: titleId,
          layoutSizingHorizontal: 'FILL',
          layoutSizingVertical: 'HUG',
        });
        await rpc('set_text_properties', {
          nodeId: titleId,
          textAutoResize: 'HEIGHT',
        });
      } catch {
        /* optional */
      }
    }

    await sizeWidthHug(card.nodeId, COL_W);
    await rpc('set_layout_props', {
      nodeId: card.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
      clipsContent: true,
    });
    await size(coverWrap.nodeId, COL_W, tpl.h);
  }

  await sizeWidthHug(colL.nodeId, COL_W);
  await sizeWidthHug(colR.nodeId, COL_W);

  await rpc('set_layout_props', {
    nodeId: page,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'HUG',
    clipsContent: false,
    overflowDirection: 'NONE',
    numberOfFixedChildren: 0,
  });
  const letter = hub.id === 'person' ? 'a' : hub.id === 'pet' ? 'b' : 'c';
  await rpc('rename_node', { nodeId: page, name: `01${letter} ${hub.name}·风格（全高）` }).catch(() => {});

  const pageAfter = (await rpc('get_node', { nodeId: page })).node;
  const phonePv = await rpc('create_frame', {
    name: `01${letter} 手机预览·${hub.tag}`,
    x: index * (390 + 60),
    y: Math.max(2400, (pageAfter?.height || 900) + 80),
    width: 390,
    height: 844,
  });
  await fill(phonePv.nodeId, C.bg);
  await rpc('set_auto_layout', { nodeId: phonePv.nodeId, layoutMode: 'VERTICAL', itemSpacing: 0 });
  await rpc('set_layout_props', {
    nodeId: phonePv.nodeId,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
    overflowDirection: 'VERTICAL',
    numberOfFixedChildren: 0,
  });
  await size(phonePv.nodeId, 390, 844);
  const cloned = await rpc('clone_node', { nodeId: page });
  await rpc('rename_node', { nodeId: cloned.nodeId, name: `HubScroll/${hub.id}` });
  await rpc('reparent_nodes', { nodeIds: [cloned.nodeId], newParentId: phonePv.nodeId });
  await rpc('set_layout_props', {
    nodeId: cloned.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
    clipsContent: false,
    overflowDirection: 'NONE',
    numberOfFixedChildren: 0,
  });

  return { designId: page, phoneId: phonePv.nodeId };
}

async function main() {
  console.log('Waiting…');
  await waitPlugin();

  // Clear old top-level frames
  const doc = await rpc('get_document', {});
  const old = (doc.children || []).filter((c) => c.type === 'FRAME').map((c) => c.id);
  if (old.length) await rpc('delete_nodes', { nodeIds: old });

  // ═══════════ 01 首页 · 三大类入口（全屏影像，简约高级） ═══════════
  const HOME_H = 844;
  const home = await phone('01 首页·三大类', 0);
  await fillLinearVertical(home, [
    { position: 0, color: { r: 0.975, g: 0.978, b: 0.97, a: 1 } },
    { position: 0.35, color: { r: 0.965, g: 0.968, b: 0.96, a: 1 } },
    { position: 1, color: { r: 0.945, g: 0.95, b: 0.94, a: 1 } },
  ]);

  const hHead = await rpc('create_frame', { name: 'Header', parentId: home, width: 390 });
  await rpc('set_fills', { nodeId: hHead.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: hHead.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 18,
    paddingBottom: 12,
    itemSpacing: 6,
  });
  await rpc('set_layout_props', {
    nodeId: hHead.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(hHead.nodeId, 'XOLOME', {
    size: 11,
    style: 'Bold',
    color: C.green,
  });
  await text(hHead.nodeId, '开始创作', { size: 26, style: 'Bold' });
  await text(hHead.nodeId, '选原图类型，进入复刻或变身', {
    size: 13,
    color: C.muted,
  });

  const headAfter = (await rpc('get_node', { nodeId: hHead.nodeId })).node;
  const headH = Math.min(140, Math.max(72, headAfter?.height || 96));

  const bodyPadY = 8 + 10;
  const gap = 10;
  const panelH = Math.max(
    190,
    Math.floor((HOME_H - headH - bodyPadY - gap * 2) / 3),
  );
  console.log('home panelH', panelH, 'headH', headH);

  const body = await rpc('create_frame', { name: 'Body', parentId: home, width: 390 });
  await rpc('set_fills', { nodeId: body.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: body.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 10,
    itemSpacing: gap,
  });
  await rpc('set_layout_props', {
    nodeId: body.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
    layoutAlign: 'STRETCH',
  });

  for (const hub of HUBS) {
    await createHubCard(body.nodeId, hub, panelH);
  }

  await rpc('set_layout_props', {
    nodeId: home,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
    overflowDirection: 'NONE',
    numberOfFixedChildren: 0,
  });
  await size(home, 390, HOME_H);
  await rpc('rename_node', { nodeId: home, name: '01 首页·三大类（全高）' }).catch(() => {});

  {
    const phonePv = await rpc('create_frame', {
      name: '01 手机预览·可滚动',
      x: 9 * (390 + 60) + 80,
      y: 0,
      width: 390,
      height: 844,
    });
    await fill(phonePv.nodeId, C.homeBg);
    await rpc('set_auto_layout', { nodeId: phonePv.nodeId, layoutMode: 'VERTICAL', itemSpacing: 0 });
    await rpc('set_layout_props', {
      nodeId: phonePv.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
      overflowDirection: 'VERTICAL',
      numberOfFixedChildren: 0,
    });
    await size(phonePv.nodeId, 390, 844);
    const cloned = await rpc('clone_node', { nodeId: home });
    await rpc('rename_node', { nodeId: cloned.nodeId, name: 'HomeScrollContent' });
    await rpc('reparent_nodes', { nodeIds: [cloned.nodeId], newParentId: phonePv.nodeId });
    await rpc('set_layout_props', {
      nodeId: cloned.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
      overflowDirection: 'NONE',
      numberOfFixedChildren: 0,
    });
    await size(cloned.nodeId, 390, HOME_H);
    console.log('home hubs', HOME_H, '+ phone', phonePv.nodeId);
  }

  // ═══════════ 01a/b/c 二级风格瀑布流 ═══════════
  const hubPages = {};
  for (let i = 0; i < HUBS.length; i++) {
    hubPages[HUBS[i].id] = await buildHubWaterfallPage(HUBS[i], i + 1);
  }

  // ═══════════ 03a/b/c 上传照片（按三大类分屏） ═══════════
  const UPLOAD_GUIDE = {
    person: 'guide-person.png',
    pet: 'guide-pet.png',
    toy: 'guide-toy.png',
  };
  const uploadPages = {};
  for (let ui = 0; ui < HUBS.length; ui++) {
    const hub = HUBS[ui];
    const letter = hub.id === 'person' ? 'a' : hub.id === 'pet' ? 'b' : 'c';
    const s2 = await phone(`03${letter} DIY·上传照片·${hub.tag}`, 4 + ui);
    const n2 = await rpc('create_frame', { name: 'Nav', parentId: s2, height: 48 });
    await fill(n2.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: n2.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 20,
      paddingRight: 20,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: n2.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
    });
    await size(n2.nodeId, 390, 48);
    await makeBackHome(n2.nodeId);
    await text(n2.nodeId, 'AI 趣味创作', { size: 17, style: 'Bold' });
    await text(n2.nodeId, hub.tag, { size: 14, style: 'Medium', color: C.green });

    const hero = await rpc('create_frame', { name: 'Hero', parentId: s2, height: 120 });
    await fill(hero.nodeId, { r: 0.98, g: 0.975, b: 0.97 });
    await rpc('set_auto_layout', {
      nodeId: hero.nodeId,
      layoutMode: 'VERTICAL',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 20,
      paddingBottom: 22,
      itemSpacing: 8,
      primaryAxisAlignItems: 'MIN',
    });
    await rpc('set_layout_props', {
      nodeId: hero.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    {
      const heroBgPath = join(PROTO_ROOT, 'assets', 'diy-hero-bg.png');
      const bg = await rpc('import_image', {
        name: 'HeroBg',
        data: readFileSync(heroBgPath).toString('base64'),
        width: 390,
        height: 140,
        scaleMode: 'FILL',
      });
      await rpc('reparent_nodes', { nodeIds: [bg.nodeId], newParentId: hero.nodeId, index: 0 });
      await rpc('set_layout_props', {
        nodeId: bg.nodeId,
        layoutPositioning: 'ABSOLUTE',
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await rpc('set_position', { nodeId: bg.nodeId, x: 0, y: 0 });
      await size(bg.nodeId, 390, 140);
      const wash = await rpc('create_frame', {
        name: 'HeroWash',
        parentId: hero.nodeId,
        width: 390,
        height: 140,
      });
      await rpc('set_fills', {
        nodeId: wash.nodeId,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 0.35 }],
      });
      await rpc('set_layout_props', {
        nodeId: wash.nodeId,
        layoutPositioning: 'ABSOLUTE',
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await rpc('set_position', { nodeId: wash.nodeId, x: 0, y: 0 });
      await rpc('reorder_nodes', { nodeIds: [wash.nodeId], index: 1 });
    }
    await text(hero.nodeId, 'XOLOMe Lab', { size: 12, style: 'Medium', color: C.green });
    await text(hero.nodeId, '把照片变成一段温暖的故事', {
      size: 20,
      style: 'Bold',
      color: { r: 0.16, g: 0.15, b: 0.14 },
    });
    // 原版文案（三大类共用）
    await text(hero.nodeId, '选一张光线柔和、主体清晰的照片，开始创作', {
      size: 12,
      color: { r: 0.42, g: 0.4, b: 0.38 },
    });

    const steps2 = await rpc('create_frame', { name: 'Steps', parentId: s2, height: 72 });
    await fill(steps2.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: steps2.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 24,
      paddingRight: 24,
      paddingTop: 14,
      paddingBottom: 14,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: steps2.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    for (const [lab, on] of [
      ['1 上传照片', true],
      ['2 制作抽卡素材', false],
      ['3 制作动态卡片', false],
    ]) {
      const st = await rpc('create_frame', { name: lab, parentId: steps2.nodeId });
      await rpc('set_fills', { nodeId: st.nodeId, fills: [] });
      await rpc('set_auto_layout', {
        nodeId: st.nodeId,
        layoutMode: 'VERTICAL',
        itemSpacing: 4,
        counterAxisAlignItems: 'CENTER',
      });
      const dot = await rpc('create_frame', { name: 'dot', parentId: st.nodeId, width: 28, height: 28 });
      await fill(dot.nodeId, on ? C.green : C.soft);
      await rpc('set_corner_radius', { nodeId: dot.nodeId, radius: 14 });
      await rpc('set_auto_layout', {
        nodeId: dot.nodeId,
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
      });
      await rpc('set_layout_props', {
        nodeId: dot.nodeId,
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await size(dot.nodeId, 28, 28);
      await text(dot.nodeId, lab[0], {
        size: 13,
        style: 'Semi Bold',
        color: on ? C.white : C.muted,
      });
      await rpc('set_layout_props', {
        nodeId: dot.nodeId,
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await size(dot.nodeId, 28, 28);
      await text(st.nodeId, lab.slice(2), { size: 11, color: on ? C.ink : C.muted });
      await rpc('set_layout_props', {
        nodeId: st.nodeId,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
      });
    }

    const b2 = await rpc('create_frame', { name: 'Body', parentId: s2 });
    await fill(b2.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: b2.nodeId,
      layoutMode: 'VERTICAL',
      paddingLeft: 20,
      paddingRight: 20,
      paddingTop: 8,
      paddingBottom: 16,
      itemSpacing: 12,
    });
    await rpc('set_layout_props', { nodeId: b2.nodeId, layoutGrow: 1, layoutAlign: 'STRETCH' });

    // 拍摄示意图
    const guide = await rpc('create_frame', {
      name: `Guide/${hub.id}`,
      parentId: b2.nodeId,
    });
    await fill(guide.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: guide.nodeId, radius: 16 });
    await shadow(guide.nodeId, 3, 12, 0.05);
    await rpc('set_auto_layout', {
      nodeId: guide.nodeId,
      layoutMode: 'VERTICAL',
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      itemSpacing: 8,
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: guide.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    await text(guide.nodeId, '拍摄示意图', { size: 12, style: 'Semi Bold', color: C.muted });
    const guideWrap = await rpc('create_frame', {
      name: `GuideWrap/${hub.id}`,
      parentId: guide.nodeId,
      width: 200,
      height: 240,
    });
    await fill(guideWrap.nodeId, { r: 0, g: 0, b: 0 });
    await rpc('set_corner_radius', { nodeId: guideWrap.nodeId, radius: 12 });
    await rpc('set_auto_layout', { nodeId: guideWrap.nodeId, layoutMode: 'NONE' });
    await rpc('set_layout_props', {
      nodeId: guideWrap.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(guideWrap.nodeId, 200, 240);
    // 拍摄示意图：全身 contain；留 inset 避开圆角裁脚/头；黑底与示意黑框融合
    // 对焦准星已烘焙进 guide-*.png（源图绿十字会先 strip，避免重复）
    await placeContainImage({
      parentId: guideWrap.nodeId,
      name: `GuideImg/${hub.id}`,
      file: UPLOAD_GUIDE[hub.id],
      wrapW: 200,
      wrapH: 240,
      inset: 10,
    });
    const upload = await rpc('create_frame', {
      name: `Upload/${hub.id}`,
      parentId: b2.nodeId,
      height: 160,
    });
    await fill(upload.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: upload.nodeId, radius: 20 });
    await shadow(upload.nodeId, 4, 16, 0.05);
    await rpc('set_strokes', {
      nodeId: upload.nodeId,
      strokes: [{ type: 'SOLID', color: C.green, opacity: 0.55 }],
      strokeWeight: 1.5,
      dashPattern: [7, 5],
    });
    await rpc('set_auto_layout', {
      nodeId: upload.nodeId,
      layoutMode: 'VERTICAL',
      paddingTop: 22,
      paddingBottom: 22,
      paddingLeft: 20,
      paddingRight: 20,
      itemSpacing: 8,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: upload.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    {
      const icon = await rpc('create_frame', {
        name: 'UploadIcon',
        parentId: upload.nodeId,
        width: 44,
        height: 44,
      });
      await fill(icon.nodeId, { r: 0.93, g: 0.97, b: 0.9 });
      await rpc('set_corner_radius', { nodeId: icon.nodeId, radius: 22 });
      await rpc('set_auto_layout', {
        nodeId: icon.nodeId,
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
      });
      await rpc('set_layout_props', {
        nodeId: icon.nodeId,
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await size(icon.nodeId, 44, 44);
      await text(icon.nodeId, '上传', { size: 12, style: 'Semi Bold', color: C.green });
    }
    // 原版文案
    await text(upload.nodeId, '上传一张主体完整的清晰照片', { size: 15, style: 'Semi Bold' });
    await text(upload.nodeId, '推荐 9:16 竖版，主体完整入镜、光线充足', {
      size: 12,
      color: C.muted,
    });

    const row = await rpc('create_frame', { name: 'Actions', parentId: b2.nodeId });
    await fill(row.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: row.nodeId,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 12,
    });
    await rpc('set_layout_props', {
      nodeId: row.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    for (const [lab, solid] of [
      ['拍照', true],
      ['从相册选择', false],
    ]) {
      const btn = await rpc('create_frame', {
        name: `${lab}/${hub.id}`,
        parentId: row.nodeId,
        height: 48,
      });
      await fill(btn.nodeId, solid ? C.green : C.white);
      await rpc('set_corner_radius', { nodeId: btn.nodeId, radius: 24 });
      if (!solid) {
        await rpc('set_strokes', {
          nodeId: btn.nodeId,
          strokes: [{ type: 'SOLID', color: C.green }],
          strokeWeight: 1.5,
        });
      } else await shadow(btn.nodeId, 6, 16, 0.12);
      await rpc('set_auto_layout', {
        nodeId: btn.nodeId,
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
      });
      await rpc('set_layout_props', {
        nodeId: btn.nodeId,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'FIXED',
      });
      await size(btn.nodeId, 167, 48);
      await text(btn.nodeId, lab, {
        size: 15,
        style: 'Semi Bold',
        color: solid ? C.white : C.green,
      });
    }

    const notice = await rpc('create_frame', { name: 'Notice', parentId: b2.nodeId });
    await fill(notice.nodeId, { r: 0.93, g: 0.97, b: 0.9 });
    await rpc('set_corner_radius', { nodeId: notice.nodeId, radius: 12 });
    await rpc('set_auto_layout', {
      nodeId: notice.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
    });
    await rpc('set_layout_props', {
      nodeId: notice.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    await text(notice.nodeId, '照片仅用于生成本次创意图片和动态卡片', {
      size: 11,
      color: C.muted,
    });

    uploadPages[hub.id] = s2;
  }
  const s2 = uploadPages.person;

  // ═══════════ 04 制作抽卡 / 首帧候选 ═══════════
  const s3 = await phone('04 DIY·首帧候选', 7);
  const n3 = await rpc('create_frame', { name: 'Nav', parentId: s3, height: 48 });
  await fill(n3.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: n3.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 20,
    paddingRight: 20,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', { nodeId: n3.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED' });
  await size(n3.nodeId, 390, 48);
  await makeBackHome(n3.nodeId);
  await text(n3.nodeId, 'AI 趣味创作', { size: 17, style: 'Bold' });
  await text(n3.nodeId, '作品', { size: 14, style: 'Medium', color: C.green });

  const steps3 = await rpc('create_frame', { name: 'Steps', parentId: s3, height: 72 });
  await fill(steps3.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: steps3.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 28,
    paddingRight: 28,
    paddingTop: 10,
    paddingBottom: 10,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', { nodeId: steps3.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  for (const [lab, state] of [
    ['上传照片', 'done'],
    ['制作抽卡素材', 'active'],
    ['制作动态卡片', 'todo'],
  ]) {
    const st = await rpc('create_frame', { name: lab, parentId: steps3.nodeId });
    await rpc('set_fills', { nodeId: st.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: st.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 6,
      counterAxisAlignItems: 'CENTER',
    });
    const dot = await rpc('create_frame', { name: 'Dot', parentId: st.nodeId, width: 28, height: 28 });
    await fill(dot.nodeId, state === 'todo' ? C.soft : C.green);
    await rpc('set_corner_radius', { nodeId: dot.nodeId, radius: 14 });
    await rpc('set_auto_layout', {
      nodeId: dot.nodeId,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: dot.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
    });
    await size(dot.nodeId, 28, 28);
    await text(dot.nodeId, state === 'done' ? '✓' : state === 'active' ? '2' : '3', {
      size: 12,
      style: 'Bold',
      color: state === 'todo' ? C.muted : C.white,
    });
    await text(st.nodeId, lab, {
      size: 11,
      style: state === 'todo' ? 'Regular' : 'Semi Bold',
      color: state === 'todo' ? C.muted : C.ink,
    });
  }

  const b3 = await rpc('create_frame', { name: 'Body', parentId: s3 });
  await fill(b3.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: b3.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 16,
    itemSpacing: 14,
  });
  await rpc('set_layout_props', { nodeId: b3.nodeId, layoutGrow: 1, layoutAlign: 'STRETCH' });

  const head3 = await rpc('create_frame', { name: 'Head', parentId: b3.nodeId });
  await fill(head3.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: head3.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
  });
  await rpc('set_layout_props', { nodeId: head3.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(head3.nodeId, '首帧候选', { size: 18, style: 'Bold' });
  await text(head3.nodeId, '已选 1 张', { size: 13, style: 'Medium', color: C.green });
  await text(b3.nodeId, '选一张最适合做动态开场的画面', { size: 12, color: C.muted });

  const frames = await rpc('create_frame', { name: 'Frames', parentId: b3.nodeId });
  await fill(frames.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: frames.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 12,
  });
  await rpc('set_layout_props', { nodeId: frames.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  for (let i = 1; i <= 2; i++) {
    const fr = await rpc('create_frame', { name: `Frame 0${i}`, parentId: frames.nodeId, height: 220 });
    await fill(fr.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: fr.nodeId, radius: 16 });
    if (i === 1) {
      await rpc('set_strokes', {
        nodeId: fr.nodeId,
        strokes: [{ type: 'SOLID', color: C.green }],
        strokeWeight: 2,
      });
    } else await shadow(fr.nodeId, 4, 14, 0.06);
    await rpc('set_auto_layout', { nodeId: fr.nodeId, layoutMode: 'NONE' });
    await rpc('set_layout_props', {
      nodeId: fr.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
      layoutGrow: 1,
      clipsContent: true,
    });
    await size(fr.nodeId, 169, 220);
    await placeContainImage({
      parentId: fr.nodeId,
      name: `Thumb/0${i}`,
      file: 'tpl-03-clay-dog.png',
      wrapW: 169,
      wrapH: 220,
      inset: 8,
    });
    const num = await text(fr.nodeId, `0${i}`, { size: 12, style: 'Semi Bold', color: C.green });
    const tag = await text(fr.nodeId, i === 1 ? '✓ 已选' : '候选', {
      size: 12,
      color: i === 1 ? C.green : C.muted,
    });
    await rpc('set_position', { nodeId: num, x: 10, y: 10 });
    await rpc('set_position', { nodeId: tag, x: 10, y: 28 });
  }

  const panel = await rpc('create_frame', { name: 'Panel', parentId: b3.nodeId });
  await fill(panel.nodeId, C.white);
  await rpc('set_corner_radius', { nodeId: panel.nodeId, radius: 20 });
  await shadow(panel.nodeId, 8, 20, 0.07);
  await rpc('set_auto_layout', {
    nodeId: panel.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    itemSpacing: 12,
  });
  await rpc('set_layout_props', { nodeId: panel.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(panel.nodeId, '制作趣味视频', { size: 16, style: 'Bold' });

  for (const [lab, val] of [
    ['视频玩法', DEMO_PLAYS[0] || '小狗跳舞'],
    ['动态设置', '精致动态 · 720P · 5 秒'],
  ]) {
    const rowi = await rpc('create_frame', { name: lab, parentId: panel.nodeId, height: 52 });
    await fill(rowi.nodeId, C.soft);
    await rpc('set_corner_radius', { nodeId: rowi.nodeId, radius: 14 });
    await rpc('set_auto_layout', {
      nodeId: rowi.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 14,
      paddingRight: 14,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: rowi.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
    });
    await size(rowi.nodeId, 318, 52);
    const left = await rpc('create_frame', { name: 'L', parentId: rowi.nodeId });
    await rpc('set_fills', { nodeId: left.nodeId, fills: [] });
    await rpc('set_auto_layout', { nodeId: left.nodeId, layoutMode: 'VERTICAL', itemSpacing: 2 });
    await text(left.nodeId, lab, { size: 11, color: C.muted });
    await text(left.nodeId, val, { size: 14, style: 'Medium' });
    await text(rowi.nodeId, '›', { size: 20, color: C.muted });
  }

  const cta3 = await rpc('create_frame', { name: 'CTA', parentId: panel.nodeId, height: 52 });
  await fill(cta3.nodeId, C.green);
  await rpc('set_corner_radius', { nodeId: cta3.nodeId, radius: 26 });
  await shadow(cta3.nodeId, 8, 18, 0.15);
  await rpc('set_auto_layout', {
    nodeId: cta3.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: cta3.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
  });
  await size(cta3.nodeId, 318, 52);
  await text(cta3.nodeId, '制作趣味动态', { size: 16, style: 'Semi Bold', color: C.white });

  // ═══════════ 04 选择视频玩法 Sheet ═══════════
  const s4 = await phone('05 DIY·选择视频玩法', 8);
  await fill(s4, { r: 0.12, g: 0.12, b: 0.14 });
  await rpc('set_auto_layout', {
    nodeId: s4,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MAX',
    counterAxisAlignItems: 'MIN',
  });
  // spacer pushes sheet to bottom
  const dim = await rpc('create_frame', { name: 'Back/关闭玩法', parentId: s4 });
  await fill(dim.nodeId, { r: 0.08, g: 0.08, b: 0.1 }, 0.55);
  await rpc('set_layout_props', {
    nodeId: dim.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FILL',
    layoutGrow: 1,
  });

  const sheet = await rpc('create_frame', { name: 'Sheet', parentId: s4 });
  await fill(sheet.nodeId, C.white);
  await rpc('set_corner_radius', {
    nodeId: sheet.nodeId,
    radius: 24,
    topLeftRadius: 24,
    topRightRadius: 24,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
  });
  await rpc('set_auto_layout', {
    nodeId: sheet.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 28,
    itemSpacing: 12,
  });
  await rpc('set_layout_props', { nodeId: sheet.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });

  const handle = await rpc('create_frame', { name: 'Handle', parentId: sheet.nodeId, width: 40, height: 4 });
  await fill(handle.nodeId, C.line);
  await rpc('set_corner_radius', { nodeId: handle.nodeId, radius: 2 });
  await rpc('set_layout_props', { nodeId: handle.nodeId, layoutAlign: 'CENTER' });

  const sh = await rpc('create_frame', { name: 'SheetHead', parentId: sheet.nodeId });
  await rpc('set_fills', { nodeId: sh.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: sh.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', { nodeId: sh.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  const sht = await rpc('create_frame', { name: 'T', parentId: sh.nodeId });
  await rpc('set_fills', { nodeId: sht.nodeId, fills: [] });
  await rpc('set_auto_layout', { nodeId: sht.nodeId, layoutMode: 'VERTICAL', itemSpacing: 4 });
  await rpc('set_layout_props', { nodeId: sht.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(sht.nodeId, '选择视频玩法', { size: 18, style: 'Bold' });
  {
    const sub = await text(sht.nodeId, '当前模板：粘土宠物 · 选后立即生效', { size: 12, color: C.muted });
    await rpc('set_layout_props', { nodeId: sub, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: sub, textAutoResize: 'HEIGHT' });
  }
  {
    const close = await rpc('create_frame', { name: 'Back/关闭玩法', parentId: sh.nodeId });
    await rpc('set_fills', { nodeId: close.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: close.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 8,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
    });
    await rpc('set_layout_props', {
      nodeId: close.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(close.nodeId, '✕', { size: 18, color: C.muted });
  }

  // 三个备选竖排（全宽行卡 + 竖向预览图）
  const playGrid = await rpc('create_frame', { name: 'PlayList', parentId: sheet.nodeId });
  await rpc('set_fills', { nodeId: playGrid.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: playGrid.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 10,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
  });
  await rpc('set_layout_props', {
    nodeId: playGrid.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });

  // Per-template plays from aigc-templates.json (prototype demo: 粘土宠物 3 备选)
  const plays = DEMO_PLAYS.length ? DEMO_PLAYS : ['小狗跳舞', '小狗跳高', '小狗打招呼'];
  const THUMB_W = 72;
  const THUMB_H = 96; // 竖向 3:4
  for (let i = 0; i < plays.length; i++) {
    const on = i === 0;
    const cell = await rpc('create_frame', {
      name: `Play/${String(i + 1).padStart(2, '0')}`,
      parentId: playGrid.nodeId,
    });
    await fill(cell.nodeId, on ? { r: 0.96, g: 0.985, b: 0.95 } : C.white);
    await rpc('set_corner_radius', { nodeId: cell.nodeId, radius: 14 });
    await rpc('set_strokes', {
      nodeId: cell.nodeId,
      strokes: [{ type: 'SOLID', color: on ? C.green : C.line }],
      strokeWeight: on ? 2 : 1,
    });
    await rpc('set_auto_layout', {
      nodeId: cell.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 12,
      paddingRight: 14,
      paddingTop: 10,
      paddingBottom: 10,
      itemSpacing: 12,
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: cell.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
      clipsContent: false,
    });
    const thumbWrap = await rpc('create_frame', {
      name: `PlayThumb/${String(i + 1).padStart(2, '0')}`,
      parentId: cell.nodeId,
      width: THUMB_W,
      height: THUMB_H,
    });
    await fill(thumbWrap.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: thumbWrap.nodeId, radius: 10 });
    await rpc('set_auto_layout', { nodeId: thumbWrap.nodeId, layoutMode: 'NONE' });
    await rpc('set_layout_props', {
      nodeId: thumbWrap.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(thumbWrap.nodeId, THUMB_W, THUMB_H);
    await placeContainImage({
      parentId: thumbWrap.nodeId,
      name: `PlayCover/${String(i + 1).padStart(2, '0')}`,
      file: 'tpl-03-clay-dog.png',
      wrapW: THUMB_W,
      wrapH: THUMB_H,
      inset: 6,
    });
    const meta = await rpc('create_frame', {
      name: `PlayMeta/${String(i + 1).padStart(2, '0')}`,
      parentId: cell.nodeId,
    });
    await rpc('set_fills', { nodeId: meta.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: meta.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 6,
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
    });
    await rpc('set_layout_props', {
      nodeId: meta.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    const num = await text(meta.nodeId, `玩法 ${String(i + 1).padStart(2, '0')}`, {
      size: 11,
      style: 'Semi Bold',
      color: C.green,
    });
    await rpc('set_layout_props', { nodeId: num, layoutSizingHorizontal: 'FILL' });
    const lab = await text(meta.nodeId, plays[i], { size: 15, style: 'Medium' });
    await rpc('set_layout_props', { nodeId: lab, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: lab, textAutoResize: 'HEIGHT' });
    if (on) {
      const tip = await text(meta.nodeId, '当前选中', { size: 11, color: C.muted });
      await rpc('set_layout_props', { nodeId: tip, layoutSizingHorizontal: 'FILL' });
    }
  }
  await text(sheet.nodeId, '玩法会持续更新', { size: 12, color: C.muted });

  // ═══════════ 05 作品详情 + 投放 ═══════════
  const s5 = await phone('06 作品详情·投放全息舱', 9);
  const n5 = await rpc('create_frame', { name: 'Nav', parentId: s5, height: 48 });
  await fill(n5.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: n5.nodeId,
    layoutMode: 'HORIZONTAL',
    paddingLeft: 16,
    paddingRight: 16,
    itemSpacing: 12,
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', { nodeId: n5.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED' });
  await size(n5.nodeId, 390, 48);
  await makeBackHome(n5.nodeId, '‹');
  await text(n5.nodeId, '作品详情', { size: 17, style: 'Bold' });

  const b5 = await rpc('create_frame', { name: 'Body', parentId: s5 });
  await fill(b5.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: b5.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 8,
    paddingBottom: 28,
    itemSpacing: 14,
  });
  await rpc('set_layout_props', { nodeId: b5.nodeId, layoutGrow: 1, layoutAlign: 'STRETCH' });

  const titleRow = await rpc('create_frame', { name: 'TitleRow', parentId: b5.nodeId });
  await fill(titleRow.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: titleRow.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: titleRow.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  const titleLeft = await rpc('create_frame', { name: 'TitleLeft', parentId: titleRow.nodeId });
  await fill(titleLeft.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: titleLeft.nodeId,
    layoutMode: 'VERTICAL',
    itemSpacing: 4,
  });
  await rpc('set_layout_props', {
    nodeId: titleLeft.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(titleLeft.nodeId, DEMO_PLAYS[0] || '小狗跳舞', { size: 22, style: 'Bold' });
  await text(titleLeft.nodeId, '粘土宠物 · 我的作品', { size: 13, color: C.muted });
  {
    const shareBtn = await rpc('create_frame', { name: '分享', parentId: titleRow.nodeId, height: 32 });
    await fill(shareBtn.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: shareBtn.nodeId, radius: 16 });
    await rpc('set_strokes', {
      nodeId: shareBtn.nodeId,
      strokes: [{ type: 'SOLID', color: C.line }],
      strokeWeight: 1,
    });
    await rpc('set_auto_layout', {
      nodeId: shareBtn.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 14,
      paddingRight: 14,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: shareBtn.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'FIXED',
    });
    await size(shareBtn.nodeId, 64, 32);
    await text(shareBtn.nodeId, '分享', { size: 13, style: 'Medium' });
  }

  const player = await rpc('create_frame', { name: 'Player', parentId: b5.nodeId, height: 240 });
  await fill(player.nodeId, { r: 0.1, g: 0.1, b: 0.11 });
  await rpc('set_corner_radius', { nodeId: player.nodeId, radius: 20 });
  await rpc('set_auto_layout', { nodeId: player.nodeId, layoutMode: 'NONE' });
  await rpc('set_layout_props', {
    nodeId: player.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
  });
  await size(player.nodeId, 350, 240);
  await placeContainImage({
    parentId: player.nodeId,
    name: 'PlayerCover',
    file: 'tpl-03-clay-dog.png',
    wrapW: 350,
    wrapH: 240,
    inset: 10,
  });
  const scrub = await rpc('create_frame', {
    name: 'Scrub',
    parentId: player.nodeId,
    width: 350,
    height: 40,
  });
  await fill(scrub.nodeId, { r: 0, g: 0, b: 0 }, 0.4);
  await rpc('set_auto_layout', {
    nodeId: scrub.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: scrub.nodeId,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
  });
  await size(scrub.nodeId, 350, 40);
  await rpc('set_position', { nodeId: scrub.nodeId, x: 0, y: 200 });
  await text(scrub.nodeId, '▶ 动态预览  00:05', { size: 13, color: C.white });

  const info = await rpc('create_frame', { name: 'Info', parentId: b5.nodeId });
  await fill(info.nodeId, C.white);
  await rpc('set_corner_radius', { nodeId: info.nodeId, radius: 16 });
  await shadow(info.nodeId, 4, 14, 0.05);
  await rpc('set_auto_layout', {
    nodeId: info.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
    itemSpacing: 8,
  });
  await rpc('set_layout_props', { nodeId: info.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(info.nodeId, '作品信息', { size: 14, style: 'Semi Bold' });
  for (const [k, v] of [
    ['生成模型', '精致动态'],
    ['分辨率时长', '720P · 5 秒'],
    ['创建时间', '8月6日'],
  ]) {
    const r = await rpc('create_frame', { name: k, parentId: info.nodeId, height: 40 });
    await fill(r.nodeId, C.soft);
    await rpc('set_corner_radius', { nodeId: r.nodeId, radius: 10 });
    await rpc('set_auto_layout', {
      nodeId: r.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 12,
      paddingRight: 12,
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', { nodeId: r.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED' });
    await size(r.nodeId, 322, 40);
    await text(r.nodeId, k, { size: 12, color: C.muted });
    await text(r.nodeId, v, { size: 13, style: 'Medium' });
  }

  const spacer5 = await rpc('create_frame', { name: 'Spacer', parentId: b5.nodeId, height: 8 });
  await rpc('set_fills', { nodeId: spacer5.nodeId, fills: [] });
  await rpc('set_layout_props', {
    nodeId: spacer5.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FILL',
    layoutGrow: 1,
  });

  const acts = await rpc('create_frame', { name: 'Actions', parentId: b5.nodeId });
  await fill(acts.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: acts.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 10,
  });
  await rpc('set_layout_props', { nodeId: acts.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });

  const cast = await rpc('create_frame', { name: '投放全息舱', parentId: acts.nodeId, height: 52 });
  await fill(cast.nodeId, C.green);
  await rpc('set_corner_radius', { nodeId: cast.nodeId, radius: 16 });
  await shadow(cast.nodeId, 6, 16, 0.14);
  await rpc('set_auto_layout', {
    nodeId: cast.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: cast.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
  });
  await size(cast.nodeId, 170, 52);
  await text(cast.nodeId, '投放全息舱', { size: 15, style: 'Semi Bold', color: C.white });

  {
    const cont = await rpc('create_frame', { name: '继续生成', parentId: acts.nodeId, height: 52 });
    await fill(cont.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: cont.nodeId, radius: 16 });
    await rpc('set_strokes', {
      nodeId: cont.nodeId,
      strokes: [{ type: 'SOLID', color: C.green }],
      strokeWeight: 1.5,
    });
    await rpc('set_auto_layout', {
      nodeId: cont.nodeId,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: cont.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
    });
    await size(cont.nodeId, 170, 52);
    await text(cont.nodeId, '继续生成', { size: 15, style: 'Semi Bold', color: C.green });
  }

  // ═══════════ 06 选择播放设备 Sheet ═══════════
  const s6 = await phone('07 选择播放设备', 10);
  await fill(s6, { r: 0.12, g: 0.12, b: 0.14 });
  await rpc('set_auto_layout', {
    nodeId: s6,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MAX',
    counterAxisAlignItems: 'MIN',
  });
  const dim6 = await rpc('create_frame', { name: 'Back/关闭设备', parentId: s6 });
  await fill(dim6.nodeId, { r: 0.08, g: 0.08, b: 0.1 }, 0.55);
  await rpc('set_layout_props', {
    nodeId: dim6.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FILL',
    layoutGrow: 1,
  });

  const sheet6 = await rpc('create_frame', { name: 'DeviceSheet', parentId: s6 });
  await fill(sheet6.nodeId, C.white);
  await rpc('set_corner_radius', {
    nodeId: sheet6.nodeId,
    radius: 24,
    topLeftRadius: 24,
    topRightRadius: 24,
    bottomLeftRadius: 0,
    bottomRightRadius: 0,
  });
  await rpc('set_auto_layout', {
    nodeId: sheet6.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 16,
    paddingBottom: 32,
    itemSpacing: 14,
  });
  await rpc('set_layout_props', {
    nodeId: sheet6.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  {
    const head6 = await rpc('create_frame', { name: 'DeviceHead', parentId: sheet6.nodeId });
    await rpc('set_fills', { nodeId: head6.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: head6.nodeId,
      layoutMode: 'HORIZONTAL',
      primaryAxisAlignItems: 'SPACE_BETWEEN',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: head6.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    await text(head6.nodeId, '选择播放设备', { size: 18, style: 'Bold' });
    const close6 = await rpc('create_frame', { name: 'Back/关闭设备', parentId: head6.nodeId });
    await rpc('set_fills', { nodeId: close6.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: close6.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 8,
      paddingRight: 4,
      paddingTop: 4,
      paddingBottom: 4,
    });
    await rpc('set_layout_props', {
      nodeId: close6.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(close6.nodeId, '✕', { size: 18, color: C.muted });
  }
  {
    const sub6 = await text(sheet6.nodeId, '选择已绑定设备，或扫描二维码添加新设备', { size: 12, color: C.muted });
    await rpc('set_layout_props', { nodeId: sub6, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: sub6, textAutoResize: 'HEIGHT' });
  }

  const device = await rpc('create_frame', { name: 'DeviceCard', parentId: sheet6.nodeId });
  await fill(device.nodeId, C.white);
  await rpc('set_corner_radius', { nodeId: device.nodeId, radius: 18 });
  await rpc('set_strokes', {
    nodeId: device.nodeId,
    strokes: [{ type: 'SOLID', color: C.line }],
    strokeWeight: 1,
  });
  await rpc('set_auto_layout', {
    nodeId: device.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 20,
    paddingBottom: 20,
    itemSpacing: 12,
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', {
    nodeId: device.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(device.nodeId, '等待连接', { size: 12, style: 'Semi Bold', color: C.green });
  await text(device.nodeId, '连接一台全息舱', { size: 17, style: 'Bold' });
  {
    const tip = await text(device.nodeId, '扫描设备屏幕上的二维码，绑定后即可投放这个作品', {
      size: 12,
      color: C.muted,
    });
    await rpc('set_layout_props', { nodeId: tip, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: tip, textAutoResize: 'HEIGHT' });
  }

  const scan = await rpc('create_frame', { name: 'ScanBtn', parentId: device.nodeId });
  await fill(scan.nodeId, C.green);
  await rpc('set_corner_radius', { nodeId: scan.nodeId, radius: 16 });
  await shadow(scan.nodeId, 6, 16, 0.14);
  await rpc('set_auto_layout', {
    nodeId: scan.nodeId,
    layoutMode: 'VERTICAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 2,
    paddingTop: 14,
    paddingBottom: 14,
  });
  await rpc('set_layout_props', {
    nodeId: scan.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  await text(scan.nodeId, '扫描绑定设备', { size: 15, style: 'Semi Bold', color: C.white });
  await text(scan.nodeId, '打开相机识别二维码', { size: 11, color: { r: 0.95, g: 0.98, b: 0.92 } });

  console.log(
    JSON.stringify(
      {
        ok: true,
        screens: [
          home,
          hubPages.person?.designId,
          hubPages.pet?.designId,
          hubPages.toy?.designId,
          uploadPages.person,
          uploadPages.pet,
          uploadPages.toy,
          s3,
          s4,
          s5,
          s6,
        ],
        uploadPages,
        hubPhones: {
          person: hubPages.person?.phoneId,
          pet: hubPages.pet?.phoneId,
          toy: hubPages.toy?.phoneId,
        },
        hubs: HUBS.map((h) => ({ id: h.id, n: h.templates.length })),
        templates: TEMPLATES.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
