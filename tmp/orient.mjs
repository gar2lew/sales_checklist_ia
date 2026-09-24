import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const W = 1190, H = 1684;

async function loadRGB(file) {
  const p = await loadImage(resolve(file));
  const pc = createCanvas(W, H).getContext('2d');
  pc.fillStyle = '#fff'; pc.fillRect(0, 0, W, H);
  pc.drawImage(p, 0, 0, W, H);
  return pc.getImageData(0, 0, W, H).data;
}

const t = await loadRGB('templates/rendered/waiver-page-6.jpg');
const gen = await loadRGB('screenshots/waiver-desktop-pg-p1.png');

function diffAt(genData, tData, flipY, dy) {
  let sum = 0, n = 0;
  for (let y = 8; y < H - 8; y += 4) {
    const ty = flipY ? H - 1 - (y + dy) : y + dy;
    if (ty < 0 || ty >= H) continue;
    for (let x = 0; x < W; x += 4) {
      const g = (y * W + x) * 4, t2 = (ty * W + x) * 4;
      sum += Math.abs(genData[g] - tData[t2]) + Math.abs(genData[g + 1] - tData[t2 + 1]) + Math.abs(genData[g + 2] - tData[t2 + 2]);
      n++;
    }
  }
  return sum / n;
}

let bestN = { v: Infinity, dy: 0 }, bestF = { v: Infinity, dy: 0 };
for (let dy = -4; dy <= 4; dy++) {
  const vN = diffAt(gen, t, false, dy);
  const vF = diffAt(gen, t, true, dy);
  if (vN < bestN.v) bestN = { v: vN, dy };
  if (vF < bestF.v) bestF = { v: vF, dy };
}
console.log(`normal orientation min-meanAbs=${bestN.v.toFixed(2)} at dy=${bestN.dy}`);
console.log(`flipped orientation min-meanAbs=${bestF.v.toFixed(2)} at dy=${bestF.dy}`);

const data = new Uint8Array(readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf'));
const pdf = await getDocument({ data }).promise;
const page = await pdf.getPage(6);
const tc = await page.getTextContent();
for (const it of tc.items) {
  const str = (it.str || '').replace(/\n/g, '|');
  console.log(`tpl p6 text: "${str.slice(0, 60)}" pt(x=${it.transform[4].toFixed(1)}, y=${it.transform[5].toFixed(1)})`);
}