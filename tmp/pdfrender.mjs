import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1190, height: 1684 });
// Wait for the PDF plugin canvas to appear
await page.goto('http://127.0.0.1:8766/templates/ASG-Disclosure-Waiver-2026.pdf#page=6', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(1200);
// Any canvas owned by the PDF viewer (shadow/plugin) - screenshot the embed/plugin bounds
const info = await page.evaluate(() => {
  const embeds = Array.from(document.querySelectorAll('embed'));
  return embeds.map(e => ({ tag: e.tagName, rect: e.getBoundingClientRect().toJSON() }));
});
console.log('EMBEDS ' + JSON.stringify(info));
// Try screenshot of the body; then we inspect results offline.
await page.screenshot({ path: 'tmp/waiver-p6-full.png' });
const met = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
console.log('VIEWPORT ' + JSON.stringify(met));
await browser.close();
