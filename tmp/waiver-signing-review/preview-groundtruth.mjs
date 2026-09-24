// Ground truth: page-6 preview canvas vs raw template JPG rendered the same way.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.js':'text/javascript', '.html':'text/html', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.pdf':'application/pdf' };
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
const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
await page.goto(baseURL, { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:10000 });
await page.fill('#clientName', 'John Smith');
const loc = page.locator('#signature'); await loc.scrollIntoViewIfNeeded();
const box = await loc.boundingBox();
await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.45);
await page.mouse.down(); await page.mouse.move(box.x + box.width*0.7, box.y + box.height*0.55, { steps:10 }); await page.mouse.up();
await page.fill('#waiverClient1Date', '25/08/2026');
await page.check('#waiverClient2Toggle');
await page.fill('#client2Name', 'Jane Smith');
await page.fill('#waiverClient2Date', '25/08/2026');
const loc2 = page.locator('#signature2'); await loc2.scrollIntoViewIfNeeded();
const b2 = await loc2.boundingBox();
await page.mouse.move(b2.x + b2.width*0.2, b2.y + b2.height*0.5);
await page.mouse.down(); await page.mouse.move(b2.x + b2.width*0.7, b2.y + b2.height*0.5, { steps:8 }); await page.mouse.up();
const fieldSnapshot = await page.evaluate(() => {
  const ids = ['clientName', 'client2Name', 'waiverClient2Date', 'waiverClient1Date', 'waiverClient1Name', 'waiverClient2Name'];
  const out = {};
  for(const id of ids){ const el = document.getElementById(id); out[id] = el ? el.value : '(missing)'; }
  out.toggleChecked = document.getElementById('waiverClient2Toggle') ? document.getElementById('waiverClient2Toggle').checked : null;
  return out;
});
await page.evaluate(() => document.getElementById('previewTop').click());
await page.waitForTimeout(800);
await page.evaluate(() => { const go = () => { const t = document.getElementById('previewPageLabel').textContent; const total = Number((t.match(/of\s+(\d+)/) || [])[1] || 0); const cur = Number((t.match(/Page\s+(\d+)/) || [])[1] || 0); if(cur < total){ document.getElementById('previewNext').click(); setTimeout(go, 80); } }; go(); });
await page.waitForFunction(() => { const t = document.getElementById('previewPageLabel').textContent; return Number((t.match(/Page\s+(\d+)/) || [])[1] || 0) >= 6 && Number((t.match(/of\s+(\d+)/) || [])[1] || 0) >= 6; }, null, { timeout: 15000 });
await page.waitForTimeout(500);

const out = await page.evaluate(async () => {
  const paper = document.getElementById('previewPaper');
  const cv = [...paper.querySelectorAll('canvas')].find(c => c.width >= 700);
  const ctx = cv.getContext('2d');
  const data = Array.from(ctx.getImageData(0, 0, cv.width, cv.height).data);
  // Raw template page 6, decoded and rendered the same mapping drawWaiverPage uses.
  const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'templates/rendered/waiver-page-6.jpg'; });
  const W = 595, H = 842, scale = 2;
  const c = document.createElement('canvas'); c.width = Math.round(W*scale); c.height = Math.round(H*scale);
  const c2 = c.getContext('2d'); c2.scale(scale, scale); c2.fillStyle = '#fff'; c2.fillRect(0, 0, W, H);
  const imgAspect = img.width / img.height, pageAspect = W / H;
  let dw, dh, dx, dy;
  if(imgAspect > pageAspect){ dw = W; dh = W / imgAspect; dx = 0; dy = (H - dh) / 2; }
  else { dh = H; dw = H * imgAspect; dx = (W - dw) / 2; dy = 0; }
  c2.drawImage(img, dx, dy, dw, dh);
  return {
    preview: { w: cv.width, h: cv.height, data },
    template: { w: c.width, h: c.height, data: Array.from(c2.getImageData(0, 0, c.width, c.height).data) },
    imgSize: [img.width, img.height], map: { dw, dh, dx, dy },
  };
});

const pw = out.preview.w, ph = out.preview.h, tw = out.template.w, th = out.template.h;
// Preview canvas scale is 1.25. sx1/sy1 map PDF pt -> preview canvas px using the app's own mapping.
const H2 = 842;
const sx1 = (v) => (out.map.dx + (v / out.imgSize[0]) * out.map.dw) * 1.25;
const sy1 = (v) => (out.map.dy + ((H2 - v) / H2) * out.map.dh) * 1.25;
const samplePreview = (xPt, yPt) => { const i = (Math.round(sy1(yPt)) * pw + Math.round(sx1(xPt))) * 4; const d = out.preview.data; return { r: d[i], g: d[i+1], b: d[i+2] }; };
// Sample known feature points
const spots = [
  ['nameJohn', 150, 605], ['nameSchool', 140, 420], ['c1BoxFill', 430, 540], ['c1BoxFill2', 410, 528],
  ['c1BoxTop', 430, 557], ['divider', 130, 436], ['c2Date', 110, 281], ['sigLineC1', 200, 538],
];
const result = {};
for(const [name, x, y] of spots){ const p = samplePreview(x, y); result[name] = { r: p.r, g: p.g, b: p.b }; }
const bbox = (pred) => {
  const xs = [], ys = [];
  const pd = out.preview.data;
  for(let y = 0; y < ph; y++) for(let x = 0; x < pw; x++){ const i = (y*pw + x)*4; if(pred(pd[i], pd[i+1], pd[i+2])){ xs.push(x); ys.push(y); } }
  if(!xs.length) return null;
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const toPtX = (px) => (px / 1.25 - out.map.dx) * out.imgSize[0] / out.map.dw;
  const toPtY = (py) => 842 - ((py / 1.25 - out.map.dy) / out.map.dh) * 842;
  return { bboxPx: [minX, minY, maxX, maxY], bboxPt: [toPtX(minX), toPtY(maxY), toPtX(maxX), toPtY(minY)], count: xs.length };
};
const analysis = {
  f7f8fa: bbox((r,g,b) => r===247 && g===248 && b===250),
  ink111: bbox((r,g,b) => r===17 && g===17 && b===17),
  tsText29303c: bbox((r,g,b) => r===41 && g===48 && b===60),
  dividerColour: bbox((r,g,b) => Math.abs(r-173) < 8 && Math.abs(g-176) < 8 && Math.abs(b-181) < 8),
  c2DividerTol: bbox((r,g,b) => Math.abs(r-g) < 6 && Math.abs(g-b) < 6 && (r+g+b)/3 >= 150 && (r+g+b)/3 <= 200),
};
console.log(JSON.stringify({ fieldSnapshot, imgSize: out.imgSize, map: out.map, spots: result, analysis }, null, 2));
await browser.close(); server.close();