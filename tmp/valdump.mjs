import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.on('pageerror', e => console.log('PAGEERR', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
// dump the readiness result from the app's scope by clicking generate
await page.click('#generateTop');
await page.waitForTimeout(400);
const dump = await page.evaluate(() => {
  const ids = Array.from(document.querySelectorAll('.fieldError')).map(e => e.getAttribute('data-field'));
  const messages = Array.from(document.querySelectorAll('.fieldError')).map(e => e.textContent.trim());
  const waiverReady = (() => {
    // reconstruct via DOM only — pull the state flag
    const sigSet = !!document.getElementById('sig1Status') && document.getElementById('sig1Status').textContent.trim();
    return { sig1Status: sigSet };
  })();
  return { ids, messages, status: document.getElementById('status').textContent, sig1Status: waiverReady.sig1Status };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();
