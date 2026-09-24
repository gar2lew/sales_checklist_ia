// Preview diff: capture page-6 preview canvas before and after signing/C2,
// then report exactly where dark/box pixels appear after signing.
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

const toPage6 = () => page.evaluate(() => {
  const go = () => {
    const btn = document.getElementById('previewNext');
    const t = document.getElementById('previewPageLabel').textContent;
    const total = Number((t.match(/of\s+(\d+)/) || [])[1] || 0);
    const cur = Number((t.match(/Page\s+(\d+)/) || [])[1] || 0);
    if(cur < total){ btn.click(); setTimeout(go, 80); }
  };
  go();
});
const snap = async () => {
  await toPage6();
  await page.waitForFunction(() => {
    const t = document.getElementById('previewPageLabel').textContent;
    return Number((t.match(/of\s+(\d+)/) || [])[1] || 1) >= 6 && Number((t.match(/Page\s+(\d+)/) || [])[1] || 0) >= 6;
  }, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  const debug = await page.evaluate(() => {
    const paper = document.getElementById('previewPaper');
    return {
      label: document.getElementById('previewPageLabel').textContent,
      canvasCount: paper.querySelectorAll('canvas').length,
      textStart: paper.textContent.slice(0, 60),
    };
  });
  const snapData = await page.evaluate(() => {
    const paper = document.getElementById('previewPaper');
    const canvas = [...paper.querySelectorAll('canvas')].find(c => c.width === 744) || paper.querySelector('canvas:not(#previewOverlay)');
    const ctx = canvas.getContext('2d');
    return { w: canvas.width, h: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  return { ...snapData, debug };
};

await page.evaluate(() => document.getElementById('previewTop').click());
await page.waitForTimeout(800);
const before = await snap();

// Sign everything + client 2, refresh preview, re-snap.
const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.45);
await page.mouse.down();
await page.mouse.move(box.x + box.width*0.7, box.y + box.height*0.55, { steps:10 });
await page.mouse.up();
await page.check('#waiverClient2Toggle');
await page.fill('#client2Name', 'Jane Smith');
await page.fill('#waiverClient1Date', '25/08/2026');
await page.fill('#waiverClient2Date', '25/08/2026');
const box2 = await page.locator('#signature2').boundingBox();
await page.mouse.move(box2.x + box2.width*0.2, box2.y + box2.height*0.5);
await page.mouse.down();
await page.mouse.move(box2.x + box2.width*0.7, box2.y + box2.height*0.5, { steps:8 });
await page.mouse.up();
await page.evaluate(() => document.getElementById('previewTop').click());
await page.waitForTimeout(800);
const after = await snap();

const Wd = before.w, Hd = before.h;
const grey = (d, x, y) => { const i = (y * Wd + x) * 4; return (d[i] + d[i+1] + d[i+2]) / 3; };
// Per-row difference counts in the right half (x > 55%).
const diffRows = [];
for(let y = 0; y < Hd; y++){
  let cnt = 0;
  for(let x = Math.floor(Wd*0.55); x < Wd; x++){
    if(Math.abs(grey(before.data, x, y) - grey(after.data, x, y)) > 10) cnt++;
  }
  diffRows.push([y, cnt]);
}
const bands = [];
let s = -1;
for(let y = 0; y < Hd; y++){
  if(diffRows[y][1] > 3 && s < 0) s = y;
  else if(diffRows[y][1] <= 3 && s >= 0){ bands.push([s, y-1, Math.max(...diffRows.slice(s, y).map(r => r[1]))]); s = -1; }
}
if(s >= 0) bands.push([s, Hd-1, Math.max(...diffRows.slice(s).map(r => r[1]))]);
const fullDiff = diffRows.reduce((a, r) => a + r[1], 0);

// Count exact fill/text colors before vs after.
const count = (d, fn) => { let n = 0; for(let i = 0; i < d.length; i += 4) if(fn(d[i], d[i+1], d[i+2])) n++; return n; };
const hex = (d) => ({ f7f8fa: count(d, (r,g,b) => r===247 && g===248 && b===250), tsText: count(d, (r,g,b) => r===41 && g===48 && b===60) });
console.log(JSON.stringify({
  size: [Wd, Hd],
  beforeDebug: before.debug,
  afterDebug: after.debug,
  rightHalfDiffBands: bands,
  totalDiffRightHalfPx: fullDiff,
  beforeColors: hex(before.data),
  afterColors: hex(after.data),
  errors
}, null, 2));
await browser.close();
server.close();