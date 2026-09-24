import { chromium } from 'playwright';
import fs from 'fs';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil: 'domcontentloaded' });
const info = await page.evaluate(async () => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('load failed')); img.src = 'templates/rendered/waiver-page-6.jpg'; });
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let min = 255, max = 0, sum = 0, n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    if (g < min) min = g; if (g > max) max = g; sum += g;
  }
  return { w: img.naturalWidth, h: img.naturalHeight, greyMin: min, greyMax: max, greyMean: Math.round(sum / n) };
});
console.log('IMG ' + JSON.stringify(info));
await browser.close();
