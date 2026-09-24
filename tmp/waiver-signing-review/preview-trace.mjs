// Trace whether refreshPreview succeeds after signing, by reading the status line,
// switching to the latest canvas, and dumping the signature/box pixel geometry.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.css':'text/css','.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const baseURL = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ viewport:{ width:1440, height:900 } });
const errors = [];
context.on('page', p => p.on('pageerror', e => errors.push('pageerror: ' + e.message)));
context.on('page', p => p.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text()); }));
const page = await context.newPage();
await page.goto(baseURL, { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:10000 });
await page.fill('#clientName', 'John Smith');

async function probe(){
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const paper = document.getElementById('previewPaper');
    const canvases = [...paper.querySelectorAll('canvas')].filter(c => c.width > 100);
    const cv = canvases[0];
    let geometry = null;
    if(cv){
      const ctx = cv.getContext('2d');
      const g = (x, y) => { const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data; return (d[0]+d[1]+d[2])/3; };
      const W = cv.width, H = cv.height;
      const fill = [], dark = [];
      for(let y = 0; y < H; y++) for(let x = Math.floor(W*0.5); x < W; x++){
        const v = g(x, y);
        if(v >= 240 && v < 254) fill.push([x, y]);
        if(v < 120) dark.push([x, y]);
      }
      const span = (pts) => pts.length ? [Math.min(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])), Math.max(...pts.map(p=>p[1]))] : [];
      geometry = {
        fillSpan: span(fill), fillCount: fill.length,
        darkRightSpan: span(dark), darkRightCount: dark.length,
      };
    }
    const statusEl = document.getElementById('statusLine') || document.querySelector('[id*=status]');
    return {
      label: document.getElementById('previewPageLabel').textContent,
      status: statusEl ? statusEl.textContent : null,
      canvases: canvases.map(c => c.width + 'x' + c.height),
      paperText: paper.textContent.slice(0, 70),
      geometry,
    };
  });
}

await page.evaluate(() => document.getElementById('previewTop').click());
const first = await probe();

const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.45);
await page.mouse.down();
await page.mouse.move(box.x + box.width*0.7, box.y + box.height*0.55, { steps:10 });
await page.mouse.up();
await page.fill('#waiverClient1Date', '25/08/2026');
await page.check('#waiverClient2Toggle');
await page.fill('#client2Name', 'Jane Smith');
await page.fill('#waiverClient2Date', '25/08/2026');
const box2 = await page.locator('#signature2').boundingBox();
await page.mouse.move(box2.x + box2.width*0.2, box2.y + box2.height*0.5);
await page.mouse.down();
await page.mouse.move(box2.x + box2.width*0.7, box2.y + box2.height*0.5, { steps:8 });
await page.mouse.up();
const ts = await page.evaluate(() => ({ at1: window._testState.getSignedAt1(), at2: window._testState.getSignedAt2(), fmt1: window._testState.formatSigningTimestamp(window._testState.getSignedAt1()) }));
await page.evaluate(() => document.getElementById('previewTop').click());
const second = await probe();

console.log(JSON.stringify({ first, second, ts, errors }, null, 2));
await browser.close();
server.close();