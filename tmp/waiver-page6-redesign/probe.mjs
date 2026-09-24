/* Precise pixel verification of the redesigned page-6 panel against the
   template geometry. Run: node tmp/waiver-page6-redesign/probe.mjs
*/
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
  if(pathname === '/render-host'){ response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html>'); return; }
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
const baseURL = `http://127.0.0.1:${server.address().port}/`;
const SCALE = 200 / 72;

const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1680, height: 1200 } });
const page = await c.newPage();
await page.goto(baseURL + 'render-host', { waitUntil: 'domcontentloaded' });

const pdfBytes = readFileSync(outDir + 'comboC.pdf');
const u8 = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);

const result = await page.evaluate(async ({ pdfBytes, SCALE }) => {
  const pdfjs = await import('/pdfjs/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
  const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
  const p = await doc.getPage(6);
  const viewport = p.getViewport({ scale: SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  await p.render({ canvasContext: ctx, viewport }).promise;
  const W = viewport.width, H = viewport.height;
  const cx = xpt => Math.round(xpt * (W / 595.32));
  const cy = ypt => Math.round(H - ypt * (H / 842));
  const sample = (xpt, ypt) => {
    const d = ctx.getImageData(cx(xpt), cy(ypt), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const darkIn = (x0, x1, y0, y1, thresh = 128) => {
    let dk = 0, tt = 0;
    for(let yy = Math.min(cy(y0), cy(y1)); yy <= Math.max(cy(y0), cy(y1)); yy++)
      for(let xx = Math.min(cx(x0), cx(x1)); xx <= Math.max(cx(x0), cx(x1)); xx++){
        const d = ctx.getImageData(xx, yy, 1, 1).data;
        tt++;
        if(d[0] < thresh && d[1] < thresh && d[2] < thresh) dk++;
      }
    return tt ? dk / tt : 0;
  };

  const r = {};
  // Panel rows: label present (x54-171 dark), value present, underline dark at full width
  r.c1Header = darkIn(54, 120, 631, 646);
  r.c1NameLabel = darkIn(54, 171, 611, 623);
  r.c1NameValue = darkIn(175, 235, 611, 623);
  r.c1NameUnderlineLeft = darkIn(175, 260, 617.5, 618.5);
  r.c1NameUnderlineRight = darkIn(345, 360, 617.5, 618.5);
  r.c1SigLabel = darkIn(54, 171, 563, 575);
  r.c1SigUnderline = darkIn(175, 360, 569.5, 570.5);
  r.c1DateLabel = darkIn(54, 100, 515, 527);
  r.c1DateValue = darkIn(175, 265, 515, 527);
  r.c1DateUnderline = darkIn(175, 360, 521.5, 522.5);
  r.c2Header = darkIn(54, 120, 459, 474);
  r.c2NameLabel = darkIn(54, 171, 437, 449);
  r.c2NameValue = darkIn(175, 235, 437, 449);
  r.c2NameUnderline = darkIn(175, 360, 443.5, 444.5);
  r.c2SigLabel = darkIn(54, 171, 389, 401);
  r.c2SigUnderline = darkIn(175, 360, 395.5, 396.5);
  r.c2DateLabel = darkIn(54, 100, 341, 353);
  r.c2DateValue = darkIn(175, 265, 341, 353);
  r.c2DateUnderline = darkIn(175, 360, 347.5, 348.5);
  // divider: grey line present spanning the panel width
  r.divider = darkIn(54, 506, 481.5, 482.5, 190);
  r.dividerLeft = darkIn(54, 200, 481.5, 482.5, 190);
  r.dividerRight = darkIn(400, 506, 481.5, 482.5, 190);
  // old printed guides fully washed out (no ink at their former labels/lines)
  r.oldNameRowGone = darkIn(54, 360, 596, 606);
  r.oldSigRowGone = darkIn(54, 360, 534, 544);
  r.oldDateRowGone = darkIn(54, 505, 470, 482);
  // signature ink placement: above line only, never below
  r.inkC1Above = darkIn(179, 293, 572, 601);
  r.inkC1Below = darkIn(170, 360, 538, 568.5);
  r.inkC2Above = darkIn(179, 293, 398, 427);
  r.inkC2Below = darkIn(170, 360, 364, 394.5);
  // whitespace discipline
  r.zoneBetweenC1DateAndDivider = darkIn(54, 360, 490, 518);
  r.zoneBelowDividerToC2Header = darkIn(54, 505, 470, 478);
  r.footerClear = darkIn(40, 540, 40, 120);
  // timestamp boxes (text rows inside each)
  r.boxC1 = darkIn(382, 504, 588, 606);
  r.boxC2 = darkIn(382, 504, 414, 432);
  const dividerPixel = sample(300, 482);
  const inkPixel = sample(300, 396);
  return { r, dividerPixel, inkPixel };
}, { pdfBytes: u8, SCALE });

console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();