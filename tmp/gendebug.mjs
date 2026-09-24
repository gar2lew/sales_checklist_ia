import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.on('pageerror', e => console.log('PAGEERR', e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0,300)); });
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
console.log('sig1Date=' + await page.inputValue('#waiverClient1Date'));
console.log('sig2Date=' + await page.inputValue('#waiverClient2Date'));
console.log('includeWaiver=' + await page.evaluate(() => document.getElementById('includeWaiver')?.checked));
console.log('zoomIncludeWaiver=' + await page.evaluate(() => document.getElementById('zoomIncludeWaiver')?.checked));
await page.click('#generateTop');
await page.waitForTimeout(6000);
const dump = await page.evaluate(() => ({
  readyHidden: document.getElementById('appointmentPackageReady').classList.contains('hidden'),
  title: document.getElementById('appointmentPackageReadyTitle').textContent,
  status: document.getElementById('status').textContent,
  pdfName: document.getElementById('packageReadyPdfName').textContent
}));
console.log('DUMP ' + JSON.stringify(dump));
await browser.close();
