import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(20000);
page.addInitScript(() => { window.confirm = () => true; });
page.on('pageerror', e => console.log('PAGEERR', e.message));
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
console.log('ink=' + await page.evaluate(() => {
  const c = document.getElementById('signature');
  const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let ink=0; for(let i=3;i<d.length;i+=4) if(d[i]>0) ink++;
  return ink;
}));
await page.click('#generateTop');
console.log('clicked generate');
try {
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 90000 });
  console.log('ready panel shown');
  console.log('DUMP ' + JSON.stringify(await page.evaluate(() => ({
    title: document.getElementById('appointmentPackageReadyTitle').textContent,
    status: document.getElementById('status').textContent,
    pdfName: document.getElementById('packageReadyPdfName').textContent
  }))));
} catch (e) { console.log('ready failure: ' + e.message); }
await browser.close();
