import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';

const [pagePath, templatePath, mode] = process.argv.slice(2);
const hasClient2 = mode === 'client2';
const W = 1190, H = 1684;

const page = await loadImage(resolve(pagePath));
const tpl = await loadImage(resolve(templatePath));
const canvas = createCanvas(W, H); const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(tpl, 0, 0, W, H);
const tData = ctx.getImageData(0, 0, W, H).data;
const pctx = createCanvas(W, H).getContext('2d');
pctx.drawImage(page, 0, 0, W, H);
const pgData = pctx.getImageData(0, 0, W, H).data;

const bands = [
  ['client1 name (printed row ~484)', 118, 720, 455, 515],
  ['client1 signature (printed row ~609)', 118, 732, 560, 630],
  ['client1 date (printed row ~733)', 108, 360, 700, 770],
  ['client2 name (below c1 block)', 108, 720, 845, 905],
  ['client2 signature', 118, 720, 960, 1020],
  ['client2 date', 108, 360, 1095, 1135],
  ['footer', 80, 260, 1600, 1690],
];
const checks = bands.slice(0, 3).concat(hasClient2 ? bands.slice(3, 6) : []);
const optional = new Set(['client2 signature', 'client2 date']);

function bandStats(x1, x2, y1, y2) {
  let changed = 0, sum = 0, n = 0;
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) {
    const i = (y * W + x) * 4, j = i + 1, k = i + 2;
    const d = Math.abs(pgData[i] - tData[i]) + Math.abs(pgData[j] - tData[j]) + Math.abs(pgData[k] - tData[k]);
    if (d > 84) changed++;
    sum += d; n++;
  }
  return { changedPct: +(100 * changed / n).toFixed(2), meanAbs: +(sum / n).toFixed(2) };
}

let failed = 0;
for (const [label, x1, x2, y1, y2] of checks) {
  const s = bandStats(x1, x2, y1, y2);
  const present = s.meanAbs > 5 && s.changedPct > 1.5;
  if (!present && !optional.has(label)) failed++;
  console.log(`${present ? 'ok  ' : optional.has(label) ? 'note' : 'FAIL'} ${label}: changed ${s.changedPct}% meanAbs ${s.meanAbs}`);
}

const clean = { changed: 0, n: 0, sum: 0 };
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  const d = Math.abs(pgData[i] - tData[i]) + Math.abs(pgData[i + 1] - tData[i + 1]) + Math.abs(pgData[i + 2] - tData[i + 2]);
  if (d > 84) clean.changed++;
  clean.sum += d; clean.n++;
}
const cleanPct = +(100 * clean.changed / clean.n).toFixed(3);
console.log(`whole-page changed: ${cleanPct}%  meanAbs ${(clean.sum / clean.n).toFixed(2)}  (expect < ~3%: jpeg re-encode noise + footer + fields all included)`);
process.exit(failed ? 1 : 0);