/* Generate signature-review PDFs with deliberately different signature shapes.
   A - short/wide, B - tall/narrow, C - long/wide, finalC - realistic C1 vs C2.
   Run: node tmp/waiver-page6-final-layout/generate-signatures.mjs
*/
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = here + '/';
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const baseURL = `http://127.0.0.1:${server.address().port}/`;

const smooth = t => t * t * (3 - 2 * t);

function shapePath(shape, n){
  const points = [];
  const t0 = shape.t0, t1 = shape.t1;
  const span = t1 - t0;
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const x = t0 + span * t;
    let y = shape.base;
    if(shape.mode === 'wave'){
      y = shape.base
        + shape.amp * Math.sin(t * shape.freq * Math.PI + shape.phase)
        + shape.sub * Math.sin(t * shape.freq * 3.1 + shape.phase * 0.7);
    }else if(shape.mode === 'loops'){
      y = shape.base
        + shape.amp * Math.sin(t * shape.freq * Math.PI + shape.phase)
        * (shape.wob ? 1 + shape.wob * Math.sin(t * Math.PI * 2.3) : 1)
        + shape.sub * Math.sin(t * shape.freq * 5.3 + 1.1);
    }
    points.push([x, y]);
  }
  // leading flourish + trailing swash
  if(shape.head){ points.unshift([t0 - 0.05, shape.base - shape.head]); points.unshift([t0 - 0.02, shape.base + 0.05]); }
  if(shape.tail){ points.push([t1 + 0.05, shape.base + shape.tail]); points.push([t1 + 0.03, shape.base - 0.04]); }
  return points;
}

const SHAPES = {
  A: { mode: 'wave', t0: 0.06, t1: 0.92, base: 0.56, amp: 0.045, freq: 9, sub: 0.025, phase: 0.6, head: 0.10, tail: 0.02 },
  B: { mode: 'loops', t0: 0.14, t1: 0.66, base: 0.55, amp: 0.20, freq: 3.5, sub: 0.03, phase: 0.4, wob: 0.35, head: 0.18 },
  C: { mode: 'wave', t0: 0.05, t1: 0.97, base: 0.55, amp: 0.085, freq: 13, sub: 0.02, phase: 1.2, tail: 0.08 },
  realC1: { mode: 'loops', t0: 0.10, t1: 0.88, base: 0.50, amp: 0.10, freq: 5, sub: 0.035, phase: 0.9, head: 0.16, tail: 0.02 },
  realC2: { mode: 'wave', t0: 0.12, t1: 0.90, base: 0.52, amp: 0.11, freq: 7, sub: 0.03, phase: 2.0, wob: 0.25, head: 0.10 },
};

const browser = await chromium.launch({ headless: true });

async function signPad(page, selector, shapeName){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if(!box) throw new Error(selector + ' not visible');
  const cx = x => box.x + box.width * x;
  const cy = y => box.y + box.height * y;
  const path = shapePath(SHAPES[shapeName], 56);
  await page.mouse.move(cx(0.5), cy(0.5));
  await page.mouse.down();
  for(const [fx, fy] of path) await page.mouse.move(cx(fx), cy(fy), { steps: 1 });
  await page.mouse.up();
}

async function enterWaiverOnly(page){
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-waiver', { timeout: 10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout: 10000 });
}

async function buildWaiver(page, { client2, timestampOn, name1, name2, sig1, sig2 }){
  await page.fill('#clientName', name1);
  await page.evaluate((on) => {
    const el = document.getElementById('includeSignatureTimestamp');
    el.checked = on;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, timestampOn);
  await page.waitForSelector('#waiverSignatureSection', { state: 'visible', timeout: 15000 });
  await signPad(page, '#signature', sig1);
  await page.fill('#waiverClient1Date', '11/09/2026');
  if(client2){
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', name2);
    await signPad(page, '#signature2', sig2);
    await page.fill('#waiverClient2Date', '11/09/2026');
  }
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
  const src = await page.evaluate(() => {
    function inkBounds(id){
      const c = document.getElementById(id);
      if(!c) return null;
      const ctx = c.getContext('2d');
      const w = c.width, h = c.height;
      const d = ctx.getImageData(0, 0, w, h).data;
      let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
      for(let y = 0; y < h; y++)
        for(let x = 0; x < w; x++)
          if(d[(y * w + x) * 4 + 3] > 10){
            if(x < minX) minX = x;
            if(x > maxX) maxX = x;
            if(y < minY) minY = y;
            if(y > maxY) maxY = y;
          }
      if(!isFinite(minX) || maxX <= minX) return null;
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    return { sig1: inkBounds('signature'), sig2: inkBounds('signature2') };
  });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 1 && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100));
  const stream = await downloads[0].createReadStream();
  const chunks = [];
  await new Promise((res, rej) => stream.on('data', c => chunks.push(c)).on('end', res).on('error', rej));
  return { pdf: Buffer.concat(chunks), src };
}

const combos = [
  { name: 'sigA', file: 'review-sigA-shortwide.pdf', client2: false, timestampOn: true,
    name1: 'Amos Winks', sig1: 'A' },
  { name: 'sigB', file: 'review-sigB-tallnarrow.pdf', client2: false, timestampOn: true,
    name1: 'Bea Quinn', sig1: 'B' },
  { name: 'sigC', file: 'review-sigC-longwide.pdf', client2: false, timestampOn: true,
    name1: 'Casey Ford', sig1: 'C' },
  { name: 'finalC', file: 'waiver-c1c2-timestamp.pdf', client2: true, timestampOn: true,
    name1: 'John Smith', name2: 'Jenny Smith', sig1: 'realC1', sig2: 'realC2' },
];

const summary = {};
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const errors = [];
context.addInitScript(() => { window.confirm = () => true; });
context.on('page', p => p.on('pageerror', e => errors.push(e.message)));

for(const combo of combos){
  const page = await context.newPage();
  await enterWaiverOnly(page);
  const { pdf, src } = await buildWaiver(page, combo);
  writeFileSync(outDir + combo.file, pdf);
  writeFileSync(outDir + combo.name + '.pdf', pdf);
  summary[combo.name] = { src: JSON.parse(JSON.stringify(src)), pdfBytes: pdf.length, errors: errors.length };
  await page.close();
}
summary.rb = { errors };
writeFileSync(outDir + 'sig-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
server.close();