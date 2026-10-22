import { test, expect, _electron as electron } from '@playwright/test';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

/**
 * SoulSanctuary — Electron Smoke Test
 *
 * Launches the production Electron app and verifies:
 * 1. Window exists and has correct title
 * 2. Canvas (#game-canvas) is rendered
 * 3. START button is visible
 * 4. Drag bar with orb and close button exist
 * 5. Clicking START opens the camp panel
 * 6. Fishpedia toggle (F key) works
 * 7. Soul sanctuary panel opens with the shared visual system
 * 8. Full fishing flow: camp → charms → embark → cast
 * 9. Idle and waiting scenes stay within the render budget
 *
 * Run: npx playwright test tests/smoke.spec.ts --reporter=list
 * Prerequisites: `npm run build` must have been run first
 */

test.describe('SoulSanctuary Electron Smoke', () => {
  test.setTimeout(60000);

  test('bundled music plays all tracks, loops, and remembers settings', async () => {
    const env = { ...process.env };
    delete (env as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;
    const profile = mkdtempSync(join(tmpdir(), 'soul-sanctuary-music-'));
    const electronApp = await electron.launch({
      args: ['.', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`],
      executablePath: require('electron'),
      env,
    });

    try {
      const window = await electronApp.firstWindow();
      await expect(window.locator('#btn-start')).toBeVisible();
      const music = window.locator('audio[data-soul-music]');
      await expect(music).toHaveCount(0);
      const openSettings = async () => {
        await window.locator('#scene-toolbar [aria-label]').nth(2).click();
        await expect(window.locator('#music-track')).toBeVisible();
      };
      await openSettings();
      await expect(music).toHaveCount(1);

      const tracks = ['abyssal-lamps', 'bruise-of-ink', 'lingering-threshold'];
      for (const track of tracks) {
        await window.locator('#music-track').selectOption(track);
        await expect
          .poll(() =>
            music.evaluate((element) => {
              const audio = element as HTMLAudioElement;
              return !audio.paused && audio.currentTime > 0 && audio.error === null;
            }),
          )
          .toBe(true);
        expect(await music.evaluate((element) => (element as HTMLAudioElement).duration)).toBe(120);
      }

      // Let the final song actually end, verifying the native ended event and wraparound.
      await music.evaluate((element) => {
        const audio = element as HTMLAudioElement;
        audio.currentTime = audio.duration - 0.15;
      });
      await expect(window.locator('#music-track')).toHaveValue(tracks[0]);
      await expect
        .poll(() => music.evaluate((element) => (element as HTMLAudioElement).currentTime))
        .toBeGreaterThan(0);

      const originalSource = await music.getAttribute('src');
      await window.evaluate(() => {
        window.dispatchEvent(
          new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: 'china' } }),
        );
      });
      await expect(music).toHaveAttribute('src', originalSource!);
      await expect(music).toHaveCount(1);

      await window.locator('#music-volume').fill('23');
      await expect(window.locator('#music-volume-value')).toHaveText('23%');
      expect(await music.evaluate((element) => (element as HTMLAudioElement).volume)).toBe(0.23);
      await window.locator('#music-enabled').uncheck();
      expect(await music.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);

      // A disabled playlist must stay silent when choosing another song and after reload.
      await window.locator('#music-track').selectOption(tracks[1]);
      expect(await music.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
      await window.reload();
      await expect(window.locator('#btn-start')).toBeVisible();
      await openSettings();
      await expect(music).toHaveCount(0);
      await expect(window.locator('#music-enabled')).not.toBeChecked();
      await expect(window.locator('#music-track')).toHaveValue(tracks[1]);
      await expect(window.locator('#music-volume')).toHaveValue('23');
      await window.locator('#music-enabled').check();
      await expect
        .poll(() =>
          music.evaluate((element) => {
            const audio = element as HTMLAudioElement;
            return !audio.paused && audio.currentTime > 0 && audio.error === null;
          }),
        )
        .toBe(true);
      expect(await music.evaluate((element) => (element as HTMLAudioElement).volume)).toBe(0.23);
      await window.screenshot({ path: 'tests/screenshots/07-music-settings.png' });
    } finally {
      await electronApp
        .evaluate(({ app }) => app.exit(0))
        .catch(() => {
          electronApp.process().kill();
        });
    }
  });

  test('app launches, renders UI, respects render budget, and completes fishing flow', async () => {
    // ── Launch Electron app ──
    // Use the packaged executable in CI; fall back to the Electron module locally.
    const executablePath = process.env.CI
      ? join(__dirname, '..', 'release', 'win-unpacked', 'Soul Sanctuary.exe')
      : require('electron');

    // Prevent Electron from running as plain Node (breaks window creation).
    const env = { ...process.env };
    delete (env as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;

    const profile = mkdtempSync(join(tmpdir(), 'soul-sanctuary-smoke-'));
    const electronApp = await electron.launch({
      args: ['.', '--no-sandbox', '--disable-gpu', `--user-data-dir=${profile}`],
      executablePath,
      env,
    });

    const window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');

    // ── 1. Window title ──
    const title = await window.title();
    expect(title).toBe('Soul Sanctuary');
    console.log('[Smoke] ✅ Window title:', title);

    // ── 2. Canvas visible ──
    const canvas = window.locator('#game-canvas');
    await expect(canvas).toBeVisible({ timeout: 8000 });
    console.log('[Smoke] ✅ Canvas visible');

    const expectRenderBudget = async (stage: string): Promise<void> => {
      const stats = await window.evaluate(() => {
        const probe = (
          window as unknown as {
            __soul?: { stats: () => { calls: number; triangles: number } };
          }
        ).__soul;
        return probe?.stats() ?? null;
      });
      expect(stats, `${stage} render stats`).not.toBeNull();
      expect(stats!.calls, `${stage} draw calls`).toBeLessThanOrEqual(140);
      expect(stats!.triangles, `${stage} triangles`).toBeLessThanOrEqual(150000);
      console.log(
        `[Smoke] ✅ ${stage} render budget: ${stats!.calls} calls / ${stats!.triangles} triangles`,
      );
    };

    // ── 3. Drag bar / orb / close ──
    await expect(window.locator('#drag-bar')).toBeVisible();
    await expect(window.locator('#drag-orb')).toBeVisible();
    await expect(window.locator('#btn-close')).toBeVisible();
    console.log('[Smoke] ✅ Drag bar + orb + close');

    // ── 4. START button ──
    const startBtn = window.locator('#btn-start');
    await expect(startBtn).toBeVisible({ timeout: 3000 });
    console.log('[Smoke] ✅ START button');
    await expectRenderBudget('Idle');

    await window.screenshot({ path: 'tests/screenshots/01-idle.png' });

    // ── 5. Click START → camp panel ──
    await startBtn.click();
    await window.waitForTimeout(1000);

    // Verify camp panel content
    const campPanel = window.locator('#camp-panel');
    await expect(campPanel).toBeVisible({ timeout: 3000 });
    await expect(window.locator('#btn-start-run')).toBeVisible();
    console.log('[Smoke] ✅ Camp panel + START RUN button');

    await window.screenshot({ path: 'tests/screenshots/02-camp.png' });

    // ── 6. Close camp panel via close button ──
    const closeBtn = campPanel.locator('.panel-close-btn').first();
    await closeBtn.click();
    await window.waitForTimeout(600);
    console.log('[Smoke] ✅ Camp panel closed');

    // ── 7. Open Fishpedia — dispatch keydown directly on canvas ──
    // Playwright keyboard.press() may not reach canvas event listeners in Electron.
    // Direct dispatchEvent ensures InputManager._onKeyDown fires.
    await canvas.evaluate((el) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
    });
    await window.waitForTimeout(1000);

    // Fishpedia should be visible
    await expect(window.locator('#fishpedia')).toBeVisible({ timeout: 5000 });
    console.log('[Smoke] ✅ Fishpedia opened');

    await window.screenshot({ path: 'tests/screenshots/03-fishpedia.png' });

    // ── 8. Close Fishpedia — dispatch Escape on document for global handler ──
    await window.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(window.locator('#fishpedia')).toBeHidden();

    // ── 9. Soul sanctuary uses the shared panel system ──
    await window.locator('#scene-toolbar [aria-label]').nth(1).click();
    const soulPanel = window.locator('#soul-sanctuary-panel');
    await expect(soulPanel).toBeVisible();
    expect(
      await soulPanel.evaluate(
        (element) => element.ownerDocument.defaultView?.getComputedStyle(element).display,
      ),
    ).toBe('flex');
    expect(await soulPanel.locator('.soul-card[data-collected="false"]').count()).toBeGreaterThan(
      0,
    );
    await expect(soulPanel.locator('.soul-card').first()).toBeVisible();
    await window.screenshot({ path: 'tests/screenshots/03-soul-sanctuary.png' });
    await window.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    await expect(soulPanel).toBeHidden();
    console.log('[Smoke] ✅ Soul sanctuary opened and closed');

    // ── 10. Full fishing flow ──
    // Re-open camp
    await startBtn.click();
    await window.waitForTimeout(800);

    // Click START RUN
    await window.locator('#btn-start-run').click();
    await window.waitForTimeout(800);

    // Should now be in charm picker
    const embarkBtn = window.locator('#btn-embark');
    const embarkExists = await embarkBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (embarkExists) {
      console.log('[Smoke] ✅ Charm picker visible');

      // Select charms by clicking on cards
      // Charm cards have the CARD_STYLE and contain charm name + description
      const charmCards = window.getByTestId('charm-card');
      const cardCount = await charmCards.count();
      expect(cardCount).toBe(8);
      console.log(`[Smoke] Found ${cardCount} charm candidates`);

      const slotsNeeded = 3;
      let selected = 0;
      for (let i = 0; i < Math.min(cardCount, 8) && selected < slotsNeeded; i++) {
        const card = charmCards.nth(i);
        const visible = await card.isVisible().catch(() => false);
        if (visible) {
          await card.click();
          selected++;
          console.log(`[Smoke]   Selected charm ${selected}/${slotsNeeded}`);
          await window.waitForTimeout(200);
        }
      }

      // Click EMBARK
      await expect(window.locator('[data-testid="charm-card"][data-selected="true"]')).toHaveCount(
        3,
      );
      await embarkBtn.first().click();
      await expect(window.locator('#bait-picker')).toBeVisible();
      await window.locator('#btn-confirm-bait').click();
      await expect(window.locator('#run-hud')).toBeVisible();
      await window.waitForTimeout(1000);
      console.log('[Smoke] ✅ Run embarked!');

      await window.screenshot({ path: 'tests/screenshots/04-fishing.png' });

      // ── Simulate casting ──
      const box = await canvas.boundingBox();
      if (box) {
        const cx = box.x + box.width / 2;
        const cy = box.y + box.height / 2;

        await window.mouse.move(cx, cy);
        await window.mouse.down();
        await expect(window.locator('#cast-bar')).toBeVisible();
        console.log('[Smoke] 🎣 Casting (mouse down)...');
        await window.waitForTimeout(400);
        await window.mouse.up();
        console.log('[Smoke] 🎣 Cast released!');

        await window.screenshot({ path: 'tests/screenshots/05-casting.png' });

        // Quick wait for potential nibble
        await window.waitForTimeout(2000);
        await expectRenderBudget('Waiting');

        await window.screenshot({ path: 'tests/screenshots/06-waiting.png' });
      }
    } else {
      throw new Error('Charm picker did not appear; fishing flow could not be verified');
    }

    // ── Cleanup ──
    // The app stays in the system tray by default, so plain close() can hang.
    // Use app.exit(0) to force a clean teardown of the Electron process tree.
    try {
      await electronApp.evaluate(({ app }) => app.exit(0));
    } catch (err: unknown) {
      console.warn('[Smoke] app.exit() failed:', err);
      electronApp.process().kill();
    }
    console.log('[Smoke] ✅ Done');
  });
});
