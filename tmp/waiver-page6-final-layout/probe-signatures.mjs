/* Signature-refinement probes for the page-6 signing panel (300 DPI, in-page).
   Run: node tmp/waiver-page6-final-layout/probe-signatures.mjs
*/
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
const baseURL = `http://127.0.0.1:${server.address().port}/`;

const SCALE = 300 / 72;
const SRC = JSON.parse(readFileSync(outDir + 'sig-summary.json', 'utf8'));
const files = { A: 'sigA.pdf', B: 'sigB.pdf', C: 'sigC.pdf', F: 'finalC.pdf', FB: 'finalC-before.pdf' };

const browser = await chromium.launch({ headless: true });
const c = await browser.newContext({ viewport: { width: 1760, height: 1300 } });
const page = await c.newPage();
await page.goto(baseURL + 'host', { waitUntil: 'domcontentloaded' });

const inputs = {};
for(const [k, f] of Object.entries(files)){
  const buf = readFileSync(outDir + f);
  inputs[k] = { data: Array.from(new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)) };
}

const result = await page.evaluate(async ({ inputs, SCALE, srcs }) => {
  const pdfjs = await import('/pdfjs/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';

  async function render(u8){
    const doc = await pdfjs.getDocument({ data: u8 }).promise;
    const p = await doc.getPage(6);
    const viewport = p.getViewport({ scale: SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    await p.render({ canvasContext: ctx, viewport }).promise;
    const txt = await p.getTextContent();
    const rows = {};
    for(const it of txt.items){
      if(typeof it.str !== 'string' || !it.str.trim()) continue;
      const bl = Math.round(it.transform[5] * 10) / 10;
      (rows[bl] = rows[bl] || []).push(it.str);
    }
    const rowText = bl => (rows[bl] || []).join(' ');
    return { pages: doc.numPages, canvas, ctx, W: canvas.width, H: canvas.height, rowText, rows };
  }

  const renders = {};
  for(const [k, v] of Object.entries(inputs)){
    v.data = new Uint8Array(v.data);
    renders[k] = await render(v.data);
  }

  const px = (r, xpt, ypt) => {
    const cx = Math.round(xpt * (r.W / 595.32)), cy = Math.round(r.H - ypt * (r.H / 842));
    const d = r.ctx.getImageData(cx, cy, 1, 1).data;
    return Math.min(d[0], d[1], d[2]);
  };

  function inkBounds(r, x0, x1, y0, y1){
    const cx = p => Math.round(p * (r.W / 595.32));
    const cy = p => Math.round(r.H - p * (r.H / 842));
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, found = false;
    const xl = Math.min(cx(x0), cx(x1)), xr = Math.max(cx(x0), cx(x1));
    const yt = Math.min(cy(y0), cy(y1)), yb = Math.max(cy(y0), cy(y1));
    for(let yy = yt; yy <= yb; yy++)
      for(let xx = xl; xx <= xr; xx++){
        const d = r.ctx.getImageData(xx, yy, 1, 1).data;
        if(d[0] < 128 && d[1] < 128 && d[2] < 128){
          if(!found){ minX = xx; maxX = xx; minY = yy; maxY = yy; found = true; }
          else{
            if(xx < minX) minX = xx; if(xx > maxX) maxX = xx;
            if(yy < minY) minY = yy; if(yy > maxY) maxY = yy;
          }
        }
      }
    if(!found) return null;
    const f = 595.32 / r.W;
    return {
      x0: minX * f, x1: (maxX + 1) * f,
      ylo: (r.H - maxY) / (r.H / 842), yhi: (r.H - minY) / (r.H / 842),
      w: (maxX - minX + 1) * f, h: (maxY - minY + 1) * f,
    };
  }

  function darkFrac(r, x0, x1, y0, y1){
    const cx = p => Math.round(p * (r.W / 595.32));
    const cy = p => Math.round(r.H - p * (r.H / 842));
    let dk = 0, tt = 0;
    const xl = Math.min(cx(x0), cx(x1)), xr = Math.max(cx(x0), cx(x1));
    const yt = Math.min(cy(y0), cy(y1)), yb = Math.max(cy(y0), cy(y1));
    for(let yy = yt; yy <= yb; yy += 2)
      for(let xx = xl; xx <= xr; xx += 2){
        const d = r.ctx.getImageData(xx, yy, 1, 1).data;
        tt++;
        if(d[0] < 128 && d[1] < 128 && d[2] < 128) dk++;
      }
    return tt ? dk / tt : 0;
  }

  const targets = [
    { name: 'sigA', file: 'A', base: 560, line: 558, sig: 'sig1' },
    { name: 'sigB', file: 'B', base: 560, line: 558, sig: 'sig1' },
    { name: 'sigC', file: 'C', base: 560, line: 558, sig: 'sig1' },
    { name: 'finalC', file: 'F', base: 560, line: 558, sig: 'sig1' },
    { name: 'finalC', file: 'F', base: 375, line: 373, sig: 'sig2' },
  ];
  const report = [];
  for(const t of targets){
    const src = srcs[t.name][t.sig];
    const scale = Math.min(135 / src.w, 36 / src.h, 1);
    const expW = src.w * scale, expH = src.h * scale;
    const r = renders[t.file];
    const ink = inkBounds(r, 148, 362, t.line + 2, t.base + 40);
    if(!ink){ report.push({ name: t.name, sig: t.sig, error: 'no ink found' }); continue; }
    const aspectSrc = src.w / src.h, aspectDst = ink.w / ink.h;
    const gap = ink.ylo - t.line;
    report.push({
      name: t.name, sig: t.sig,
      src: { w: src.w, h: src.h },
      expected: { w: +(expW.toFixed(1)), h: +(expH.toFixed(1)), scale: +scale.toFixed(4) },
      measured: { w: +ink.w.toFixed(1), h: +ink.h.toFixed(1), x0: +ink.x0.toFixed(1), x1: +ink.x1.toFixed(1), gap: +gap.toFixed(1) },
      aspect: { src: +aspectSrc.toFixed(2), dst: +aspectDst.toFixed(2) },
      checks: {
        notEnlargedByWidth: ink.w <= src.w + 0.5,
        notEnlargedByHeight: ink.h <= src.h + 0.5,
        withinWidthCap: ink.w <= 137,
        withinHeightCap: ink.h <= 38,
        aspectPreserved: Math.abs(aspectDst / aspectSrc - 1) <= 0.12,
        dimsMatch: ink.w >= expW - 3 && ink.w <= expW + 3 && ink.h >= expH - 3 && ink.h <= expH + 3,
        floatsAbove: gap >= 6.5,
        gapClean: darkFrac(r, ink.x0, Math.min(ink.x1, 360), t.line + 0.8, ink.ylo - 0.8) === 0,
        withinField: ink.x1 <= 362,
        noBoxOverlap: ink.x1 <= 380,
        noLabelOverlap: ink.x0 >= 150,
      },
      extras: { boxBorder: darkFrac(r, 384, 386, t.base - 16 - 48, t.base - 16 + 48) > 0.01 },
    });
  }

  // ---- before/after diff ----
  const FA = renders.FB, FB2 = renders.F;
  if(FA.W !== FB2.W || FA.H !== FB2.H) return { error: 'render size mismatch' };
  const sigRegions = [
    { x0: 138, x1: 372, y0: 516, y1: 614 },
    { x0: 138, x1: 372, y0: 331, y1: 429 },
  ];
  const boxInteriors = [
    { x0: 388, x1: 508, y0: 538, y1: 602 },
    { x0: 388, x1: 508, y0: 358, y1: 422 },
  ];
  const cy = p => Math.round(FB2.H - p * (FB2.H / 842));
  const cx = p => Math.round(p * (FB2.W / 595.32));
  function inRect(px, py, r){
    const ry0 = cy(r.y0), ry1 = cy(r.y1);
    return px >= cx(r.x0) && px <= cx(r.x1) && py >= Math.min(ry0, ry1) && py <= Math.max(ry0, ry1);
  }
  const AA = FA.ctx.getImageData(0, 0, FA.W, FA.H).data;
  const BB = FB2.ctx.getImageData(0, 0, FB2.W, FB2.H).data;
  const fingerprint = arr => {
    let h = 2166136261;
    for(let i = 0; i < arr.length; i += 977){ h ^= arr[i]; h = Math.imul(h, 16777619) >>> 0; }
    return h;
  };
  let diff = 0, diffInside = 0, diffOutside = 0, dMinX = Infinity, dMaxX = -1, dMinY = Infinity, dMaxY = -1;
  let crossDiff = 0, firstDiff = -1, pixIter = 0;
  for(let i = 0; i < AA.length && i < BB.length; i++){ if(AA[i] !== BB[i]){ crossDiff++; if(firstDiff < 0) firstDiff = i; } }
  for(let yy = 0; yy < FB2.H; yy++){
    for(let xx = 0; xx < FB2.W; xx++){
      pixIter++;
      const o = (yy * FB2.W + xx) * 4;
      const b = AA[o] !== BB[o] || AA[o + 1] !== BB[o + 1] || AA[o + 2] !== BB[o + 2];
      if(b){
        diff++;
        if(xx < dMinX) dMinX = xx; if(xx > dMaxX) dMaxX = xx;
        if(yy < dMinY) dMinY = yy; if(yy > dMaxY) dMaxY = yy;
        const inSig = sigRegions.some(r => inRect(xx, yy, r));
        const inBox = boxInteriors.some(r => inRect(xx, yy, r));
        if(!inSig && !inBox) diffOutside++;
        else diffInside++;
      }
    }
  }
  const f = 595.32 / FB2.W;
  const diffBBox = {
    x0: dMinX === Infinity ? null : +(dMinX * f).toFixed(1),
    x1: dMaxX === -1 ? null : +((dMaxX + 1) * f).toFixed(1),
    ylo: dMinY === Infinity ? null : +((FB2.H - (dMaxY + 1)) / (FB2.H / 842)).toFixed(1),
    yhi: dMinY === Infinity ? null : +((FB2.H - dMinY) / (FB2.H / 842)).toFixed(1),
  };

  return {
    fingerprint: { before: fingerprint(AA), after: fingerprint(BB), len: AA.length, crossDiff },
    probe: {
      pixIter,
      firstDiff,
      firstDiffVals: firstDiff < 0 ? null : { a: AA[firstDiff], b: BB[firstDiff] },
      dimProbe: { w: FB2.W, h: FB2.H, fbW: FA.W },
      px10k: { a: AA[10000], b: BB[10000] },
      px1M: { a: AA[1000000], b: BB[1000000] },
    },
    report,
    beforeAfter: {
      diffPixels: diff,
      diffInside: diffInside,
      diffOutside: diffOutside,
      diffBBoxPt: diffBBox,
      identicalOutsideSignatureAreas: diffOutside === 0,
    },
    sanity: {
      pagesF: renders.F.pages,
      dateC1: renders.F.rowText(510).replace(/\s+/g, '').toLowerCase().includes('date11/09/2026'),
      dateC2: renders.F.rowText(325).replace(/\s+/g, '').toLowerCase().includes('date11/09/2026'),
      c2Name: renders.F.rowText(425).includes('Jenny Smith'),
      fullC1: renders.F.rowText(610).includes('John Smith'),
      c1Box: renders.F.rowText(582.9).includes('Digitally signed') && renders.F.rowText(559.9).includes('AWST'),
      c2Box: renders.F.rowText(397.9).includes('Digitally signed') && renders.F.rowText(374.9).includes('AWST'),
      sigLineBand: (() => {
        const W = renders.F.W / 595.32, H = renders.F.H / 842;
        let left = -1, right = -1, minY = Infinity, maxY = -1;
        for(let y = 555; y <= 561; y += 1){
          const row = Math.round(renders.F.H - y * H);
          for(let x = 144; x <= 366; x += 1){
            const col = Math.round(x * W);
            const d = renders.F.ctx.getImageData(col, row, 1, 1).data;
            if(d[0] < 128 && d[1] < 128 && d[2] < 128){
              if(left < 0) left = x;
              right = x;
              if(y < minY) minY = y;
              if(y > maxY) maxY = y;
            }
          }
        }
        return { left, right, minY, maxY, endsAt350: left>0 && Math.abs(right - 350) <= 1.5 };
      })(),
      divider: renders.F.rowText(635).includes('CLIENT 1') && renders.F.rowText(450).includes('CLIENT 2'),
      clause: renders.F.rowText(665.6).includes('communications.'),
      footer: renders.F.rowText(24).includes('ASG'),
    },
  };
}, { inputs, SCALE, srcs: { sigA: SRC.sigA.src, sigB: SRC.sigB.src, sigC: SRC.sigC.src, finalC: SRC.finalC.src } });

await browser.close();
server.close();

console.log('\n=== per-target checks ===');
for(const r of result.report){
  console.log(`\n${r.name} [${r.sig}]  src ${r.src.w}x${r.src.h}  expected ${r.expected.w}x${r.expected.h} (scale ${r.expected.scale})`);
  console.log(`  measured ${r.measured.w}x${r.measured.h}  x ${r.measured.x0}..${r.measured.x1}  gap ${r.measured.gap}pt  aspect src ${r.aspect.src} dst ${r.aspect.dst}  box ${r.extras.boxBorder}`);
  console.log('  ' + JSON.stringify(r.checks));
}
console.log('\n=== before/after diff ===');
console.log('fingerprint before/after:', (result.fingerprint ? result.fingerprint.before + ' / ' + result.fingerprint.after + '  len ' + result.fingerprint.len + ' crossDiff ' + result.fingerprint.crossDiff : '(internal)'));
console.log('probe:', JSON.stringify(result.probe));
console.log('diff pixels:', result.beforeAfter.diffPixels, ' insideSigAndBox:', result.beforeAfter.diffInside, ' outsideSigAndBox:', result.beforeAfter.diffOutside);
console.log('diff bbox pt:', JSON.stringify(result.beforeAfter.diffBBoxPt));
console.log('identicalOutsideSignatureAreas:', result.beforeAfter.identicalOutsideSignatureAreas);
console.log('\n=== sanity (finalC after) ===');
console.log(JSON.stringify(result.sanity, null, 2));
const pass = result.report.every(r => r.error || Object.values(r.checks).every(Boolean))
  && result.beforeAfter.identicalOutsideSignatureAreas
  && Object.values(result.sanity).every(Boolean);
console.log('\nOVERALL PASS:', pass);
writeFileSync(outDir + 'probe-signatures.json', JSON.stringify(result, null, 2));