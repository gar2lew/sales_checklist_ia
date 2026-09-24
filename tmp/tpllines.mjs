import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';

const W = 1190, H = 1684;
const tpl = await loadImage(resolve('templates/rendered/waiver-page-6.jpg'));
const c = createCanvas(W, H); const cx = c.getContext('2d');
cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(tpl, 0, 0, W, H);
const d = cx.getImageData(0, 0, W, H).data;

function darkRowExtent(y) {
  let maxRun = 0, run = 0, darkPx = 0;
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dark = (d[i] + d[i + 1] + d[i + 2]) / 3 < 120;
    if (dark) { darkPx++; run++; if (run > maxRun) maxRun = run; }
    else run = 0;
  }
  return { maxRun, darkPx };
}

for (let y = 0; y < H; y += 3) {
  const { maxRun, darkPx } = darkRowExtent(y);
  if (maxRun > 500) console.log(`template LINE row y=${y} maxRun=${maxRun} darkPx=${darkPx}`);
}

const sig1 = 0;
console.log('--- our fields (from inkrows) ---');
console.log('c1 name rows 1197-1207, c1 sig 1070-1084, c1 date ~951 (weak), footer 1653');
console.log('c2 name 807-819, c2 sig 682-695, c2 date 558-571');