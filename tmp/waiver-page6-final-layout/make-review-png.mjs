import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
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
const baseURL = 'http://127.0.0.1:' + server.address().port + '/';

const SCALE = 300 / 72;
const files = [
  { file: 'sigA.pdf', label: 'sigA  short+wide (Amos Winks)' },
  { file: 'sigB.pdf', label: 'sigB  tall+narrow (Bea Quinn)' },
  { file: 'sigC.pdf', label: 'sigC  long+wide (Casey Ford)' },
  { file: 'finalC-before.pdf', label: 'finalC BEFORE (old caps 160 / gap 6 / line 360)' },
  { file: 'finalC.pdf', label: 'finalC AFTER (caps 135 / gap 8 / line 350)' },
];
const inputs = [];
for(const f of files){
  const buf = readFileSync(outDir + f.file);
  inputs.push({ ...f, data: Array.from(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)) });
}

const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 2200, height: 800 } });
const page = await c.newPage();
await page.goto(baseURL + 'host', { waitUntil: 'domcontentloaded' });

const out = await page.evaluate(async ({ inputs, SCALE }) => {
  const pdfjs = await import('/pdfjs/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';

  const CROP_X0 = 130, CROP_X1 = 520, CROP_Y0 = 315, CROP_Y1 = 662; // BL pt
  async function cropPage6(data){
    const doc = await pdfjs.getDocument({ data }).promise;
    const p = await doc.getPage(6);
    const vp = p.getViewport({ scale: SCALE });
    const W = Math.round(vp.width), H = Math.round(vp.height);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    await p.render({ canvasContext: ctx, viewport: vp }).promise;
    const f = W / 595.32, r = H / 842;
    const sx = Math.round(CROP_X0 * f), sw = Math.round((CROP_X1 - CROP_X0) * f);
    const sy = Math.round(H - CROP_Y1 * r), sh = Math.round((CROP_Y1 - CROP_Y0) * r);
    return ctx.getImageData(sx, sy, sw, sh);
  }

  const TILE_W = 640;
  const tiles = [];
  for(const inp of inputs){
    const img = await cropPage6(new Uint8Array(inp.data));
    const tile = document.createElement('canvas');
    tile.width = TILE_W;
    tile.height = Math.round(TILE_W * img.height / img.width);
    const t = tile.getContext('2d');
    t.drawImage(await createImageBitmap(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height)), 0, 0, TILE_W, tile.height);
    const lh = 40;
    t.fillStyle = '#1c1c1c';
    t.fillRect(0, 0, TILE_W, lh);
    t.font = '22px sans-serif';
    t.fillStyle = '#fff';
    t.fillText(inp.label, 10, 27);
    tiles.push(tile);
  }

  const gap = 12, HDR = 70;
  const gw = tiles.length * TILE_W + (tiles.length + 1) * gap;
  const gh = HDR + Math.max(...tiles.map(t => t.height)) + gap;
  const mont = document.createElement('canvas');
  mont.width = gw; mont.height = gh;
  const g = mont.getContext('2d');
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, gw, gh);
  g.fillStyle = '#111';
  g.font = 'bold 30px sans-serif';
  g.fillText('Waiver page 6 — final signature review (Client blocks, 300 DPI)', 20, 45);
  let x = gap;
  for(const t of tiles){
    g.drawImage(t, x, HDR);
    x += TILE_W + gap;
  }
  return mont.toDataURL('image/png');
}, { inputs, SCALE });

writeFileSync(outDir + 'waiver-page6-final-signature-review.png', Buffer.from(out.split(',')[1], 'base64'));
await browser.close();
server.close();
console.log('wrote tmp/waiver-page6-final-layout/waiver-page6-final-signature-review.png  (' + Math.round(Buffer.byteLength(out) * 0.75 / 1024) + ' KB)');