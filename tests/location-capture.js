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

  const allIds = ['japan', 'china', 'usa', 'uk', 'france', 'germany', 'italy', 'denmark', 'iceland', 'thailand', 'egypt', 'greece'];
  for (const id of allIds) {
    await page.evaluate((locId) => {
      window.dispatchEvent(new CustomEvent('soul:dev', { detail: { type: 'loadLocation', locationId: locId } }));
    }, id);
    console.log('[capture] switched to', id);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(__dirname, 'screenshots', `loc-${id}.png`) });
  }

  await browser.close();
  console.log('[capture] all locations saved');
})();
