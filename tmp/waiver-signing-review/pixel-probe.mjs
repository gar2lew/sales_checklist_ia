// Refined probes: empty interior spots, borders, and ink detection in name/date/timestamp box.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.css':'text/css','.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.pdf':'application/pdf' };
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
const page = await browser.newPage();
await page.goto(baseURL + 'index.html', { waitUntil:'domcontentloaded' });
const pdfUrl = baseURL + 'tmp/waiver-signing-review/combo-C.pdf';

const result = await page.evaluate(async (pdfUrl) => {
  const pdfjs = await import('/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs';
  const doc = await pdfjs.getDocument(pdfUrl).promise;
  const p = await doc.getPage(6);
  const scale = 3;
  const viewport = p.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  await p.render({ canvasContext: ctx, viewport }).promise;
  const px = (xPt, yPt, r = 1) => {
    const d = ctx.getImageData(Math.round(xPt * scale), Math.round((841.92 - yPt) * scale), r, 1).data;
    let mn = 255, mx = 0;
    for(let i = 0; i < r; i++){ const g = (d[i*4] + d[i*4+1] + d[i*4+2]) / 3; if(g < mn) mn = g; if(g > mx) mx = g; }
    return [Math.round(mn), Math.round(mx)];
  };
  const minDark = (x0, x1, y0, y1) => {
    let mn = 255, dark = 0, tot = 0;
    for(let y = y0; y <= y1; y += 1) for(let x = x0; x <= x1; x += 2){
      const g = (ctx.getImageData(Math.round(x*scale), Math.round((841.92 - y)*scale), 1, 1).data[0]
               + ctx.getImageData(Math.round(x*scale), Math.round((841.92 - y)*scale), 1, 1).data[1]
               + ctx.getImageData(Math.round(x*scale), Math.round((841.92 - y)*scale), 1, 1).data[2]) / 3;
      tot++; if(g < 150) dark++; if(g < mn) mn = Math.round(g);
    }
    return { min: mn, darkPixelsOf: tot, dark, darkPct: Math.round(100*dark/tot) };
  };
  const out = {};
  // Empty-interior fill probes (between/right-of text lines) — expect light grey ~247 at high scale
  out.c1Fill_455x530 = px(455, 530);
  out.c1Fill_455x513 = px(455, 513);
  out.c1Fill_452x526 = px(452, 526);
  out.c1Fill_410x530 = px(410, 530);   // right of "(AWST)" end 414 -> x 425+ safe; 410 may touch
  out.c1Outside_470x530 = px(470, 530);
  out.c2Fill_455x338 = px(455, 338);
  out.c2Fill_455x321 = px(455, 321);
  out.c2Outside_470x338 = px(470, 338);
  // Borders (stroke 0.75pt -> ~2px at scale 3)
  out.c1BorderLeft = px(380.3, 530, 3);
  out.c1BorderRight = px(461.9, 530, 3);
  out.c1BorderTop = px(430, 557.9, 3);
  out.c1BorderBottom = px(430, 508.3, 3);
  out.c2BorderTop = px(430, 349.9, 3);    // C2 box y 300..350
  out.c2BorderBottom = px(430, 300.3, 3);
  // Ink in name/date values and timestamp text column
  out.c1Name = minDark(127, 185, 602, 613);
  out.c1Date = minDark(88, 141, 477, 489);
  out.c1StampText = minDark(386, 463, 518, 553);
  out.c2Name = minDark(140, 197, 414, 425);
  out.c2Date = minDark(106, 160, 277, 289);
  out.c2StampText = minDark(386, 463, 310, 345);
  doc.destroy();
  return out;
}, pdfUrl);

console.log(JSON.stringify(result, null, 2));
await browser.close();
server.close();