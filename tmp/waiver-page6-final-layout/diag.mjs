import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = here + '/';
const pdfjsDir = resolve(root, 'node_modules/pdfjs-dist');
const mime = { '.mjs':'text/javascript', '.wasm':'application/wasm', '.map':'application/json' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if(pathname === '/host'){ response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html>'); return; }
  if(pathname.startsWith('/pdfjs/')){
    const rel = decodeURIComponent(pathname.slice('/pdfjs/'.length));
    const file = resolve(pdfjsDir, normalize(rel));
    if(!file.startsWith(pdfjsDir)) return response.writeHead(403).end();
    try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
    catch { response.writeHead(404).end(); }
    return;
  }
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

const SCALE = 300 / 72;
const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1760, height: 1300 } });
const page = await c.newPage();
await page.goto('http://127.0.0.1:' + server.address().port + '/host', { waitUntil: 'domcontentloaded' });

for(const file of ['finalC.pdf', 'finalC-before.pdf', 'sigB.pdf']){
  const buf = readFileSync(outDir + file);
  const u8 = Array.from(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength));
  const r = await page.evaluate(async ({ u8, SCALE }) => {
    const pdfjs = await import('/pdfjs/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
    const doc = await pdfjs.getDocument({ data: new Uint8Array(u8) }).promise;
    const p = await doc.getPage(6);
    const vp = p.getViewport({ scale: SCALE });
    const cv = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    const W = vp.width, H = vp.height;
    const min = (xpt, ypt) => {
      const d = ctx.getImageData(Math.round(xpt * W / 595.32), Math.round(H - ypt * H / 842), 1, 1).data;
      return Math.min(d[0], d[1], d[2]);
    };
    // ASCII map of the C1 signature-row region
    const map = [];
    for(let bl = 612; bl >= 540; bl -= 3){
      let line = String(bl).padStart(3) + '|';
      for(let x = 120; x <= 370; x += 7){
        const m = min(x, bl);
        line += m > 252 ? ' ' : m >= 190 ? '.' : m >= 128 ? '+' : '#';
      }
      map.push(line);
    }
    return { map, samples: { x200y558: min(200, 558), x200y566: min(200, 566), x360y558: min(360, 558), x352y558: min(352, 558), x200y580: min(200, 580) } };
  }, { u8, SCALE });
  console.log('\n==== ' + file + ' ====');
  console.log(JSON.stringify(r.samples));
  console.log(r.map.join('\n'));
}
await browser.close();
server.close();