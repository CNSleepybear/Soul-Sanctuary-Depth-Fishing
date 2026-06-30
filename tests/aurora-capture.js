const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  await page.goto('http://localhost:4185');
  await page.waitForSelector('#game-canvas', { timeout: 10000 });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    document.body.style.setProperty('background-color', '#020308', 'important');
    document.documentElement.style.setProperty('background-color', '#020308', 'important');
  });

  // Iceland aurora shots
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: 'iceland' } }));
  });
  console.log('[aurora] switched to: iceland');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'aurora-1.png') });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'aurora-2.png') });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'aurora-3.png') });

  // Verify switching back to Japan restores transparent background
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: 'japan' } }));
  });
  console.log('[aurora] switched back to: japan');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(__dirname, 'screenshots', 'aurora-japan.png') });

  await browser.close();
  console.log('[aurora] screenshots saved');
})();
