import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => console.log('console:', m.type(), m.text()));
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://127.0.0.1:8766/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => { console.log('goto error:', e.message); });
const result = await page.evaluate(async () => {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ok: true, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ ok: false });
    img.src = 'templates/ASG-Disclosure-Waiver-2026.pdf';
  });
});
console.log('RESULT ' + JSON.stringify(result));
await browser.close();
