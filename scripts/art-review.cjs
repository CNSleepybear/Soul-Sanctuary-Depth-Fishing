// Capture the real Electron renderer for visual review. Does not change saves.
const { _electron } = require('@playwright/test');
const { mkdir } = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const output = path.resolve('screenshots/art-review');
  await mkdir(output, { recursive: true });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ args: ['.', '--no-sandbox', '--disable-gpu'], env });
  const errors = [];
  const stats = {};
  try {
    const page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForSelector('#btn-start', { state: 'visible' });
    // Fix the review viewport without writing the player's resolution preference.
    const setReviewSize = async (width, height) => {
      await app.evaluate(
        ({ BrowserWindow }, size) => {
          const win = BrowserWindow.getAllWindows()[0];
          win.setResizable(true);
          win.setSize(size.width, size.height);
          win.setResizable(false);
        },
        { width, height },
      );
      await page.waitForTimeout(450);
      const viewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
      }));
      if (viewport.width !== width || viewport.height !== height) {
        errors.push(
          `viewport ${width}x${height} requested, got ${viewport.width}x${viewport.height}`,
        );
      }
    };
    await setReviewSize(640, 480);
    const locations = [
      'japan',
      'china',
      'usa',
      'uk',
      'france',
      'germany',
      'italy',
      'denmark',
      'iceland',
      'thailand',
      'egypt',
      'greece',
    ];
    for (const locationId of locations) {
      await page.evaluate((id) => {
        window.dispatchEvent(
          new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: id } }),
        );
      }, locationId);
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
      stats[locationId] = await page.evaluate(() => {
        const probe = window.__soul;
        return probe ? probe.stats() : null;
      });
      await page.screenshot({ path: path.join(output, `${locationId}.png`), omitBackground: true });
    }
    await page.evaluate(() =>
      window.dispatchEvent(
        new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: 'japan' } }),
      ),
    );
    await page.locator('#btn-start').click();
    await page.locator('#camp-panel').waitFor();
    await page.screenshot({ path: path.join(output, 'camp.png') });
    await page.locator('#camp-panel .panel-close-btn').click();
    await page
      .locator('[aria-label]')
      .filter({ has: page.locator('svg') })
      .first()
      .click();
    await page.locator('#fishpedia').waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, 'fishpedia.png') });
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await page.locator('#fishpedia').waitFor({ state: 'hidden' });

    const soulPanel = page.locator('#soul-sanctuary-panel');
    await page.locator('#scene-toolbar [aria-label]').nth(1).click();
    await soulPanel.waitFor({ state: 'visible' });
    await page.screenshot({ path: path.join(output, 'souls.png') });

    // Compact / Standard window sizes: verify the scene and soul panel at every preset.
    for (const [width, height, name] of [
      [400, 300, 'compact'],
      [560, 420, 'standard'],
    ]) {
      await setReviewSize(width, height);
      if (!(await soulPanel.isVisible())) {
        await page.locator('#scene-toolbar [aria-label]').nth(1).click();
      }
      await soulPanel.waitFor({ state: 'visible' });
      await page.screenshot({ path: path.join(output, `souls-${name}.png`) });
      await page.evaluate(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      await soulPanel.waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(output, `japan-${name}.png`), omitBackground: true });
    }
    await setReviewSize(640, 480);

    // Transparent-background probe: corner pixels must be fully transparent.
    const japanPath = path.join(output, 'japan.png');
    const { data, info } = await sharp(japanPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let opaque = 0;
    const total = info.width * info.height;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 8) opaque++;
    const cornerAlpha = [
      data[3],
      data[(info.width - 1) * 4 + 3],
      data[(info.height - 1) * info.width * 4 + 3],
      data[(total - 1) * 4 + 3],
    ];
    const coverage = opaque / total;

    const thumbnails = await Promise.all(
      locations.map((id) =>
        sharp(path.join(output, `${id}.png`))
          .flatten({ background: '#e5e8df' })
          .resize(480, 360)
          .toBuffer(),
      ),
    );
    await sharp({ create: { width: 1920, height: 1080, channels: 3, background: '#e5e8df' } })
      .composite(
        thumbnails.map((input, index) => ({
          input,
          left: (index % 4) * 480,
          top: Math.floor(index / 4) * 360,
        })),
      )
      .png()
      .toFile(path.join(output, 'contact-sheet.png'));
    await sharp(path.join(output, 'japan.png'))
      .flatten({ background: '#e5e8df' })
      .png()
      .toFile(path.join(output, 'japan-preview.png'));
    const budget = { maxCalls: 140, maxTriangles: 150000, violations: [] };
    for (const [locationId, stat] of Object.entries(stats)) {
      if (!stat) {
        budget.violations.push(`${locationId}: missing renderer stats`);
        continue;
      }
      if (stat.calls > budget.maxCalls) {
        budget.violations.push(`${locationId}: ${stat.calls} calls > ${budget.maxCalls}`);
      }
      if (stat.triangles > budget.maxTriangles) {
        budget.violations.push(
          `${locationId}: ${stat.triangles} triangles > ${budget.maxTriangles}`,
        );
      }
    }
    const worstLocation =
      Object.values(stats)
        .filter(Boolean)
        .sort((a, b) => b.calls - a.calls)[0] ?? null;
    const transparencyPassed = cornerAlpha.every((alpha) => alpha === 0);
    console.log(
      JSON.stringify(
        {
          output,
          locations: locations.length,
          errors,
          transparency: { cornerAlpha, coverage, passed: transparencyPassed },
          budget: { ...budget, worstLocation },
          stats,
        },
        null,
        2,
      ),
    );
    if (errors.length || !transparencyPassed || budget.violations.length) process.exitCode = 1;
  } finally {
    await app.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
