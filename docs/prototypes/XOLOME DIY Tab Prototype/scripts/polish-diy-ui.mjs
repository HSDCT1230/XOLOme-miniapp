/**
 * Polish DIY prototype UI: Chinese fonts, borders, proportions, clip fixes.
 * Run: node polish-diy-ui.mjs  (Figwright Connected)
 */
import { randomUUID } from 'node:crypto';
import { encode, decode } from '@msgpack/msgpack';

const RPC = 'http://127.0.0.1:3055/rpc';

const FONT = 'Microsoft YaHei';
const STYLE_MAP = {
  Regular: 'Regular',
  Medium: 'Regular',
  'Semi Bold': 'Bold',
  Bold: 'Bold',
};

async function rpc(toolName, args = {}) {
  const requestId = randomUUID();
  const body = encode({ requestId, toolName, args });
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/msgpack' },
    body,
  });
  const decoded = decode(Buffer.from(await res.arrayBuffer()));
  if (decoded.kind === 'err') throw new Error(`${toolName}: ${decoded.message}`);
  return decoded.result;
}

async function size(ids, width, height) {
  await rpc('resize_nodes', {
    nodeIds: Array.isArray(ids) ? ids : [ids],
    width,
    height,
  });
}

async function fixFonts() {
  const scan = await rpc('scan_text_nodes', {});
  const texts = scan.nodes || scan.textNodes || scan || [];
  const list = Array.isArray(texts) ? texts : [];
  console.log('text nodes', list.length);
  let n = 0;
  for (const t of list) {
    const id = t.id || t.nodeId;
    const family = t.fontName?.family || '';
    const styleIn = t.fontName?.style || 'Regular';
    if (!id) continue;
    if (family === FONT && (styleIn === 'Regular' || styleIn === 'Bold')) {
      // still normalize line height
      try {
        await rpc('set_text_properties', {
          nodeId: id,
          lineHeight: { unit: 'PERCENT', value: 140 },
        });
      } catch {}
      continue;
    }
    const style = STYLE_MAP[styleIn] || 'Regular';
    try {
      await rpc('set_text_properties', {
        nodeId: id,
        fontName: { family: FONT, style },
        lineHeight: { unit: 'PERCENT', value: 140 },
      });
      n += 1;
    } catch (e) {
      console.warn('font fail', id, (t.characters || '').slice(0, 12), e.message);
    }
  }
  console.log('fonts updated', n);
}

async function main() {
  await fixFonts();

  // Candidate frames
  for (const fid of ['5:371', '5:374']) {
    try {
      await rpc('set_auto_layout', { nodeId: fid, layoutMode: 'NONE' });
      await rpc('set_layout_props', {
        nodeId: fid,
        layoutSizingHorizontal: 'FIXED',
        layoutSizingVertical: 'FIXED',
      });
      await size(fid, 150, 200);
      await rpc('set_strokes', {
        nodeId: fid,
        strokes: [
          {
            type: 'SOLID',
            color:
              fid === '5:371'
                ? { r: 110 / 255, g: 199 / 255, b: 59 / 255 }
                : { r: 0.9, g: 0.91, b: 0.93 },
          },
        ],
        strokeWeight: fid === '5:371' ? 2 : 1,
      });
      await rpc('set_corner_radius', { nodeId: fid, radius: 16 });
    } catch (e) {
      console.warn('frame fix', fid, e.message);
    }
  }

  // Sheet subtitle
  try {
    await rpc('set_layout_props', { nodeId: '5:406', layoutSizingHorizontal: 'FILL', layoutGrow: 1 });
    await rpc('set_layout_props', { nodeId: '5:408', layoutSizingHorizontal: 'FILL' });
    await rpc('set_text_properties', {
      nodeId: '5:408',
      textAutoResize: 'HEIGHT',
      fontName: { family: FONT, style: 'Regular' },
      fontSize: 12,
      lineHeight: { unit: 'PERCENT', value: 140 },
    });
  } catch (e) {
    console.warn('subtitle', e.message);
  }

  // Upload card
  try {
    await rpc('set_corner_radius', { nodeId: '5:338', radius: 16 });
    await rpc('set_strokes', {
      nodeId: '5:338',
      strokes: [{ type: 'SOLID', color: { r: 110 / 255, g: 199 / 255, b: 59 / 255 } }],
      strokeWeight: 1.5,
    });
  } catch (e) {
    console.warn('upload', e.message);
  }

  const btnFixes = [
    ['5:342', 167.5, 48, 24],
    ['5:344', 170.5, 48, 24],
    ['5:389', 318, 52, 26],
    ['5:463', 186, 52, 16],
    ['5:465', 72, 52, 16],
    ['5:467', 72, 52, 16],
    ['5:479', 312, 56, 16],
    ['5:206', 342, 44, 22],
  ];
  for (const [id, w, h, r] of btnFixes) {
    try {
      await size(id, w, h);
      await rpc('set_corner_radius', { nodeId: id, radius: r });
    } catch (e) {
      console.warn('btn', id, e.message);
    }
  }

  // Tab bars on all phone frames
  const doc = await rpc('get_document', {});
  for (const frame of doc.children || []) {
    if (frame.type !== 'FRAME') continue;
    const tree = await rpc('get_node', { nodeId: frame.id, depth: 2 });
    const bar = (tree.children || []).find((c) => c.name === 'Tab Bar');
    if (!bar) continue;
    try {
      await rpc('set_auto_layout', {
        nodeId: bar.id,
        layoutMode: 'HORIZONTAL',
        paddingLeft: 8,
        paddingRight: 8,
        paddingTop: 10,
        paddingBottom: 14,
        primaryAxisAlignItems: 'SPACE_BETWEEN',
        counterAxisAlignItems: 'CENTER',
      });
      await size(bar.id, 390, 64);
      const full = await rpc('get_node', { nodeId: bar.id, depth: 1 });
      for (const tab of full.children || []) {
        await rpc('set_layout_props', {
          nodeId: tab.id,
          layoutSizingHorizontal: 'FILL',
          layoutGrow: 1,
          layoutSizingVertical: 'HUG',
        });
      }
    } catch (e) {
      console.warn('tab', bar.id, e.message);
    }
  }

  // Play grid
  try {
    const grid = await rpc('search_nodes', { name: 'PlayGrid', type: 'FRAME' });
    const g = (grid.nodes || [])[0];
    if (g) {
      const full = await rpc('get_node', { nodeId: g.id, depth: 2 });
      for (const cell of full.children || []) {
        await size(cell.id, Math.max(cell.width || 160, 150), 72);
        await rpc('set_corner_radius', { nodeId: cell.id, radius: 14 });
        const selected = String(cell.name || '').includes('01');
        await rpc('set_strokes', {
          nodeId: cell.id,
          strokes: [
            {
              type: 'SOLID',
              color: selected
                ? { r: 110 / 255, g: 199 / 255, b: 59 / 255 }
                : { r: 0.9, g: 0.91, b: 0.93 },
            },
          ],
          strokeWeight: selected ? 2 : 1,
        });
      }
    }
  } catch (e) {
    console.warn('playgrid', e.message);
  }

  // Chips
  try {
    const chips = await rpc('search_nodes', { name: 'Chip/', type: 'FRAME' });
    for (const c of chips.nodes || []) {
      await rpc('set_corner_radius', { nodeId: c.id, radius: 16 });
      await rpc('set_layout_props', {
        nodeId: c.id,
        layoutSizingHorizontal: 'HUG',
        layoutSizingVertical: 'HUG',
      });
    }
  } catch (e) {
    console.warn('chips', e.message);
  }

  for (const nid of ['5:317', '5:358', '5:443']) {
    try {
      await size(nid, 390, 52);
    } catch {}
  }

  try {
    await rpc('set_corner_radius', { nodeId: '5:449', radius: 16 });
    await size('5:449', 350, 240);
  } catch {}

  for (const id of ['5:453', '5:456', '5:459']) {
    try {
      await size(id, 322, 40);
    } catch {}
  }

  for (const id of ['5:379', '5:384']) {
    try {
      await size(id, 318, 52);
      await rpc('set_corner_radius', { nodeId: id, radius: 12 });
    } catch {}
  }

  // Panel radius on screen 03
  try {
    await rpc('set_corner_radius', { nodeId: '5:377', radius: 20 });
  } catch {}

  // Home height
  try {
    const home = await rpc('get_node', { nodeId: '5:202', depth: 1 });
    let h = 0;
    for (const c of home.children || []) h += c.height || 0;
    if (h > 844) await size('5:202', 390, Math.ceil(h));
  } catch {}

  console.log('polish done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
