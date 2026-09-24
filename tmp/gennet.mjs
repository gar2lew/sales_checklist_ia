import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(20000);
page.addInitScript(() => { window.confirm = () => true; });
page.on('request', r => { if (r.url().includes('templ') || r.url().includes('icons') || r.url().includes('css') || r.url().includes('js')) console.log('REQ ' + r.method() + ' ' + r.url().replace('http://127.0.0.1:8766','')); });
page.on('requestfailed', r => console.log('REQFAIL ' + r.url().replace('http://127.0.0.1:8766','') + ' ' + r.failure()?.errorText));
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
await page.fill('#clientName', 'Fictional Test Client');
await page.locator('#signature').scrollIntoViewIfNeeded();
const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + 40, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 40, box.y + box.height/2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);
console.log('--- GENERATING ---');
await page.click('#generateTop');
for (let i = 0; i < 10; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => document.getElementById('status').textContent);
  console.log('P' + i + ' ' + s);
  if (s.includes('ready.')) break;
}
await browser.close();
