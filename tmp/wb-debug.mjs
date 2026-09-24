import { chromium } from 'playwright';

const BASE = 'https://saleschecklistia.vercel.app/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
context.addInitScript(() => { window.confirm = () => true; });
const page = await context.newPage();

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
await page.click('.mode-card[data-mode="zoom"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('.app.show-zoom', { timeout: 15000 });
await page.waitForFunction(() => { const c = document.getElementById('whiteboardCanvas'); return c && c.width > 0; });
await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const c = document.getElementById('whiteboardCanvas');
  const r = c.getBoundingClientRect();
  return { w: c.width, h: c.height, cw: r.width, ch: r.height, cs: getComputedStyle(c).pointerEvents };
});
console.log('canvas:', JSON.stringify(info));
await page.screenshot({ path: 'tmp/pdfs/prod-smoke/zoom-wb-before.png' });

const wb = await page.locator('#whiteboardCanvas').boundingBox();
console.log('boundingBox:', JSON.stringify(wb));

/* attempt 1: playwright mouse, slower */
await page.mouse.move(wb.x + 40, wb.y + 40);
await page.mouse.down();
await page.mouse.move(wb.x + 160, wb.y + 100, { steps: 10 });
await page.waitForTimeout(50);
await page.mouse.up();
await page.waitForTimeout(300);
console.log('counter after mouse:', await page.locator('#wbPageCounter').textContent());
console.log('pixel changed (mouse):', await page.locator('#whiteboardCanvas').evaluate(c => {
  const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
  const x = c2.getContext('2d'); x.drawImage(c, 0, 0);
  const a = c.getContext('2d').getImageData(100, 100, 1, 1).data.join(',');
  const b = x.getImageData(100, 100, 1, 1).data.join(',');
  return a !== b;
}));
await page.screenshot({ path: 'tmp/pdfs/prod-smoke/zoom-wb-mouse.png' });

/* attempt 2: synthetic pointer events directly on canvas */
const synthetic = await page.evaluate(() => {
  const c = document.getElementById('whiteboardCanvas');
  const r = c.getBoundingClientRect();
  const fire = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 99, clientX: r.left + x, clientY: r.top + y, isPrimary: true, pointerType: 'pen', buttons: type === 'pointerup' ? 0 : 1, button: 0 }));
  c.setPointerCapture = () => {};
  c.releasePointerCapture = () => {};
  fire('pointerdown', 20, 20);
  fire('pointermove', 100, 60);
  fire('pointermove', 180, 100);
  fire('pointerup', 180, 100);
  return 'done';
});
await page.waitForTimeout(300);
console.log('counter after synthetic:', await page.locator('#wbPageCounter').textContent());
console.log('synthetic dispatched:', synthetic);
console.log('pixel changed (synthetic):', await page.locator('#whiteboardCanvas').evaluate(c => {
  const c2 = document.createElement('canvas'); c2.width = c.width; c2.height = c.height;
  const x = c2.getContext('2d'); x.drawImage(c, 0, 0);
  const a = c.getContext('2d').getImageData(100, 100, 1, 1).data.join(',');
  const b = x.getImageData(100, 100, 1, 1).data.join(',');
  return a !== b;
}));
await page.screenshot({ path: 'tmp/pdfs/prod-smoke/zoom-wb-synthetic.png' });

await browser.close();