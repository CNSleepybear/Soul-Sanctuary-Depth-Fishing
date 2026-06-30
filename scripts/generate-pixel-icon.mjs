// ===== scripts/generate-pixel-icon.mjs =====
// Generate a black-background pixel-art bobber icon for Soul Sanctuary.
// Writes assets/icons/icon-source.png (1024x1024) which can then be fed
// through scripts/generate-icon.mjs to produce all app/favicon sizes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'assets', 'icons', 'icon-source.png');

const GRID = 32;
const SCALE = 32; // 32 * 32 = 1024
const SIZE = GRID * SCALE;

const PALETTE = {
  bg: '#0a0a0f',
  red: '#e63946',
  redLight: '#ff4d5a',
  white: '#f1faee',
  whiteShadow: '#d8e0e3',
  water: '#1d3557',
  waterLight: '#457b9d',
  waterHighlight: '#a8dadc',
};

// Pixel art map: each string is one row of the 32x32 grid.
// '.' = background, 'r' = red, 'R' = light red, 'w' = white,
// 's' = white shadow, 'W' = water, 'L' = light water, 'H' = water highlight.
const PIXELS = [
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '............RR..RR..............',
  '...........rrrrrrrr.............',
  '..........rrrrrrrrrr............',
  '.........rrrrrrrrrrrr...........',
  '........wwwwwwwwwwww............',
  '........wwwwwwwwwwww............',
  '.......rrrrrrrrrrrrrr...........',
  '.......rrrrrrrrrrrrrr...........',
  '.......rrrrrrrrrrrrrr...........',
  '.......wwwwwwwwwwwwww...........',
  '.......wwwwwwwwwwwwww...........',
  '.......wwwwwwwwwwwwww...........',
  '........rrrrrrrrrrrr............',
  '........rrrrrrrrrrrr............',
  '.........rrrrrrrrrr.............',
  '..........rrrrrrrr..............',
  '...........rrrrrr...............',
  '................................',
  '................................',
  '......WLL.......WLL...W.........',
  '....WWLLL.......WWLLWW..........',
  '....WLLLHH.....WWLLLH...........',
  '.....WLL........WLL.............',
  '................................',
  '................................',
];

function buildSvg() {
  let rects = '';
  for (let y = 0; y < GRID; y++) {
    const row = PIXELS[y] || '.'.repeat(GRID);
    for (let x = 0; x < GRID; x++) {
      const ch = row[x] || '.';
      if (ch === '.') continue;
      const color =
        {
          r: PALETTE.red,
          R: PALETTE.redLight,
          w: PALETTE.white,
          s: PALETTE.whiteShadow,
          W: PALETTE.water,
          L: PALETTE.waterLight,
          H: PALETTE.waterHighlight,
        }[ch] || PALETTE.bg;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${color}" />`;
    }
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" shape-rendering="crispEdges" width="${SIZE}" height="${SIZE}">
  <rect width="${GRID}" height="${GRID}" fill="${PALETTE.bg}" />
  ${rects}
</svg>
  `.trim();
}

async function main() {
  const svg = buildSvg();
  await sharp(Buffer.from(svg))
    .resize(SIZE, SIZE, { kernel: 'nearest' })
    .png()
    .toFile(outPath);
  console.log(`[generate-pixel-icon] Created ${outPath}`);
}

main().catch((err) => {
  console.error('[generate-pixel-icon] Failed:', err);
  process.exit(1);
});
