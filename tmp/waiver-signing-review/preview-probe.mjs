// Dump the waiver page-6 preview canvas as raw RGBA and analyze box/fill/text placement in Node.
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
await page.evaluate(() => {
  const go = () => {
    const btn = document.getElementById('previewNext');
    const total = Number((document.getElementById('previewPageLabel').textContent.match(/of\s+(\d+)/) || [])[1] || 0);
    const cur = Number((document.getElementById('previewPageLabel').textContent.match(/Page\s+(\d+)/) || [])[1] || 0);
    if(cur < total){ btn.click(); setTimeout(go, 80); }
  };
  go();
});
await page.waitForFunction(() => {
  const t = document.getElementById('previewPageLabel').textContent;
  return Number((t.match(/of\s+(\d+)/) || [])[1] || 0) > 0 && Number((t.match(/Page\s+(\d+)/) || [])[1] || 0) >= Number((t.match(/of\s+(\d+)/) || [])[1] || 0);
}, null, { timeout: 15000 });
await page.waitForTimeout(500);

const dump = await page.evaluate(() => {
  const paper = document.getElementById('previewPaper');
  const canvases = [...paper.querySelectorAll('canvas')];
  const info = canvases.map(c => ({ id: c.id, cls: c.className, w: c.width, h: c.height }));
  const canvas = canvases.find(c => c.width === 744) || canvases[0];
  const ctx = canvas.getContext('2d');
  return { info, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
});

function analyze(dump){
  const cs = dump.info;
  const target = dump.info.find(c => c.w === 744 && c.h === 1053) || dump.info[0];
  const Wd = target.w, Hd = target.h;
  if(dump.data.length !== Wd * Hd * 4) throw new Error('size mismatch');
  const at = (x, y) => { const i = (y * Wd + x) * 4; const r = dump.data[i], g = dump.data[i+1], b = dump.data[i+2]; return (r + g + b) / 3; };
  // Scan for the timestamp text color (#29303c ~ 41,48,60 + AA) in the right half.
  const tsPx = [];
  for(let y = 0; y < Hd; y++) for(let x = Math.floor(Wd*0.55); x < Wd; x++){
    const i = (y * Wd + x) * 4;
    if(dump.data[i] >= 30 && dump.data[i] <= 110 && Math.abs(dump.data[i] - dump.data[i+1]) < 25 && Math.abs(dump.data[i] - dump.data[i+2]) < 35) tsPx.push([x, y]);
  }
  const tsRows = [...new Set(tsPx.map(p => p[1]))].sort((a,b)=>a-b);
  const tsCols = [...new Set(tsPx.map(p => p[0]))].sort((a,b)=>a-b);
  return {
    canvases: cs,
    timestampCandidates: tsPx.length,
    tsRowSpan: tsRows.length ? [tsRows[0], tsRows[tsRows.length-1]] : [],
    tsColSpan: tsCols.length ? [tsCols[0], tsCols[tsCols.length-1]] : [],
  };
}
console.log(JSON.stringify({ result: analyze(dump), errors }, null, 2));
await browser.close();
server.close();