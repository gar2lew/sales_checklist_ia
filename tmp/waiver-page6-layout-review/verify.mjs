/* Geometric verification of page-6 layout on a rendered PNG.
   Run: node tmp/waiver-page6-layout-review/verify.mjs comboC-page6.png
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const imgPath = process.argv[2] || 'comboC-page6.png';
const b64 = readFileSync(fileURLToPath(new URL(imgPath, import.meta.url))).toString('base64');
const PW = 595.32, PH = 842;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const r = await page.evaluate(async ({ b64, PW, PH }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const W = img.width, H = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, W, H).data;
  const s = W / PW, st = H / PH;

  function bands(x0Pt, x1Pt, y0Top, y1Top, thr = 0.08) {
    const x0 = Math.round(x0Pt * s), x1 = Math.round(x1Pt * s) - 1;
    const y0 = Math.round(y0Top * st), y1 = Math.round(y1Top * st) - 1;
    const out = [];
    for (let y = y0; y <= y1; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) { const i = (y * W + x) * 4; if (d[i] < 128 && d[i + 1] < 128 && d[i + 2] < 128) n++; }
      const k = n / (x1 - x0 + 1);
      if (k >= thr) {
        const last = out[out.length - 1];
        if (last && y <= last.yEnd + 1) last.yEnd = y, last.maxK = Math.max(last.maxK, k);
        else out.push({ yTop: y / st, yEndTop: (y + 1) / st, maxK: k });
      }
    }
    return out.map(b => ({ bl: PH - b.yEndTop, top: PH - b.yTop, span: b.yEndTop - b.yTop, maxK: b.maxK }));
  }

  // light-grey timestamp box fill (#f7f8fa) clusters
  const fill = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (d[i] === 247 && d[i + 1] === 248 && d[i + 2] === 250) fill.push([x, y]);
  }
  const clusters = [];
  for (const [x, y] of fill) {
    const c = clusters.find(c => Math.abs(c.cx - x) < 80 && Math.abs(c.cy - y) < 80);
    if (c) { c.count++; c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x); c.y0 = Math.min(c.y0, y); c.y1 = Math.max(c.y1, y); c.cx = x; c.cy = y; }
    else clusters.push({ count: 1, x0: x, x1: x, y0: y, y1: y, cx: x, cy: y });
  }
  const boxes = clusters.filter(c => c.count > 2000).map(c => ({
    xPt: [c.x0 / s, (c.x1 + 1) / s], bl: [PH - (c.y1 + 1) / st, PH - c.y0 / st], count: c.count
  }));

  return {
    C1nameRow: bands(54, 370, 226, 250),
    C1sigRow: bands(54, 370, 285, 318),
    C1dateRow: bands(54, 180, 352, 375),
    c2Divider: bands(54, 360, 380, 388),
    c2NameRow: bands(54, 370, 387, 462),
    c2SigRow: bands(54, 230, 440, 462),
    C1box: boxes[0] || null,
    C2box: boxes[1] || null,
  };
}, { b64, PW, PH });
console.log(JSON.stringify(r, null, 2));
await browser.close();