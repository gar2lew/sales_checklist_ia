import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const baseURL = `http://127.0.0.1:${server.address().port}/`;
const CLIENT_1 = 'John Smith';
const DATE = '25/08/2026';

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{width:1440,height:900} });
const errors = [];
context.addInitScript(() => { window.confirm = () => true; });
context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
const page = await context.newPage();

await page.goto(baseURL, { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="zoom"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('.app.show-zoom', { timeout:10000 });
await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:10000 });

await page.fill('#date', DATE);
await page.selectOption('#teamMember', { label:'Garry Lewis' });
await page.fill('#clientName', CLIENT_1);
await page.evaluate(() => {
  const el = document.getElementById('contractDueDateTbc');
  el.checked = true;
  el.dispatchEvent(new Event('change', { bubbles:true }));
});
await page.check('#zoomIncludeWaiver');
await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:10000 });

const readinessBefore = await page.evaluate(() => window._testState.structuredReadinessCheck());
console.log('READINESS pre-name:', JSON.stringify({ ready:readinessBefore.ready, ids:readinessBefore.items.map(i=>i.id) }));

await page.fill('#waiverClient1Name', CLIENT_1);
await page.evaluate(() => {
  document.getElementById('waiverClient1Name').dispatchEvent(new Event('change', { bubbles:true }));
});

const readinessAfter = await page.evaluate(() => window._testState.structuredReadinessCheck());
console.log('READINESS post-name:', JSON.stringify({ ready:readinessAfter.ready, ids:readinessAfter.items.map(i=>i.id) }));

const locator = page.locator('#signature');
await locator.scrollIntoViewIfNeeded();
const box = await locator.boundingBox();
console.log('PAD BOX:', JSON.stringify(box));
const hitInfo = await page.evaluate(({x,y}) => {
  const el = document.elementFromPoint(x, y);
  const tlWrap = document.getElementById('progressTimeline');
  const tlWrapRect = tlWrap.getBoundingClientRect();
  const headers = [...document.querySelectorAll('.stickyHeader')].map(h => {
    const r = h.getBoundingClientRect();
    return { cls: h.className, top:r.top, bottom:r.bottom, height:r.height, offsetHeight: h.offsetHeight };
  });
  return {
    hitId: el ? (el.id || el.tagName) : null,
    hitClass: el ? el.getAttribute('class') : null,
    headers,
    progressTimeline: {
      top: tlWrapRect.top, bottom: tlWrapRect.bottom, height: tlWrapRect.height,
      position: getComputedStyle(tlWrap).position,
      clientTop: getComputedStyle(tlWrap).top,
      inlineTop: tlWrap.style.top,
      docOffsetTop: tlWrapRect.top + window.scrollY,
      stickyParentOffsetHeight: tlWrap.parentElement ? tlWrap.parentElement.offsetHeight : null,
    },
    scrollY: window.scrollY,
  };
}, { x: box.x + box.width * 0.2, y: box.y + box.height * 0.5 });
console.log('HIT AT DRAW POINT:', JSON.stringify(hitInfo));
const dateBefore = await page.inputValue('#waiverClient1Date');
console.log('DATE BEFORE DRAW:', JSON.stringify(dateBefore));

await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
await page.mouse.up();

await page.waitForTimeout(1200);
const after = await page.evaluate(() => ({
  dateValue: document.getElementById('waiverClient1Date').value,
  hasInk: (() => {
    const c = document.getElementById('signature');
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for(let i = 3; i < data.length; i += 4){ if(data[i] > 0) ink++; }
    return ink > 0;
  })(),
}));
console.log('AFTER DRAW:', JSON.stringify(after));
console.log('PAGE ERRORS:', JSON.stringify(errors));
await context.close();
await browser.close();
server.close();