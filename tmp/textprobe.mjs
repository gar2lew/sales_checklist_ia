import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil:'domcontentloaded' });
const res = await page.evaluate(async () => {
  const results = {};
  try {
    const c = document.createElement('canvas'); c.width = 100; c.height = 50;
    const ctx = c.getContext('2d');
    const t0 = performance.now();
    ctx.font = '700 10.5px Arial';
    const w = ctx.measureText('Fictional Test Client').width;
    results.measure = { ms: Math.round(performance.now() - t0), w };
    const t1 = performance.now();
    ctx.fillText('Fictional Test Client', 5, 20);
    results.fill = { ms: Math.round(performance.now() - t1) };
    results.fontsCount = document.fonts ? document.fonts.size : -1;
  } catch (e) { results.err = e.message; }
  return results;
}, );
// The above runs in page; evaluate will hang if the ops block the thread.
console.log('RES ' + JSON.stringify(res));
await browser.close();
