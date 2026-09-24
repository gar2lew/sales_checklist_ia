import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';

const W = 1190, H = 1684;
const tpl = await loadImage(resolve('templates/rendered/waiver-page-6.jpg'));
const c = createCanvas(W, H); const cx = c.getContext('2d');
cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H); cx.drawImage(tpl, 0, 0, W, H);
const t = cx.getImageData(0, 0, W, H).data;

async function asciiFrom(file, label, y1, y2, x1, x2) {
  const p = await loadImage(resolve(file));
  const pc = createCanvas(W, H).getContext('2d');
  pc.drawImage(p, 0, 0, W, H);
  const d = pc.getImageData(0, 0, W, H).data;
  console.log(`===== ${label} y${y1}-${y2} x${x1}-${x2} =====`);
  const rows = Math.min(28, Math.floor((y2 - y1) / 4)), cols = 90;
  const stepY = (y2 - y1) / rows, stepX = (x2 - x1) / cols;
  for (let r = 0; r < rows; r++) {
    let line = '';
    const y = Math.round(y1 + r * stepY);
    for (let cq = 0; cq < cols; cq++) {
      const x = Math.round(x1 + cq * stepX);
      const i = (y * W + x) * 4;
      const ch = Math.abs(d[i] - t[i]) + Math.abs(d[i + 1] - t[i + 1]) + Math.abs(d[i + 2] - t[i + 2]) > 84;
      const dark = (d[i] + d[i + 1] + d[i + 2]) / 3 < 120;
      line += (ch ? '#' : (dark ? '.' : ' '));
    }
    console.log(line);
  }
}

await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c2 name zone 840-880', 840, 880, 100, 760);
await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c2 sig zone 950-1010', 950, 1010, 100, 760);
await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c2 date zone 1090-1130', 1090, 1130, 100, 360);
await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c1 name 460-510', 460, 510, 100, 760);
await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c1 sig 580-625', 580, 625, 100, 760);
await asciiFrom('screenshots/waiver-client2-pg-p1.png', 'c1 date 715-755', 715, 755, 100, 360);