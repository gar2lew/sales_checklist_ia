/* Probe clean source-template page 6 ink geometry.
   Run: node tmp/waiver-page6-layout-review/probe.mjs template-p6-6.png */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const imgPath = process.argv[2] || 'template-p6-6.png';
const b64 = readFileSync(fileURLToPath(new URL(imgPath, import.meta.url))).toString('base64');
const DPR = 200 / 72;           // px per pt
const PH = 842, PW = 595.32;    // page pt

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const out = await page.evaluate(async ({ b64, DPR, PW, PH }) => {
  const src = 'data:image/png;base64,' + b64;
  const img = new Image();
  img.src = src;
  await img.decode();
  const W = img.width, H = img.height;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);
  const ink = (x, y) => { const i = (y * W + x) * 4; return data[i] < 128 && data[i + 1] < 128 && data[i + 2] < 128; };

  const pxOfPtX = pt => (pt / PW) * W;
  const pxOfPtYtop = pt => (pt / PH) * H;

  function rowProfile(x0Pt, x1Pt, y0Top, y1Top) {
    const x0 = Math.round(pxOfPtX(x0Pt)), x1 = Math.round(pxOfPtX(x1Pt)) - 1;
    const y0 = Math.round(pxOfPtYtop(y0Top)), y1 = Math.round(pxOfPtYtop(y1Top)) - 1;
    const profile = [];
    for (let y = y0; y <= y1; y++) {
      let n = 0;
      for (let x = x0; x <= x1; x++) if (ink(x, y)) n++;
      if (n > 0) profile.push({ y, k: n / (x1 - x0 + 1) });
    }
    const bands = [];
    for (const p of profile) {
      const last = bands[bands.length - 1];
      if (last && p.y <= last.yEnd + 1) last.yEnd = p.y, last.maxK = Math.max(last.maxK, p.k);
      else bands.push({ yStart: p.y, yEnd: p.y, maxK: p.k });
    }
    return bands.map(b => ({
      yTopPt: (b.yStart / H) * PH, yEndTopPt: (b.yEnd / H) * PH,
      blStart: PH - (b.yStart / H) * PH, blEnd: PH - (b.yEnd / H) * PH,
      maxK: b.maxK, px: [b.yStart, b.yEnd]
    }));
  }

  function colRuns(y0Top, y1Top, x0Pt, x1Pt, minK = 0.06) {
    const y0 = Math.round(pxOfPtYtop(y0Top)), y1 = Math.round(pxOfPtYtop(y1Top)) - 1;
    const x0 = Math.round(pxOfPtX(x0Pt)), x1 = Math.round(pxOfPtX(x1Pt)) - 1;
    const runs = [];
    let run = null;
    for (let x = x0; x <= x1; x++) {
      let n = 0;
      for (let y = y0; y <= y1; y++) if (ink(x, y)) n++;
      const k = n / (y1 - y0 + 1);
      if (k >= minK) { if (!run) run = { x0: x, x1: x }; else run.x1 = x; }
      else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    return runs.map(r => ({ xPt: [(r.x0 / W) * PW, ((r.x1 + 1) / W) * PW], wPt: ((r.x1 - r.x0 + 1) / W) * PW }));
  }

  return {
    W, H,
    nameRow: rowProfile(54, 370, 225, 252),
    sigRow: rowProfile(54, 370, 288, 312),
    dateRow: rowProfile(54, 180, 350, 375),
    c2Zone: rowProfile(54, 370, 405, 620),
    nameUnderlineRuns: colRuns(233, 248, 110, 365),
    sigUnderlineRuns: colRuns(294, 310, 110, 365),
    dateRuns: colRuns(356, 372, 72, 175),
    sigInkProfile: rowProfile(142, 365, 270, 335),
    sigInkClin: (() => {
      const y0 = Math.round(pxOfPtYtop(270)), y1 = Math.round(pxOfPtYtop(335)) - 1;
      const x0 = Math.round(pxOfPtX(142)), x1 = Math.round(pxOfPtX(365)) - 1;
      const rows = [];
      for (let y = y0; y <= y1; y++) {
        let n = 0;
        for (let x = x0; x <= x1; x++) if (ink(x, y)) n++;
        rows.push(n);
      }
      return rows;
    })()
  };
}, { b64, DPR, PW, PH });

console.log(JSON.stringify(out, null, 2));
await browser.close();