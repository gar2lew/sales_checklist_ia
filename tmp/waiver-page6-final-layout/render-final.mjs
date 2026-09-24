/* Render + probe page 6 at 300 DPI vs every acceptance criterion.
   Run: node tmp/waiver-page6-final-layout/render-final.mjs
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

const combos = ['finalA', 'finalB', 'finalC', 'finalD'];
const SCALE = 300 / 72;

const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1760, height: 1300 } });
const page = await c.newPage();
await page.goto(baseURL + 'render-host', { waitUntil: 'domcontentloaded' });

const results = {};
for(const name of combos){
  const pdfBytes = readFileSync(outDir + name + '.pdf');
  const u8 = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  const out = await page.evaluate(async ({ pdfBytes, SCALE, name }) => {
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
    const cxr = xpt => Math.round(xpt * (W / 595.32));
    const cyr = ypt => Math.round(H - ypt * (H / 842));
    const dark = (xpt, ypt, thresh) => {
      const d = ctx.getImageData(cxr(xpt), cyr(ypt), 1, 1).data;
      return Math.min(d[0], d[1], d[2]);
    };
    const darkFrac = (x0, x1, yA, yB, thresh = 128) => {
      let dk = 0, tt = 0;
      const xl = Math.min(cxr(x0), cxr(x1)), xr2 = Math.max(cxr(x0), cxr(x1));
      const yt = Math.min(cyr(yA), cyr(yB)), yb = Math.max(cyr(yA), cyr(yB));
      for(let yy = yt; yy <= yb; yy += 2)
        for(let xx = xl; xx <= xr2; xx += 2){
          const d = ctx.getImageData(xx, yy, 1, 1).data;
          tt++;
          if(d[0] < thresh && d[1] < thresh && d[2] < thresh) dk++;
        }
      return tt ? dk / tt : 0;
    };
    const rightmostDarkX = (x0, x1, yTop, yBot) => {
      let mx = null;
      const yt = Math.min(cyr(yTop), cyr(yBot)), yb = Math.max(cyr(yTop), cyr(yBot));
      for(let xx = cxr(x0); xx <= cxr(x1); xx++){
        let hit = false;
        for(let yy = yt; yy <= yb; yy++){
          const d = ctx.getImageData(xx, yy, 1, 1).data;
          if(d[0] < 128 && d[1] < 128 && d[2] < 128){ hit = true; break; }
        }
        if(hit) mx = xx;
      }
      return mx === null ? null : Math.round((mx * 595.32) / W * 10) / 10;
    };
    const inkExtentY = (x0, x1, yTop, yBot) => {
      let top = null, bot = null;
      const yt = Math.min(cyr(yTop), cyr(yBot)), yb = Math.max(cyr(yTop), cyr(yBot));
      for(let xx = cxr(x0); xx <= cxr(x1); xx += 2)
        for(let yy = yt; yy <= yb; yy++){
          const d = ctx.getImageData(xx, yy, 1, 1).data;
          if(d[0] < 128 && d[1] < 128 && d[2] < 128){
            const bl = (H - yy) / (H / 842);
            if(top === null || bl > top) top = bl;
            if(bot === null || bl < bot) bot = bl;
          }
        }
      return top === null ? null : { top: Math.round(top), bot: Math.round(bot) };
    };

    const items = await p.getTextContent();
    const rows = {};
    for(const it of items.items){
      if(typeof it.str !== 'string' || !it.str.trim()) continue;
      const bl = Math.round(it.transform[5] * 10) / 10;
      (rows[bl] = rows[bl] || []).push({ str: it.str, x: Math.round(it.transform[4] * 10) / 10 });
    }
    for(const k of Object.keys(rows)) rows[k].sort((a, b) => a.x - b.x);
    const norm = s => s.normalize('NFKD').replace(/[\s\u0300-\u036f]/g, '').toLowerCase();
    const normDigits = s => s.normalize('NFKD').toLowerCase().replace(/[^0-9a-z]/g, '');
    const rowText = bl => (rows[bl] || []).map(i => i.str).join(' ');

    const probes = {
      pages: doc.numPages,
      dateC1: normDigits(rowText(510)).includes('date11092026'),
      dateC2: normDigits(rowText(325)).includes('date11092026'),
      c1NameRight: rightmostDarkX(150, 360, 616, 612),
      c2NameRight: rightmostDarkX(150, 360, 431, 427),
      c1Gap: darkFrac(154, 320, 558.8, 563.4),
      c1Ink: darkFrac(154, 320, 564, 600),
      c1Below: darkFrac(154, 320, 524, 556),
      c2Gap: darkFrac(154, 320, 373.8, 378.4),
      c2Ink: darkFrac(154, 320, 379, 415),
      c2Below: darkFrac(154, 320, 339, 371),
      residualZone: {
        headerToNameValue: darkFrac(40, 555, 618, 626),    // clean between name value top and header
        betweenDateAndSig: darkFrac(40, 555, 512, 525),    // daylight between date value and sig label
        aboveSigToLine: darkFrac(40, 555, 528, 552),
        oldSigRow: darkFrac(40, 555, 536, 540),
        oldDateRowZone: darkFrac(40, 555, 466, 473),
        belowC2Date: darkFrac(28, 568, 60, 320),
        panelTopMargin: darkFrac(28, 568, 660, 663),
      },
      dividerLine: darkFrac(54, 505, 474, 476, 190),
      dividerZoneClean: darkFrac(54, 505, 470, 473, 128) === 0 && darkFrac(54, 505, 477, 480, 128) === 0,
      clauseLastLine: darkFrac(82, 440, 668, 678, 200),
      clauseRows: rowText(665.6).includes('communications.') && rowText(704).includes('18'),
      footerText: rowText(24).includes('ASG') && rowText(24).includes('6'),
      footerPixels: darkFrac(40, 360, 16, 32, 200),
      signatureTextSearchable: rows[560] && rows[560].some(i => i.str.trim() === 'Signature'),
      c1BoxText: rowText(582.9).includes('Digitally signed') && rowText(571.4).includes('11/09/2026') && rowText(559.9).includes('AWST'),
      c2BoxText: rowText(397.9).includes('Digitally signed') && rowText(386.4).includes('11/09/2026') && rowText(374.9).includes('AWST'),
      c1BoxFillLight: darkFrac(390, 500, 545, 593, 250),
      c2BoxFillLight: darkFrac(390, 500, 365, 413, 250),
      c1NameExtent: inkExtentY(150, 240, 618, 588),
      c2NameExtent: inkExtentY(150, 240, 433, 403),
    };

    const ascii = [];
    for(let bl = 680; bl >= 290; bl -= 6){
      const cells = [];
      for(let x = 40; x <= 555; x += 13){
        const m = dark(x, bl, 256);
        cells.push(m > 252 ? ' ' : m >= 190 ? '-' : m >= 128 ? '+' : '#');
      }
      ascii.push(String(bl).padStart(3) + '|' + cells.join(''));
    }
    const diag = {};
    if(name === 'finalC'){
      diag.valueZone = [];
      for(let bl = 620; bl >= 596; bl -= 2){
        const cells = [];
        for(let x = 48; x <= 360; x += 8){
          const m = dark(x, bl, 256);
          cells.push(m > 252 ? ' ' : m >= 190 ? '.' : m >= 128 ? '+' : '#');
        }
        diag.valueZone.push(String(bl).padStart(3) + '|' + cells.join(''));
      }
      diag.dividerZone = [];
      for(let bl = 482; bl >= 468; bl -= 1){
        const cells = [];
        for(let x = 48; x <= 512; x += 16){
          const m = dark(x, bl, 256);
          cells.push(m > 252 ? ' ' : m >= 190 ? '-' : m >= 128 ? '+' : '#');
        }
        diag.dividerZone.push(String(bl).padStart(3) + '|' + cells.join(''));
      }
      diag.clauseEdgeZone = [];
      for(let bl = 668; bl >= 658; bl -= 1){
        const cells = [];
        for(let x = 96; x <= 512; x += 16){
          const m = dark(x, bl, 256);
          cells.push(m > 252 ? ' ' : m >= 190 ? '-' : m >= 128 ? '+' : '#');
        }
        diag.clauseEdgeZone.push(String(bl).padStart(3) + '|' + cells.join(''));
      }
    }

    return { probes, ascii, diag, rows, png: canvas.toDataURL('image/png') };
  }, { pdfBytes: u8, SCALE, name });
  writeFileSync(outDir + name + '-page6.png', Buffer.from(out.png.split(',')[1], 'base64'));
  delete out.png;
  results[name] = out;
  console.log(name, JSON.stringify(out.probes));
}
console.log('\n=== ASCII finalC ===\n' + results.finalC.ascii.join('\n'));
console.log('\n=== valueZone finalC ===\n' + (results.finalC.diag.valueZone || []).join('\n'));
console.log('\n=== dividerZone finalC ===\n' + (results.finalC.diag.dividerZone || []).join('\n'));
console.log('\n=== clauseEdgeZone finalC ===\n' + (results.finalC.diag.clauseEdgeZone || []).join('\n'));

await browser.close();
server.close();
writeFileSync(outDir + 'render-final.json', JSON.stringify(results, null, 2));
console.log('PNGs + render-final.json written');