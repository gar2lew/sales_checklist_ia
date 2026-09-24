import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(15000);
page.addInitScript(() => { window.confirm = () => true; });
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
console.log('STEP goto');
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
console.log('STEP started');
await page.fill('#clientName', 'Fictional Test Client');
console.log('STEP filled');
const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + 40, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 40, box.y + box.height/2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);
console.log('STEP signed, sig1Date=' + await page.inputValue('#waiverClient1Date'));
console.log('STEP before generate click');
page.on('console', m => console.log('C', m.type(), m.text().slice(0,120)));
await page.click('#generateTop');
console.log('STEP clicked generate');
try {
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 60000 });
  console.log('STEP ready panel shown');
  console.log('DUMP ' + JSON.stringify(await page.evaluate(() => ({
    title: document.getElementById('appointmentPackageReadyTitle').textContent,
    status: document.getElementById('status').textContent,
    pdfName: document.getElementById('packageReadyPdfName').textContent
  }))));
} catch (e) {
  console.log('STEP ready failure: ' + e.message);
}
await browser.close();
