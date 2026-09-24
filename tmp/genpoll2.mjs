import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(20000);
page.addInitScript(() => { window.confirm = () => true; });
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
await page.evaluate(() => { window.__seen = []; });
await page.click('#generateTop');
const logs = [];
for (let i = 0; i < 12; i++) {
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => {
    const st = document.getElementById('status').textContent;
    if (!window.__seen.includes(st)) window.__seen.push(st);
    return {
      status: st,
      seen: window.__seen.slice(),
      genDisabled: document.getElementById('generateTop').disabled,
      dlDisabled: document.getElementById('downloadPackage').disabled,
      previewPages: document.getElementById('previewPaper').querySelectorAll('canvas:not(#previewOverlay)').length
    };
  });
  logs.push(s);
  console.log('P ' + JSON.stringify(s));
  if (s.status.includes('ready')) break;
}
await browser.close();
