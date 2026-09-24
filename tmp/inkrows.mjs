import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';

const W = 1190, H = 1684;

async function darkRowCounts(file) {
  const p = await loadImage(resolve(file));
  const pc = createCanvas(W, H).getContext('2d');
  pc.drawImage(p, 0, 0, W, H);
  const d = pc.getImageData(0, 0, W, H).data;
  const rows = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let c = 0;
    for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4;
      if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 120) c++;
    }
    rows[y] = c;
  }
  return rows;
}

const t = await darkRowCounts('templates/rendered/waiver-page-6.jpg');
const c1 = await darkRowCounts('screenshots/waiver-desktop-pg-p1.png');
const c2 = await darkRowCounts('screenshots/waiver-client2-pg-p1.png');

let c1add = [];
for (let y = 0; y < H; y++) if (c1[y] - t[y] > 8) c1add.push(`${y}(${c1[y] - t[y]})`);
console.log(`C1 added-ink rows (count=${c1add.length}):`);
console.log(c1add.join(' '));

let c2add = [];
for (let y = 0; y < H; y++) if (c2[y] - c1[y] > 8) c2add.push(`${y}(${c2[y] - c1[y]})`);
console.log(`C2-only added-ink rows (count=${c2add.length}):`);
console.log(c2add.join(' '));