import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
const dump = await page.evaluate(() => ({
  waiverClient1Date: document.getElementById('waiverClient1Date')?.value,
  date: document.getElementById('date')?.value,
  waiverClient1Name: document.getElementById('waiverClient1Name')?.value
}));
console.log(JSON.stringify(dump));
await browser.close();
