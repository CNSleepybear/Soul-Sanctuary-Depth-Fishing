#!/usr/bin/env node
// Bulk-add baitRequired arrays to selected fish in fish-database.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../src/renderer/data/fish-database.ts');

/** @type {Record<string, string>} */
const BAIT_MAP = {
  // Mythic: all require spirit paste
  'jpn_yatagarasu_koi': 'bait_spirit_paste',
  'chn_loong_spirit': 'bait_spirit_paste',
  'usa_mainframe_whale': 'bait_spirit_paste',
  'uk_lady_of_lake': 'bait_spirit_paste',
  'fra_rose_carp': 'bait_spirit_paste',
  'deu_walpurgis_carp': 'bait_spirit_paste',
  'ita_bucentaur_fish': 'bait_spirit_paste',
  'dnk_little_mermaid_fish': 'bait_spirit_paste',
  'isl_odin_ray': 'bait_spirit_paste',
  'tha_royal_barge_fish': 'bait_spirit_paste',
  'egy_aten_disc': 'bait_spirit_paste',
  'grc_atlantis_fish': 'bait_spirit_paste',

  // Legendary: lure_spoon
  'jpn_koi_dragon': 'bait_lure_spoon',
  'chn_qilin_golden': 'bait_lure_spoon',
  'usa_singularity_disc': 'bait_lure_spoon',
  'fra_seine_wyrm': 'bait_lure_spoon',
  'deu_lorelei_trout': 'bait_lure_spoon',
  'tha_emerald_buddha_fish': 'bait_lure_spoon',

  // Legendary: shrimp
  'uk_excalibur_fish': 'bait_shrimp',
  'ita_siren_fish': 'bait_shrimp',
  'dnk_jormungandr_eel': 'bait_shrimp',
  'isl_northern_dragon': 'bait_shrimp',
  'egy_osiris_carp': 'bait_shrimp',
  'grc_icarus_fish': 'bait_shrimp',

  // Rare: bread
  'jpn_kaminari_uo': 'bait_bread',
  'chn_jade_turtle_fish': 'bait_bread',
  'usa_datamosh_eel': 'bait_bread',
  'fra_gargoyle_fish': 'bait_bread',
  'deu_snow_eel': 'bait_bread',
  'ita_murano_koi': 'bait_bread',

  // Rare: shrimp
  'uk_ghost_carp': 'bait_shrimp',
  'dnk_viking_axe_fish': 'bait_shrimp',
  'isl_aurora_trout': 'bait_shrimp',
  'tha_naga_eel': 'bait_shrimp',
  'egy_crocodile_fish': 'bait_shrimp',
  'grc_blue_damsel': 'bait_shrimp',
};

/**
 * Split top-level comma-separated arguments, respecting (), [], {} nesting.
 * @param {string} text
 * @returns {string[]}
 */
function splitArgs(text) {
  let depth = 0;
  let last = 0;
  const args = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(text.slice(last, i));
      last = i + 1;
    }
  }
  args.push(text.slice(last));
  return args.map(a => a.trim()).filter(Boolean);
}

/**
 * @param {string} src
 * @param {string} fishId
 * @returns {[number, number] | null}
 */
function findCallRange(src, fishId) {
  const startMarker = `f('${fishId}',`;
  const start = src.indexOf(startMarker);
  if (start === -1) return null;
  const paren = src.indexOf('(', start);
  if (paren === -1) return null;
  let depth = 1;
  let i = paren + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    i++;
  }
  return [start, i];
}

let src = readFileSync(DB_PATH, 'utf-8');
let total = 0;
for (const [fishId, baitId] of Object.entries(BAIT_MAP)) {
  const rng = findCallRange(src, fishId);
  if (!rng) {
    console.warn(`WARNING: no match for ${fishId}`);
    continue;
  }
  const [start, end] = rng;
  const callText = src.slice(start, end);
  const parenOpen = callText.indexOf('(');
  const inner = callText.slice(parenOpen + 1, -1);
  const args = splitArgs(inner);
  // f(...) signature: bait is the 19th argument (index 18)
  while (args.length < 18) args.push('undefined');
  args[18] = `['${baitId}']`;
  const newCall = 'f(' + args.join(', ') + ')';
  src = src.slice(0, start) + newCall + src.slice(end);
  total++;
}
writeFileSync(DB_PATH, src, 'utf-8');
console.log(`Updated ${total} fish entries in ${DB_PATH}`);
