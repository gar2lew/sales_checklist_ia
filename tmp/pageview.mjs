import { createCanvas, loadImage } from '@napi-rs/canvas';
import { resolve } from 'node:path';

const W = 1190, H = 1684;

async function pageRGB(file) {
  const p = await loadImage(resolve(file));
  const pc = createCanvas(W, H).getContext('2d');
  pc.fillStyle = '#fff'; pc.fillRect(0, 0, W, H);
  pc.drawImage(p, 0, 0, W, H);
  return pc.getImageData(0, 0, W, H).data;
}

const d = await pageRGB(process.argv[2]);
const y1 = Number(process.argv[3] || 260), y2 = Number(process.argv[4] || 1320);
const x1 = Number(process.argv[5] || 40), x2 = Number(process.argv[6] || 1160);
const rows = Number(process.argv[7] || 36), cols = Number(process.argv[8] || 120);
const stepY = (y2 - y1) / rows, stepX = (x2 - x1) / cols;
console.log(`== ${process.argv[2]} y${y1}-${y2} x${x1}-${x2} ==`);
const grid = [];
for (let r = 0; r < rows; r++) {
  let line = '';
  for (let cq = 0; cq < cols; cq++) {
    const y = Math.round(y1 + r * stepY), x = Math.round(x1 + cq * stepX);
    const i = (y * W + x) * 4;
    line += (d[i] + d[i + 1] + d[i + 2]) / 3 < 120 ? '#' : ' ';
  }
  grid.push(line);
}
grid.forEach(l => console.log(l));