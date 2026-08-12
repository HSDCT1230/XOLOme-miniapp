/**
 * Hot-replace Cover for Card/person/02 变身机甲 with covers-v2/tpl-23-person-mecha.png
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { encode, decode } from '@msgpack/msgpack';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RPC = 'http://127.0.0.1:3055/rpc';
const file = join(root, 'covers-v2', 'tpl-23-person-mecha.png');
const COL_W = 181;
const H = 252;

async function rpc(toolName, args = {}) {
  const requestId = randomUUID();
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/msgpack' },
    body: encode({ requestId, toolName, args }),
  });
  const d = decode(Buffer.from(await res.arrayBuffer()));
  if (d.kind === 'err') throw new Error(`${toolName}: ${d.message}`);
  return d.result;
}

function aspectOf(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return buf.readUInt32BE(16) / buf.readUInt32BE(20);
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const m = buf[i + 1];
      if (m === 0xd9 || m === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xc3) {
        const h = buf.readUInt16BE(i + 5);
        const w = buf.readUInt16BE(i + 7);
        return w / h;
      }
      i += 2 + len;
    }
  }
  return 3 / 4;
}

const buf = readFileSync(file);
const data = buf.toString('base64');
const aspect = aspectOf(buf);

const found = await rpc('search_nodes', { name: 'Card/person/02' });
const cards = (found.nodes || []).filter((n) => n.name.startsWith('Card/person/02'));
console.log('cards', cards.length);

for (const card of cards) {
  const wraps = await rpc('search_nodes', { name: 'CoverWrap/', root: card.id });
  const wrap = (wraps.nodes || []).find((n) => n.name.startsWith('CoverWrap/'));
  if (!wrap) {
    console.log('no wrap', card.id);
    continue;
  }
  const kids = await rpc('get_node', { nodeId: wrap.id });
  const toDel = (kids.node?.children || [])
    .filter((c) => (c.name || '').startsWith('Cover/'))
    .map((c) => c.id);
  if (toDel.length) await rpc('delete_nodes', { nodeIds: toDel });

  await rpc('set_layout_props', {
    nodeId: wrap.id,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'FIXED',
    clipsContent: true,
  });
  await rpc('resize_nodes', { nodeIds: [wrap.id], width: COL_W, height: H });

  let iw = COL_W;
  let ih = COL_W / aspect;
  if (ih > H) {
    ih = H;
    iw = H * aspect;
  }
  iw = Math.max(1, Math.round(iw));
  ih = Math.max(1, Math.round(ih));
  const x = Math.round((COL_W - iw) / 2);
  const y = Math.round((H - ih) / 2);

  const img = await rpc('import_image', {
    data,
    name: 'Cover/02',
    parentId: wrap.id,
    width: iw,
    height: ih,
    scaleMode: 'FILL',
    x,
    y,
  });
  await rpc('resize_nodes', { nodeIds: [img.nodeId], width: iw, height: ih });
  await rpc('set_position', { nodeId: img.nodeId, x, y });

  const badge = (kids.node?.children || []).find((c) => (c.name || '').startsWith('Badge'));
  if (badge) {
    try {
      await rpc('reorder_nodes', { nodeIds: [badge.id], index: -1 });
    } catch {
      /* ignore */
    }
  }
  console.log('patched', card.id, `${iw}x${ih}`);
}

console.log(JSON.stringify({ ok: true, aspect, cards: cards.length }, null, 2));
