import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(20000);
page.addInitScript(() => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.unregister = async () => true;
  // Neutralise SW registration: stub register to no-op
  const orig = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  navigator.serviceWorker.register = async () => ({});
  window.confirm = () => true;
});
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
await page.click('#generateTop');
console.log('clicked');
try {
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 60000 });
  console.log('READY ' + JSON.stringify(await page.evaluate(() => ({
    title: document.getElementById('appointmentPackageReadyTitle').textContent,
    status: document.getElementById('status').textContent,
    pdfName: document.getElementById('packageReadyPdfName').textContent
  }))));
} catch (e) { console.log('FAIL ' + e.message.split('\n')[0]); }
await browser.close();
