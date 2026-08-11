/**
 * Rebuild DIY prototype: numbered home templates + existing DIY flow (new UI style).
 * Requires Figwright plugin Connected.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { encode, decode } from '@msgpack/msgpack';

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

/** Chip 顺序（首页筛选）：全部 → 潮玩 → 游戏 → 宠物 → 桌宠 → 真人雕塑 → 真人 */
const CHIP_ORDER = ['全部', '潮玩', '游戏', '宠物', '桌宠', '真人雕塑', '真人'];

/**
 * 瀑布流顺序（产品指定前 7）：棉花娃娃 → Q版机甲 → 乐高 → 自拍盲盒 → 打工人盲盒 → 学院风BJD → 高定爱豆；其后 RPG/汽水/载具/宠物/桌宠/雕塑。
 * Cover heights sized for FIT full-body product shots (taller = less cramped)
 */
const TEMPLATES = [
  { n: '01', name: '棉花娃娃', file: 'tpl-20-yarn-doll.png', cat: '潮玩', h: 236, id: 'tpl_18_yarn_doll' },
  { n: '02', name: 'Q版机甲', file: 'tpl-17-mecha.png', cat: '游戏', h: 240, id: 'tpl_01_mecha' },
  { n: '03', name: '乐高角色', file: 'tpl-10-pixel.png', cat: '游戏', h: 228, id: 'tpl_08_pixel' },
  { n: '04', name: '自拍盲盒', file: 'tpl-05-blindbox.png', cat: '潮玩', h: 228, id: 'tpl_04_selfie_blindbox' },
  { n: '05', name: '打工人盲盒', file: 'tpl-16-office.png', cat: '潮玩', h: 228, id: 'tpl_05_office_blindbox' },
  { n: '06', name: 'bjd学院风证件照', file: 'tpl-22-bjd-school-id.png', cat: '潮玩', h: 252, id: 'tpl_20_bjd_school_id' },
  { n: '07', name: 'bjd高定爱豆', file: 'tpl-21-bjd-idol.png', cat: '潮玩', h: 252, id: 'tpl_19_bjd_idol' },
  { n: '08', name: 'RPG立绘立体化', file: 'tpl-11-rpg.png', cat: '游戏', h: 252, id: 'tpl_02_rpg' },
  { n: '09', name: '汽水瓶人偶', file: 'tpl-18-soda.png', cat: '潮玩', h: 236, id: 'tpl_06_soda' },
  { n: '10', name: '微缩载具', file: 'tpl-12-vehicle.png', cat: '潮玩', h: 220, id: 'tpl_07_vehicle' },
  { n: '11', name: '粘土小狗', file: 'tpl-03-clay-dog.png', cat: '宠物', h: 228, id: 'tpl_12_clay_dog' },
  { n: '12', name: '羊毛毡小猫', file: 'tpl-04-felt-cat.png', cat: '宠物', h: 244, id: 'tpl_13_felt_cat' },
  { n: '13', name: '数字国潮摆件', file: 'tpl-06-guochao.png', cat: '桌宠', h: 236, id: 'tpl_09_guochao' },
  { n: '14', name: '桌面小精灵', file: 'tpl-07-sprite.png', cat: '桌宠', h: 220, id: 'tpl_10_sprite' },
  { n: '15', name: '天气精灵', file: 'tpl-08-weather.png', cat: '桌宠', h: 228, id: 'tpl_11_weather' },
  { n: '16', name: '桌面盆栽', file: 'tpl-09-season.png', cat: '桌宠', h: 212, id: 'tpl_14_plant' },
  { n: '17', name: '咖啡店打卡', file: 'tpl-19-cafe.png', cat: '真人雕塑', h: 244, id: 'tpl_03_cafe' },
  { n: '18', name: '立体全家福', file: 'tpl-01-family.png', cat: '真人雕塑', h: 236, id: 'tpl_15_family' },
  { n: '19', name: '微雕塑婚礼瞬间', file: 'tpl-13-wedding.png', cat: '真人雕塑', h: 236, id: 'tpl_17_wedding' },
];

const C = {
  bg: { r: 0.965, g: 0.968, b: 0.975 },
  white: { r: 1, g: 1, b: 1 },
  ink: { r: 0.12, g: 0.12, b: 0.14 },
  muted: { r: 0.55, g: 0.56, b: 0.6 },
  green: { r: 110 / 255, g: 199 / 255, b: 59 / 255 },
  soft: { r: 0.94, g: 0.945, b: 0.955 },
  line: { r: 0.9, g: 0.91, b: 0.93 },
  dark: { r: 0.12, g: 0.14, b: 0.13 },
};

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
 * Place full subject centered in wrap (no crop):
 * size image rect to file aspect that fits inside wrap, FILL that rect.
 */
async function placeFittedImage({ parentId, name, file, wrapW, wrapH }) {
  const aspect = pngAspect(file);
  const wrapAspect = wrapW / wrapH;
  // Near-square assets:
  // - square wrap → FILL
  // - portrait wrap → centered square (avoid left/right crop of subject)
  // - landscape wrap → FILL wrap (video-player style; slight top/bottom crop)
  if (aspect > 0.85 && aspect < 1.15) {
    let iw = wrapW;
    let ih = wrapH;
    let x = 0;
    let y = 0;
    if (wrapAspect < 0.85) {
      const side = Math.min(wrapW, wrapH);
      iw = side;
      ih = side;
      x = Math.round((wrapW - iw) / 2);
      y = Math.round((wrapH - ih) / 2);
    }
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
    await rpc('resize_nodes', { nodeIds: [img.nodeId], width: iw, height: ih });
    await rpc('set_position', { nodeId: img.nodeId, x, y });
    return img.nodeId;
  }
  let iw = wrapW;
  let ih = wrapW / aspect;
  if (ih > wrapH) {
    ih = wrapH;
    iw = wrapH * aspect;
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
  await rpc('resize_nodes', { nodeIds: [img.nodeId], width: iw, height: ih });
  await rpc('set_position', { nodeId: img.nodeId, x, y });
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

async function main() {
  console.log('Waiting…');
  await waitPlugin();

  // Clear old top-level frames
  const doc = await rpc('get_document', {});
  const old = (doc.children || []).filter((c) => c.type === 'FRAME').map((c) => c.id);
  if (old.length) await rpc('delete_nodes', { nodeIds: old });

  // ═══════════ 01 首页瀑布流 ═══════════
  const home = await phone('01 首页·风格模板', 0);
  const hHead = await rpc('create_frame', { name: 'Header', parentId: home, width: 390 });
  await fill(hHead.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: hHead.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 16,
    paddingBottom: 8,
    itemSpacing: 8,
  });
  await rpc('set_layout_props', { nodeId: hHead.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(hHead.nodeId, '开始创作', { size: 28, style: 'Bold' });
  await text(hHead.nodeId, '上传真人照片，或选风格模板投放全息舱', { size: 13, color: C.muted });

  const body = await rpc('create_frame', { name: 'Body', parentId: home, width: 390 });
  await fill(body.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: body.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 4,
    paddingBottom: 16,
    itemSpacing: 10,
  });
  await rpc('set_layout_props', {
    nodeId: body.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
    layoutAlign: 'STRETCH',
  });

  const cats = await rpc('create_frame', { name: 'Categories', parentId: body.nodeId });
  await fill(cats.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: cats.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 6,
    counterAxisAlignItems: 'CENTER',
    layoutWrap: 'NO_WRAP',
  });
  await rpc('set_layout_props', {
    nodeId: cats.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
    overflowDirection: 'HORIZONTAL',
  });
  await size(cats.nodeId, 370, 36);
  for (const [label, on] of CHIP_ORDER.map((label, i) => [label, i === 0])) {
    const chip = await rpc('create_frame', { name: `Chip/${label}`, parentId: cats.nodeId });
    await fill(chip.nodeId, on ? C.green : C.white);
    await rpc('set_corner_radius', { nodeId: chip.nodeId, radius: 18 });
    if (!on) await shadow(chip.nodeId, 2, 10, 0.05);
    await rpc('set_auto_layout', {
      nodeId: chip.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: chip.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(chip.nodeId, label, {
      size: 12,
      style: on ? 'Semi Bold' : 'Medium',
      color: on ? C.white : C.ink,
    });
  }

  // 真人全息动态：通栏入口（无加号）。预览图 + 文案 + 上传 CTA 一体
  {
    const diy = await rpc('create_frame', {
      name: 'Card/00 真人全息动态',
      parentId: body.nodeId,
      width: 370,
    });
    await fill(diy.nodeId, { r: 0.96, g: 0.985, b: 0.95 });
    await rpc('set_corner_radius', { nodeId: diy.nodeId, radius: 18 });
    await rpc('set_strokes', {
      nodeId: diy.nodeId,
      strokes: [{ type: 'SOLID', color: C.green, opacity: 0.55 }],
      strokeWeight: 1.5,
      strokeAlign: 'INSIDE',
    });
    await shadow(diy.nodeId, 3, 14, 0.06);
    await rpc('set_auto_layout', {
      nodeId: diy.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 12,
      paddingRight: 14,
      paddingTop: 12,
      paddingBottom: 12,
      itemSpacing: 14,
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: diy.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });

    const cover = await rpc('create_frame', {
      name: 'CoverWrap/00',
      parentId: diy.nodeId,
      width: 92,
      height: 120,
    });
    await fill(cover.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: cover.nodeId, radius: 14 });
    await rpc('set_auto_layout', { nodeId: cover.nodeId, layoutMode: 'NONE' });
    await rpc('set_layout_props', {
      nodeId: cover.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(cover.nodeId, 92, 120);
    await placeFittedImage({
      parentId: cover.nodeId,
      name: 'Cover/00',
      file: 'diy-realtime-person-clean.png',
      wrapW: 92,
      wrapH: 120,
    });

    const info = await rpc('create_frame', { name: 'DiyInfo', parentId: diy.nodeId });
    await rpc('set_fills', { nodeId: info.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: info.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      primaryAxisAlignItems: 'MIN',
      counterAxisAlignItems: 'MIN',
    });
    await rpc('set_layout_props', {
      nodeId: info.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });

    const tagRow = await rpc('create_frame', { name: 'TagRow', parentId: info.nodeId });
    await rpc('set_fills', { nodeId: tagRow.nodeId, fills: [] });
    await rpc('set_auto_layout', {
      nodeId: tagRow.nodeId,
      layoutMode: 'HORIZONTAL',
      itemSpacing: 6,
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: tagRow.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });
    const tag = await rpc('create_frame', { name: 'Tag/真人', parentId: tagRow.nodeId });
    await fill(tag.nodeId, C.green);
    await rpc('set_corner_radius', { nodeId: tag.nodeId, radius: 8 });
    await rpc('set_auto_layout', {
      nodeId: tag.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: tag.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(tag.nodeId, '真人', { size: 10, style: 'Semi Bold', color: C.white });
    await text(tagRow.nodeId, '一键变成动态', { size: 11, color: C.muted });

    await text(info.nodeId, '真人全息动态', { size: 17, style: 'Bold' });
    {
      const sub = await text(info.nodeId, '上传清晰真人照片，生成可投放全息舱的短动态', {
        size: 12,
        color: C.muted,
      });
      await rpc('set_layout_props', {
        nodeId: sub,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
      });
      await rpc('set_text_properties', { nodeId: sub, textAutoResize: 'HEIGHT' });
    }

    const cta = await rpc('create_frame', { name: 'CTA/上传照片', parentId: info.nodeId, height: 34 });
    await fill(cta.nodeId, C.green);
    await rpc('set_corner_radius', { nodeId: cta.nodeId, radius: 17 });
    await rpc('set_auto_layout', {
      nodeId: cta.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 14,
      paddingRight: 14,
      itemSpacing: 6,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: cta.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'FIXED',
    });
    await size(cta.nodeId, 120, 34);
    await text(cta.nodeId, '上传照片', { size: 13, style: 'Semi Bold', color: C.white });
  }

  const sec = await rpc('create_frame', { name: 'Section', parentId: body.nodeId });
  await fill(sec.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: sec.nodeId,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', { nodeId: sec.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(sec.nodeId, '风格模板', { size: 18, style: 'Bold' });
  await text(sec.nodeId, `${TEMPLATES.length} 个`, { size: 13, style: 'Medium', color: C.green });

  const grid = await rpc('create_frame', { name: 'Waterfall', parentId: body.nodeId });
  await fill(grid.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: grid.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 8,
    counterAxisAlignItems: 'MIN',
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
  });
  await rpc('set_layout_props', {
    nodeId: grid.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });
  // Column width = (390 - body pad 10*2 - gap 8) / 2 = 181
  const COL_W = 181;
  const colL = await rpc('create_frame', { name: 'Col L', parentId: grid.nodeId, width: COL_W });
  const colR = await rpc('create_frame', { name: 'Col R', parentId: grid.nodeId, width: COL_W });
  for (const col of [colL, colR]) {
    await fill(col.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: col.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 4,
    });
    await rpc('set_layout_props', {
      nodeId: col.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
    });
    await size(col.nodeId, COL_W, 100);
  }

  for (let i = 0; i < TEMPLATES.length; i++) {
    const tpl = TEMPLATES[i];
    const col = i % 2 === 0 ? colL : colR;
    const card = await rpc('create_frame', {
      name: `Card/${tpl.n} ${tpl.name}`,
      parentId: col.nodeId,
      width: COL_W,
    });
    await fill(card.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: card.nodeId, radius: 14 });
    await shadow(card.nodeId, 2, 6, 0.05);
    await rpc('set_auto_layout', {
      nodeId: card.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
    });
    await rpc('set_layout_props', {
      nodeId: card.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
    });

    const coverWrap = await rpc('create_frame', {
      name: `CoverWrap/${tpl.n}`,
      parentId: card.nodeId,
      width: COL_W,
      height: tpl.h,
    });
    await fill(coverWrap.nodeId, C.white);
    await rpc('set_corner_radius', {
      nodeId: coverWrap.nodeId,
      radius: 14,
      topLeftRadius: 14,
      topRightRadius: 14,
      bottomLeftRadius: 0,
      bottomRightRadius: 0,
    });
    await rpc('set_auto_layout', {
      nodeId: coverWrap.nodeId,
      layoutMode: 'NONE',
    });
    await rpc('set_layout_props', {
      nodeId: coverWrap.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(coverWrap.nodeId, COL_W, tpl.h);

    // Centered full-subject cover (no crop / no corner-biased FIT)
    await placeFittedImage({
      parentId: coverWrap.nodeId,
      name: `Cover/${tpl.n}`,
      file: tpl.file,
      wrapW: COL_W,
      wrapH: tpl.h,
    });
    const badge = await rpc('create_frame', {
      name: `Tag/${tpl.cat}`,
      parentId: coverWrap.nodeId,
      x: 8,
      y: 8,
    });
    await fill(badge.nodeId, { r: 0.93, g: 0.97, b: 0.9 });
    await rpc('set_corner_radius', { nodeId: badge.nodeId, radius: 10 });
    await shadow(badge.nodeId, 1, 6, 0.08);
    await rpc('set_auto_layout', {
      nodeId: badge.nodeId,
      layoutMode: 'HORIZONTAL',
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 3,
      paddingBottom: 3,
      primaryAxisAlignItems: 'CENTER',
      counterAxisAlignItems: 'CENTER',
    });
    await rpc('set_layout_props', {
      nodeId: badge.nodeId,
      layoutSizingHorizontal: 'HUG',
      layoutSizingVertical: 'HUG',
    });
    await text(badge.nodeId, tpl.cat, { size: 10, style: 'Semi Bold', color: C.green });
    // Top-right so tag doesn't cover the subject
    {
      const b = await rpc('get_node', { nodeId: badge.nodeId });
      const tw = b.node?.width ?? 36;
      await rpc('set_position', {
        nodeId: badge.nodeId,
        x: Math.max(8, COL_W - tw - 8),
        y: 8,
      });
    }

    const meta = await rpc('create_frame', { name: 'Meta', parentId: card.nodeId, height: 48 });
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
    await text(meta.nodeId, tpl.name, { size: 13, style: 'Medium' });
  }

  // Design artboard: HUG full waterfall so canvas shows all cards (no clip).
  // Separate phone preview frame (created below) is 390×844 + VERTICAL overflow for Present.
  {
    await rpc('set_layout_props', {
      nodeId: home,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
      clipsContent: false,
      overflowDirection: 'NONE',
      numberOfFixedChildren: 0,
    });
    const homeNode = await rpc('get_node', { nodeId: home, depth: 1 });
    const kids = homeNode.node?.children || homeNode.children || [];
    const bodyId =
      (
        await rpc('search_nodes', { name: 'Body', root: home })
      ).nodes?.find((c) => c.name === 'Body' && c.parentId === home)?.id ||
      kids.find((c) => c.name === 'Body')?.id;
    if (bodyId) {
      await rpc('set_layout_props', {
        nodeId: bodyId,
        layoutSizingHorizontal: 'FILL',
        layoutSizingVertical: 'HUG',
        clipsContent: false,
        overflowDirection: 'NONE',
        numberOfFixedChildren: 0,
      });
    }
    await rpc('rename_node', { nodeId: home, name: '01 首页·风格模板（全高可看全）' }).catch(() => {});

    // Phone Present frame: clone home into 390×844 scroll shell (placed after flow screens)
    const homeAfter = (await rpc('get_node', { nodeId: home })).node || homeNode.node;
    const phone = await rpc('create_frame', {
      name: '01 手机预览·可滚动',
      x: 6 * (390 + 60) + 80,
      y: 0,
      width: 390,
      height: 844,
    });
    await fill(phone.nodeId, C.bg);
    await rpc('set_auto_layout', {
      nodeId: phone.nodeId,
      layoutMode: 'VERTICAL',
      itemSpacing: 0,
    });
    await rpc('set_layout_props', {
      nodeId: phone.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
      overflowDirection: 'VERTICAL',
      numberOfFixedChildren: 0,
    });
    await size(phone.nodeId, 390, 844);
    const cloned = await rpc('clone_node', { nodeId: home });
    const cid = cloned.nodeId;
    await rpc('rename_node', { nodeId: cid, name: 'HomeScrollContent' });
    await rpc('reparent_nodes', { nodeIds: [cid], newParentId: phone.nodeId });
    await rpc('set_layout_props', {
      nodeId: cid,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
      clipsContent: false,
      overflowDirection: 'NONE',
      numberOfFixedChildren: 0,
    });
    console.log(
      'home full-height',
      homeAfter?.height || 'hug',
      '+ phone preview',
      phone.nodeId,
      'overflow=VERTICAL',
    );
  }

  // ═══════════ 02 上传照片 ═══════════
  const s2 = await phone('02 DIY·上传照片', 1);
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
  await rpc('set_layout_props', { nodeId: n2.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED' });
  await size(n2.nodeId, 390, 48);
  await text(n2.nodeId, 'AI 趣味创作', { size: 17, style: 'Bold' });
  await text(n2.nodeId, '作品', { size: 14, style: 'Medium', color: C.green });

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
  await rpc('set_layout_props', { nodeId: hero.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  // Light photo bg + soft white wash so copy stays readable
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
    const wash = await rpc('create_frame', { name: 'HeroWash', parentId: hero.nodeId, width: 390, height: 140 });
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
  await rpc('set_layout_props', { nodeId: steps2.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
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
    itemSpacing: 14,
  });
  await rpc('set_layout_props', { nodeId: b2.nodeId, layoutGrow: 1, layoutAlign: 'STRETCH' });

  const upload = await rpc('create_frame', { name: 'Upload', parentId: b2.nodeId, height: 300 });
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
    paddingTop: 36,
    paddingBottom: 36,
    paddingLeft: 20,
    paddingRight: 20,
    itemSpacing: 10,
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
  });
  await rpc('set_layout_props', { nodeId: upload.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FIXED' });
  await size(upload.nodeId, 350, 200);
  {
    const icon = await rpc('create_frame', { name: 'UploadIcon', parentId: upload.nodeId, width: 56, height: 56 });
    await fill(icon.nodeId, { r: 0.93, g: 0.97, b: 0.9 });
    await rpc('set_corner_radius', { nodeId: icon.nodeId, radius: 28 });
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
    await size(icon.nodeId, 56, 56);
    await text(icon.nodeId, '上传', { size: 14, style: 'Semi Bold', color: C.green });
  }
  await text(upload.nodeId, '上传一张主体完整的清晰照片', { size: 15, style: 'Semi Bold' });
  await text(upload.nodeId, '推荐 9:16 竖版，主体完整入镜、光线充足', { size: 12, color: C.muted });

  const row = await rpc('create_frame', { name: 'Actions', parentId: b2.nodeId });
  await fill(row.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: row.nodeId,
    layoutMode: 'HORIZONTAL',
    itemSpacing: 12,
  });
  await rpc('set_layout_props', { nodeId: row.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  for (const [lab, solid] of [
    ['拍照', true],
    ['从相册选择', false],
  ]) {
    const btn = await rpc('create_frame', { name: lab, parentId: row.nodeId, height: 48 });
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
  await rpc('set_layout_props', { nodeId: notice.nodeId, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
  await text(notice.nodeId, '照片仅用于生成本次创意图片和动态卡片', { size: 11, color: C.muted });

  // ═══════════ 03 制作抽卡 / 首帧候选 ═══════════
  const s3 = await phone('03 DIY·首帧候选', 2);
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
    await placeFittedImage({
      parentId: fr.nodeId,
      name: `Thumb/0${i}`,
      file: 'tpl-03-clay-dog.png',
      wrapW: 169,
      wrapH: 220,
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
  const s4 = await phone('04 DIY·选择视频玩法', 3);
  await fill(s4, { r: 0.12, g: 0.12, b: 0.14 });
  await rpc('set_auto_layout', {
    nodeId: s4,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MAX',
    counterAxisAlignItems: 'MIN',
  });
  // spacer pushes sheet to bottom
  const dim = await rpc('create_frame', { name: 'Dimmed DIY', parentId: s4 });
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
    const sub = await text(sht.nodeId, '当前模板：粘土小狗 · 选后立即生效', { size: 12, color: C.muted });
    await rpc('set_layout_props', { nodeId: sub, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: sub, textAutoResize: 'HEIGHT' });
  }
  await text(sh.nodeId, '✕', { size: 18, color: C.muted });

  const playGrid = await rpc('create_frame', { name: 'PlayGrid', parentId: sheet.nodeId });
  await rpc('set_fills', { nodeId: playGrid.nodeId, fills: [] });
  await rpc('set_auto_layout', {
    nodeId: playGrid.nodeId,
    layoutMode: 'HORIZONTAL',
    layoutWrap: 'WRAP',
    itemSpacing: 8,
    counterAxisSpacing: 8,
  });
  await rpc('set_layout_props', {
    nodeId: playGrid.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
  });

  // Per-template plays from aigc-templates.json (prototype demo: 粘土小狗 3 备选)
  const plays = DEMO_PLAYS.length ? DEMO_PLAYS : ['小狗跳舞', '小狗跳高', '小狗打招呼'];
  for (let i = 0; i < plays.length; i++) {
    const on = i === 0;
    const cell = await rpc('create_frame', {
      name: `Play/${String(i + 1).padStart(2, '0')}`,
      parentId: playGrid.nodeId,
      width: 171,
    });
    await fill(cell.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: cell.nodeId, radius: 14 });
    await rpc('set_strokes', {
      nodeId: cell.nodeId,
      strokes: [{ type: 'SOLID', color: on ? C.green : C.line }],
      strokeWeight: on ? 2 : 1,
    });
    await rpc('set_auto_layout', {
      nodeId: cell.nodeId,
      layoutMode: 'VERTICAL',
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 10,
      paddingBottom: 12,
      itemSpacing: 8,
      primaryAxisAlignItems: 'MIN',
    });
    await rpc('set_layout_props', {
      nodeId: cell.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
      clipsContent: false,
    });
    const thumbWrap = await rpc('create_frame', {
      name: `PlayThumb/${String(i + 1).padStart(2, '0')}`,
      parentId: cell.nodeId,
      width: 151,
      height: 151,
    });
    await fill(thumbWrap.nodeId, C.white);
    await rpc('set_corner_radius', { nodeId: thumbWrap.nodeId, radius: 10 });
    await rpc('set_auto_layout', { nodeId: thumbWrap.nodeId, layoutMode: 'NONE' });
    // FIXED — FILL in a horizontal PlayGrid squeezes thumbs (~76px) and clips covers
    await rpc('set_layout_props', {
      nodeId: thumbWrap.nodeId,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await size(thumbWrap.nodeId, 151, 151);
    await placeFittedImage({
      parentId: thumbWrap.nodeId,
      name: `PlayCover/${String(i + 1).padStart(2, '0')}`,
      file: 'tpl-03-clay-dog.png',
      wrapW: 151,
      wrapH: 151,
    });
    const num = await text(cell.nodeId, String(i + 1).padStart(2, '0'), {
      size: 11,
      style: 'Semi Bold',
      color: C.green,
    });
    await rpc('set_layout_props', { nodeId: num, layoutSizingHorizontal: 'FILL' });
    const lab = await text(cell.nodeId, plays[i], { size: 13, style: 'Medium' });
    await rpc('set_layout_props', { nodeId: lab, layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'HUG' });
    await rpc('set_text_properties', { nodeId: lab, textAutoResize: 'HEIGHT' });
  }
  await text(sheet.nodeId, '玩法会持续更新', { size: 12, color: C.muted });

  // ═══════════ 05 作品详情 + 投放 ═══════════
  const s5 = await phone('05 作品详情·投放全息舱', 4);
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
  await text(n5.nodeId, '‹', { size: 24 });
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
  await text(titleLeft.nodeId, '粘土小狗 · 我的作品', { size: 13, color: C.muted });
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
  await placeFittedImage({
    parentId: player.nodeId,
    name: 'PlayerCover',
    file: 'tpl-03-clay-dog.png',
    wrapW: 350,
    wrapH: 240,
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
  const s6 = await phone('06 选择播放设备', 5);
  await fill(s6, { r: 0.12, g: 0.12, b: 0.14 });
  await rpc('set_auto_layout', {
    nodeId: s6,
    layoutMode: 'VERTICAL',
    itemSpacing: 0,
    primaryAxisAlignItems: 'MAX',
    counterAxisAlignItems: 'MIN',
  });
  const dim6 = await rpc('create_frame', { name: 'Dim', parentId: s6 });
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
  await text(sheet6.nodeId, '选择播放设备', { size: 18, style: 'Bold' });
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
        screens: [home, s2, s3, s4, s5, s6],
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
