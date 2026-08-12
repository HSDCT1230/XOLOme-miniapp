/**
 * Hotfix: L2 waterfall cards snapped to 100px — restore COL_W=181 + cover heights.
 * Requires Figwright Connected. Prefer full rebuild; this is a fast patch.
 */
import { randomUUID } from 'node:crypto';
import { encode, decode } from '@msgpack/msgpack';
import { HUBS } from '../hub-taxonomy.mjs';

const RPC = 'http://127.0.0.1:3055/rpc';
const COL_W = 181;

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

const heightByKey = new Map();
for (const hub of HUBS) {
  for (const t of hub.templates) {
    heightByKey.set(`${hub.id}/${t.n}`, t.h);
  }
}

const found = await rpc('search_nodes', { name: 'Card/', type: 'FRAME' });
const cards = (found.nodes || []).filter((n) => /Card\/(person|pet|toy)\/\d+/.test(n.name));
console.log('cards', cards.length);

let fixed = 0;
for (const card of cards) {
  const m = card.name.match(/Card\/(person|pet|toy)\/(\d+)/);
  if (!m) continue;
  const h = heightByKey.get(`${m[1]}/${m[2]}`) || 228;

  await rpc('set_layout_props', {
    nodeId: card.id,
    layoutSizingHorizontal: 'FIXED',
    layoutSizingVertical: 'HUG',
    clipsContent: true,
  });
  await rpc('resize_nodes', { nodeIds: [card.id], width: COL_W, height: Math.max(card.height || 120, 120) });

  const covers = await rpc('search_nodes', { name: 'CoverWrap/', root: card.id });
  for (const cw of covers.nodes || []) {
    if (!cw.name.startsWith('CoverWrap/')) continue;
    await rpc('set_layout_props', {
      nodeId: cw.id,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'FIXED',
      clipsContent: true,
    });
    await rpc('resize_nodes', { nodeIds: [cw.id], width: COL_W, height: h });
  }
  fixed++;
  if (fixed % 5 === 0) console.log('fixed', fixed);
}

// Columns
for (const name of ['Col L', 'Col R']) {
  const cols = await rpc('search_nodes', { name, type: 'FRAME' });
  for (const c of cols.nodes || []) {
    if (c.name !== name) continue;
    await rpc('set_layout_props', {
      nodeId: c.id,
      layoutSizingHorizontal: 'FIXED',
      layoutSizingVertical: 'HUG',
    });
    await rpc('resize_nodes', { nodeIds: [c.id], width: COL_W, height: c.height || 100 });
  }
}

console.log(JSON.stringify({ ok: true, fixed }, null, 2));
