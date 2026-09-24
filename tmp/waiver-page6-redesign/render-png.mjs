/* Render page 6 of each generated PDF at 200 DPI and probe the signing panel
   pixels (ink above line / nothing below, divider, timestamp boxes).
   Run: node tmp/waiver-page6-redesign/render-png.mjs (after generate.mjs)
*/
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const outDir = here + '/';
const pdfjsDir = resolve(root, 'node_modules/pdfjs-dist');
const mime = { '.mjs':'text/javascript', '.json':'application/json', '.png':'image/png', '.wasm':'application/wasm', '.map':'application/json' };

const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if(pathname === '/render-host'){ response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html><body></body></html>'); return; }
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

const combos = ['comboA', 'comboB', 'comboC', 'comboD'];
const SCALE = 200 / 72;

const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1680, height: 1200 } });
const page = await c.newPage();
await page.goto(baseURL + 'render-host', { waitUntil: 'domcontentloaded' });

const results = {};
for(const name of combos){
  const pdfBytes = readFileSync(outDir + name + '.pdf');
  const u8 = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  const out = await page.evaluate(async ({ pdfBytes, SCALE }) => {
    const pdfjs = await import('/pdfjs/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
    const doc = await pdfjs.getDocument({ data: pdfBytes }).promise;
    const p = await doc.getPage(6);
    const viewport = p.getViewport({ scale: SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await p.render({ canvasContext: ctx, viewport }).promise;

    const W = viewport.width, H = viewport.height;
    // BL (pt) -> canvas pixel
    const cx = xpt => Math.round(xpt * (W / 595.32));
    const cy = ypt => Math.round(H - ypt * (H / 842));
    const darkFraction = (x0, x1, y0, y1, step = 2, thresh = 128) => {
      let darker = 0, total = 0;
      for(let yy = Math.min(cy(y0), cy(y1)); yy <= Math.max(cy(y0), cy(y1)); yy += step)
        for(let xx = Math.min(cx(x0), cx(x1)); xx <= Math.max(cx(x0), cx(x1)); xx += step){
          const d = ctx.getImageData(xx, yy, 1, 1).data;
          total++;
          if(d[0] < thresh && d[1] < thresh && d[2] < thresh) darker++;
        }
      return total ? darker / total : 0;
    };

    const items = await p.getTextContent();
    const rows = {};
    for(const it of items.items){
      if(typeof it.str !== 'string' || !it.str.trim()) continue;
      const bl = Math.round(it.transform[5] * 10) / 10;
      (rows[bl] = rows[bl] || []).push({ str: it.str, x: Math.round(it.transform[4] * 10) / 10 });
    }
    for(const k of Object.keys(rows)) rows[k].sort((a, b) => a.x - b.x);
    const fieldDate = (rows['524'] || [])
      .filter(it => it.x >= 170 && it.x < 400)
      .map(it => it.str).join('');

    const probes = {
      c1InkAboveLine: darkFraction(179, 293, 572, 601),
      c1InkBelowLine: darkFraction(176, 358, 538, 568.5),
      c2InkAboveLine: darkFraction(179, 293, 398, 427),
      c2InkBelowLine: darkFraction(176, 358, 364, 394.5),
      c1Line: darkFraction(176, 360, 569, 571),
      c2Line: darkFraction(176, 360, 395, 397),
      nameLineC1: darkFraction(176, 360, 617, 619),
      dateLineC1: darkFraction(176, 360, 521, 523),
      divider: darkFraction(54, 506, 481, 483),
      c1BoxText: darkFraction(382, 504, 588, 606),
      c2BoxText: darkFraction(382, 504, 414, 432),
      zoneBetweenDateAndDivider: darkFraction(54, 360, 490, 520),
      headerC1Row: darkFraction(54, 150, 630, 645),
    };

    // coarse ASCII map of the BL 280..700 zone for numerical review
    const ascii = [];
    const blMin = 280, blMax = 700, blStep = 8;
    const xMin = 40, xMax = 515, xStep = 19;
    for(let bl = blMax; bl >= blMin; bl -= blStep){
      let line = String(bl).padStart(3) + '|';
      for(let x = xMin; x <= xMax; x += xStep){
        const d = ctx.getImageData(cx(x), cy(bl), 1, 1).data;
        const avg = (d[0] + d[1] + d[2]) / 3;
        line += avg > 252 ? ' ' : avg >= 200 ? '-' : avg < 128 ? '#' : '+';
      }
      ascii.push(line);
    }

    return { pages: doc.numPages, rows, fieldDate, probes, ascii, png: canvas.toDataURL('image/png') };
  }, { pdfBytes: u8, SCALE });
  writeFileSync(outDir + name + '-page6.png', Buffer.from(out.png.split(',')[1], 'base64'));
  delete out.png;
  results[name] = out;
  console.log(name + ' pages=' + out.pages + ' fieldDate=' + out.fieldDate + ' probes=' + JSON.stringify(out.probes));
  console.log(out.ascii.join('\n'));
}

await browser.close();
server.close();
writeFileSync(outDir + 'render.json', JSON.stringify(results, null, 2));
console.log('PNGs + render.json written');