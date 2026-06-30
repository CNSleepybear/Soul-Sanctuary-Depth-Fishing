import { chromium } from 'playwright';
import { setTimeout } from 'timers/promises';
import path from 'path';

const chromePath = path.resolve('C:/Program Files/Google/Chrome/Application/chrome.exe');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const page = await context.newPage();

  await page.goto('http://localhost:4185/');
  await setTimeout(3000);

  // Simulate night sky background for aurora visibility
  await page.evaluate(() => {
    document.body.style.background = '#040508';
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.style.background = 'transparent';
  });

  // Cycle test button to Iceland
  const testBtn = page.locator('text=🔁 Test:');
  for (let i = 0; i < 8; i++) {
    await testBtn.click();
    await setTimeout(200);
  }
  await setTimeout(1000);
  await page.screenshot({ path: 'screenshots/70-aurora-1.png' });

  await setTimeout(1500);
  await page.screenshot({ path: 'screenshots/71-aurora-2.png' });

  await setTimeout(1500);
  await page.screenshot({ path: 'screenshots/72-aurora-3.png' });

  await browser.close();
  console.log('done');
})();
