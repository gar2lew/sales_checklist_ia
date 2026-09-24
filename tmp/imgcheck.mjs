import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

for (let n = 1; n <= 6; n++) {
  const p = `templates/rendered/waiver-page-${n}.jpg`;
  const img = await loadImage(p);
  const c = createCanvas(img.width, img.height);
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let sum = 0, dark = 0;
  for (let i = 0; i < d.length; i += 4) { sum += d[i]; if (d[i] < 128) dark++; }
  const hash = createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);
  console.log(`page ${n} ${img.width}x${img.height} meanR ${(sum / (d.length / 4)).toFixed(1)} darkPx ${dark} sha256 ${hash}`);
}