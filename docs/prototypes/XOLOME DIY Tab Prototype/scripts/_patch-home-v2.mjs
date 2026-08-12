import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const path = join(dirname(fileURLToPath(import.meta.url)), 'build-diy-flow.mjs');
let s = fs.readFileSync(path, 'utf8');
const start = s.indexOf('  // ═══════════ 01 首页瀑布流 ═══════════');
const end = s.indexOf('  // ═══════════ 02 上传照片 ═══════════');
if (start < 0 || end < 0) {
  console.error('markers missing', start, end);
  process.exit(1);
}

const repl = `  // ═══════════ 01 首页 · 三大类入口 ═══════════
  const home = await phone('01 首页·三大类', 0);
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
  await text(hHead.nodeId, '按原图类型选择：真人 / 宠物 / 玩具，再挑复刻或变身风格', {
    size: 13,
    color: C.muted,
  });

  const body = await rpc('create_frame', { name: 'Body', parentId: home, width: 390 });
  await fill(body.nodeId, C.bg);
  await rpc('set_auto_layout', {
    nodeId: body.nodeId,
    layoutMode: 'VERTICAL',
    paddingLeft: 10,
    paddingRight: 10,
    paddingTop: 8,
    paddingBottom: 20,
    itemSpacing: 12,
  });
  await rpc('set_layout_props', {
    nodeId: body.nodeId,
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'HUG',
    layoutAlign: 'STRETCH',
  });

  for (const hub of HUBS) {
    await createHubCard(body.nodeId, hub);
  }

  await rpc('set_layout_props', {
    nodeId: home,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'HUG',
    clipsContent: false,
    overflowDirection: 'NONE',
    numberOfFixedChildren: 0,
  });
  await rpc('rename_node', { nodeId: home, name: '01 首页·三大类（全高）' }).catch(() => {});

  {
    const homeAfter = (await rpc('get_node', { nodeId: home })).node;
    const phonePv = await rpc('create_frame', {
      name: '01 手机预览·可滚动',
      x: 9 * (390 + 60) + 80,
      y: 0,
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
    const cloned = await rpc('clone_node', { nodeId: home });
    await rpc('rename_node', { nodeId: cloned.nodeId, name: 'HomeScrollContent' });
    await rpc('reparent_nodes', { nodeIds: [cloned.nodeId], newParentId: phonePv.nodeId });
    await rpc('set_layout_props', {
      nodeId: cloned.nodeId,
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
      clipsContent: false,
      overflowDirection: 'NONE',
      numberOfFixedChildren: 0,
    });
    console.log('home hubs', homeAfter?.height || 'hug', '+ phone', phonePv.nodeId);
  }

  // ═══════════ 01a/b/c 二级风格瀑布流 ═══════════
  const hubPages = {};
  for (let i = 0; i < HUBS.length; i++) {
    hubPages[HUBS[i].id] = await buildHubWaterfallPage(HUBS[i], i + 1);
  }

`;

s = s.slice(0, start) + repl + s.slice(end);
s = s.replace("await phone('02 DIY·上传照片', 1)", "await phone('02 DIY·上传照片', 4)");
s = s.replace(/await phone\('03 DIY·生成首帧',\s*2\)/, "await phone('03 DIY·生成首帧', 5)");
s = s.replace(/await phone\('04 DIY·选择玩法',\s*3\)/, "await phone('04 DIY·选择玩法', 6)");
s = s.replace(/await phone\('05 DIY·作品详情',\s*4\)/, "await phone('05 DIY·作品详情', 7)");
s = s.replace(/await phone\('06 DIY·投放设备',\s*5\)/, "await phone('06 DIY·投放设备', 8)");
s = s.replace(
  /screens: \[home, s2, s3, s4, s5, s6\],\s*templates: TEMPLATES\.length,/,
  `screens: [home, hubPages.person, hubPages.pet, hubPages.toy, s2, s3, s4, s5, s6],
        hubs: HUBS.map((h) => ({ id: h.id, n: h.templates.length })),
        templates: TEMPLATES.length,`,
);

fs.writeFileSync(path, s);
console.log('ok patched home v2');
