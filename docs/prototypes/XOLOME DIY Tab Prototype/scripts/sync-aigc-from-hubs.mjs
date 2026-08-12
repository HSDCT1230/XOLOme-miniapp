/**
 * Sync aigc-templates.json display names / hub / order from hub-taxonomy.mjs
 * Preserves existing image_prompt + plays; adds pet/toy 复刻 if missing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HUBS } from '../hub-taxonomy.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'aigc-templates.json');
const data = JSON.parse(readFileSync(path, 'utf8'));
const byId = Object.fromEntries(data.templates.map((t) => [t.id, t]));

const LIGHT =
  ' Front key light from camera direction (frontal lighting), soft and even. Exactly one cast shadow behind the subject on the floor/backdrop. No multi-light setup, no strong side/rim lights, no multiple shadows.';

const REPLICA_PROMPTS = {
  tpl_00_realtime:
    'Keep the exact real-person identity from the reference photo. Photorealistic, natural skin and clothing, clean pure white studio photography wall, full subject in frame, 9:16 vertical, ready for hologram display. No stylization, no cartoon, no clay, no felt, no blind-box figure look.' +
    LIGHT,
  tpl_00_pet_realtime:
    'Keep the exact pet identity from the reference photo (breed, markings, fur color, face). Photorealistic pet product photo on a pure white studio backdrop, full subject in frame, 9:16 vertical, ready for hologram display. No stylization, no clay, no felt, no cartoon.' +
    LIGHT,
  tpl_00_toy_realtime:
    'Keep the exact toy / vehicle / object identity from the reference photo. Photorealistic product photo on a pure white studio backdrop, full subject in frame, 9:16 vertical, ready for hologram display. No stylization beyond clean product photography.' +
    LIGHT,
};

const NEW_PROMPTS = {
  tpl_23_person_mecha:
    'Keep the exact real-person identity from the reference photo (face, hair, body proportions). Photorealistic: the person is wearing a full sleek white/teal mecha armor suit with subtle lime energy accents; human face clearly visible (not a robot head). Clean pure white studio backdrop, full subject in frame, 9:16 vertical, product photography for hologram. Not chibi, not cartoon, not toy figure.' +
    LIGHT,
};

const NEW_PLAYS = {
  tpl_23_person_mecha: [
    {
      id: 'play_charge',
      name: '机甲出击',
      video_prompt:
        'Person in mecha armor steps forward and raises armored arm into attack stance, keep exact face identity, photorealistic, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_guard',
      name: '防御姿态',
      video_prompt:
        'Person in mecha armor shifts into a defensive guard pose with armored arms raised, keep exact face identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_powerup',
      name: '能量蓄力',
      video_prompt:
        'Mecha armor chest and joint lights glow with energy charge while person stands ready, keep exact face identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
  ],
};

const REPLICA_PLAYS = {
  tpl_00_realtime: byId.tpl_00_realtime?.plays,
  tpl_00_pet_realtime: [
    {
      id: 'play_wave',
      name: '抬头看镜头',
      video_prompt:
        'Pet looks up toward camera with a soft blink, keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_turn',
      name: '原地轻轻转圈',
      video_prompt:
        'Pet turns slowly in place then faces camera again, keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_cheer',
      name: '开心晃尾巴',
      video_prompt:
        'Pet shows a happy micro reaction (tail wag or ear perk), keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
  ],
  tpl_00_toy_realtime: [
    {
      id: 'play_wave',
      name: '轻微展示',
      video_prompt:
        'Toy/object does a subtle presentational tilt toward camera, keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_turn',
      name: '原地轻轻转圈',
      video_prompt:
        'Toy/object rotates slowly once then faces front, keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
    {
      id: 'play_cheer',
      name: '轻弹一下',
      video_prompt:
        'Toy/object makes a tiny bounce settle, keep exact identity, 4s Strictly inherit first-frame lighting: keep frontal key light and exactly one shadow behind the subject. The single shadow must move and deform naturally with the subject motion. Do not add a second light or second shadow; do not change light direction or intensity.',
    },
  ],
};

const next = [];
for (const hub of HUBS) {
  for (const t of hub.templates) {
    const prev = byId[t.id];
    next.push({
      id: t.id,
      n: t.n,
      name: t.name,
      hub: hub.id,
      hub_name: hub.name,
      cat: hub.tag,
      stylize: t.stylize,
      input_note: t.inputNote || prev?.input_note,
      image_prompt:
        prev?.image_prompt || REPLICA_PROMPTS[t.id] || NEW_PROMPTS[t.id] || prev?.image_prompt,
      plays: prev?.plays || REPLICA_PLAYS[t.id] || NEW_PLAYS[t.id] || [],
    });
    if (!(prev?.image_prompt || REPLICA_PROMPTS[t.id] || NEW_PROMPTS[t.id])) {
      console.warn('missing image_prompt', t.id);
    }
    if (!(prev?.plays || REPLICA_PLAYS[t.id] || NEW_PLAYS[t.id])?.length) {
      console.warn('missing plays', t.id);
    }
  }
}

data.version = '2026-08-11b';
data.note =
  'v2.1: 真人新增「变身机甲」(写实穿甲); 原Q版机甲改名「变身Q版机甲手办」迁入玩具.';
data.templates = next;
data.lighting = data.lighting;
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      version: data.version,
      count: next.length,
      hubs: HUBS.map((h) => ({ id: h.id, n: h.templates.length })),
    },
    null,
    2,
  ),
);
