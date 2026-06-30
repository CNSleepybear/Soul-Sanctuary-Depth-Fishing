// ===== scripts/generate-icon.mjs =====
// Generate multi-size icons and favicon from a single source PNG.
// Usage: place source image at assets/icons/icon-source.png, then run:
//   node scripts/generate-icon.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets', 'icons', 'icon-source.png');
const outDir = path.join(root, 'assets', 'icons');
const publicDir = path.join(root, 'public');

const SIZES = [16, 32, 48, 256];

async function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error(`[generate-icon] Source image not found: ${sourcePath}`);
    console.error('Please save your icon image as assets/icons/icon-source.png first.');
    process.exit(1);
  }

  console.log('[generate-icon] Reading source image...');
  const source = sharp(sourcePath);
  const meta = await source.metadata();

  if (meta.width !== meta.height) {
    console.warn(`[generate-icon] Source is ${meta.width}x${meta.height}, not square. It will be center-cropped to square.`);
  }

  // Generate PNGs for each size
  for (const size of SIZES) {
    const outPath = path.join(outDir, `icon-${size}.png`);
    await source
      .clone()
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(outPath);
    console.log(`[generate-icon] Created ${outPath}`);
  }

  // Copy 256x256 as main icon.png for mac/linux
  fs.copyFileSync(path.join(outDir, 'icon-256.png'), path.join(outDir, 'icon.png'));
  console.log('[generate-icon] Created assets/icons/icon.png');

  // Generate Windows ICO from 16,32,48,256 PNGs (electron-builder win.icon)
  const icoBuffers = SIZES.map((s) => path.join(outDir, `icon-${s}.png`));
  const winIco = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), winIco);
  console.log('[generate-icon] Created assets/icons/icon.ico');

  // Generate public favicon.ico from 16,32,48 PNGs
  const favBuffers = [16, 32, 48].map((s) => path.join(outDir, `icon-${s}.png`));
  const favIco = await pngToIco(favBuffers);
  fs.writeFileSync(path.join(publicDir, 'favicon.ico'), favIco);
  console.log('[generate-icon] Created public/favicon.ico');

  console.log('[generate-icon] Done.');
}

main().catch((err) => {
  console.error('[generate-icon] Failed:', err);
  process.exit(1);
});
