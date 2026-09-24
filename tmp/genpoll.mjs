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
await page.waitForTimeout(300);
await page.evaluate(() => {
  window.__errs = [];
  window.addEventListener('error', e => window.__errs.push('err:' + e.message));
  window.addEventListener('unhandledrejection', e => window.__errs.push('rej:' + String(e.reason && (e.reason.message || e.reason)).slice(0,200)));
});
console.log('START click');
await page.click('#generateTop');
// marker: does validation block? status check
const poll = [];
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(3000);
  const s = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    genDisabled: document.getElementById('generateTop').disabled,
    btnDisabled: document.getElementById('downloadPackage').disabled,
    previewPaperChildren: document.getElementById('previewPaper').children.length,
    errs: window.__errs
  }));
  poll.push(s);
  console.log('POLL ' + JSON.stringify(s));
  if (poll.length >= 2 && pol_close(s)) break;
  if (i === 19) {}
}
function pol_close(){ return false; }
await browser.close();
