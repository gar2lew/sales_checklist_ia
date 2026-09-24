// Sign first, THEN open preview, navigate to page 6, and read geometry.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

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

async function sign(){ const loc = page.locator('#signature'); await loc.scrollIntoViewIfNeeded(); const box = await loc.boundingBox();
  await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.45);
  await page.mouse.down(); await page.mouse.move(box.x + box.width*0.7, box.y + box.height*0.55, { steps:10 }); await page.mouse.up(); }
await sign();
await page.fill('#waiverClient1Date', '25/08/2026');
await page.check('#waiverClient2Toggle');
await page.fill('#client2Name', 'Jane Smith');
await page.fill('#waiverClient2Date', '25/08/2026');
const loc2 = page.locator('#signature2'); await loc2.scrollIntoViewIfNeeded();
const box2 = await loc2.boundingBox();
await page.mouse.move(box2.x + box2.width*0.2, box2.y + box2.height*0.5);
await page.mouse.down(); await page.mouse.move(box2.x + box2.width*0.7, box2.y + box2.height*0.5, { steps:8 }); await page.mouse.up();

const ts = await page.evaluate(() => ({ at1: window._testState.getSignedAt1(), at2: window._testState.getSignedAt2() }));

await page.evaluate(() => document.getElementById('previewTop').click());
await page.waitForTimeout(700);
await page.evaluate(() => {
  const go = () => {
    const btn = document.getElementById('previewNext');
    const t = document.getElementById('previewPageLabel').textContent;
    const total = Number((t.match(/of\s+(\d+)/) || [])[1] || 0);
    const cur = Number((t.match(/Page\s+(\d+)/) || [])[1] || 0);
    if(cur < total){ btn.click(); setTimeout(go, 80); }
  };
  go();
});
await page.waitForFunction(() => {
  const t = document.getElementById('previewPageLabel').textContent;
  return Number((t.match(/Page\s+(\d+)/) || [])[1] || 0) >= 6 && Number((t.match(/of\s+(\d+)/) || [])[1] || 0) >= 6;
}, null, { timeout: 15000 });
await page.waitForTimeout(500);

const result = await page.evaluate(() => {
  const paper = document.getElementById('previewPaper');
  const cv = [...paper.querySelectorAll('canvas')].find(c => c.width >= 700);
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const key = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return { r: d[0], g: d[1], b: d[2] }; };
  // Boxes: exact #f7f8fa pixels in the right half.
  const fill = [];
  for(let y = 0; y < H; y++) for(let x = 230; x < W; x++) if((key(x, y).r)===247 && key(x, y).g===248 && key(x, y).b===250) fill.push([x, y]);
  const boxRows = [...new Set(fill.map(p => p[1]))].sort((a,b)=>a-b);
  const boxes = [];
  let band = [];
  for(const y of boxRows){ if(band.length && y - band[band.length-1] > 4){ boxes.push(band); band = []; } band.push(y); }
  if(band.length) boxes.push(band);
  const boxStats = boxes.map(rows => {
    const pts = fill.filter(p => rows.includes(p[1]));
    const xs = pts.map(p=>p[0]);
    let dark = 0;
    for(const [x, y] of pts) for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++){
      const d = ctx.getImageData(x+dx, y+dy, 1, 1).data; if((d[0]+d[1]+d[2])/3 < 130) dark++;
    }
    return { y: [rows[0], rows[rows.length-1]], x: [Math.min(...xs), Math.max(...xs)], pixels: pts.length, nearbyDark: dark,
      midFill: key(Math.round((Math.min(...xs)+Math.max(...xs))/2), Math.round((rows[0]+rows[rows.length-1])/2)) };
  });
  // Detect ink colour #111 (41,48,60 excluded; ink is 17,17,17) and template body text tolerance.
  const ink = [];
  for(let y = 0; y < H; y++) for(let x = Math.floor(W*0.5); x < W; x++){ const k = key(x, y); if(k.r <= 25 && k.g <= 25 && k.b <= 25) ink.push([x, y]); }
  const inkSpan = ink.length ? [Math.min(...ink.map(p=>p[0])), Math.max(...ink.map(p=>p[0])), Math.min(...ink.map(p=>p[1])), Math.max(...ink.map(p=>p[1]))] : [];
  return {
    label: document.getElementById('previewPageLabel').textContent,
    canvas: W + 'x' + H,
    status: (document.getElementById('statusLine') || {}).textContent || null,
    boxCount: boxes.length,
    boxStats,
    inkCount: ink.length,
    inkSpan,
  };
});

console.log(JSON.stringify({ ts, preview: result, errors }, null, 2));
const pngBase64 = await page.evaluate(() => {
  const paper = document.getElementById('previewPaper');
  const cv = [...paper.querySelectorAll('canvas')].find(c => c.width >= 700);
  return cv.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
});
writeFileSync(fileURLToPath(new URL('preview-page6.png', import.meta.url)), Buffer.from(pngBase64, 'base64'));
console.log('Saved preview-page6.png');
await browser.close();
server.close();