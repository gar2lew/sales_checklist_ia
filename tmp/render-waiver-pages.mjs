import { chromium } from 'playwright';
import fs from 'fs';

const PDF_URL = 'http://127.0.0.1:8766/templates/ASG-Disclosure-Waiver-2026.pdf';
const SCALE = 2;

const pdfB64 = fs.readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.min.mjs').toString('base64');
const workerB64 = fs.readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs').toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil: 'domcontentloaded' });

const pagesToRender = (process.argv[2] || '1,2,3,4,5').split(',').map(n => Number(n.trim()));

for (const num of pagesToRender) {
  const result = await page.evaluate(async ({ pdfB64, workerB64, PDF_URL, num, scale }) => {
    const codepoints = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const pdfjsLib = await import('data:text/javascript;base64,' + pdfB64);
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
      new Blob([codepoints(workerB64)], { type: 'text/javascript' })
    );
    const resp = await fetch(PDF_URL);
    if (!resp.ok) throw new Error('fetch failed ' + resp.status);
    const data = new Uint8Array(await resp.arrayBuffer());
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const pg = await doc.getPage(num);
    const viewport = pg.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    await pg.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1];
    doc.destroy();
    return { w: canvas.width, h: canvas.height, b64 };
  }, { pdfB64, workerB64, PDF_URL, num, scale: SCALE });

  const out = `templates/rendered/waiver-page-${num}.jpg`;
  console.log(`PAGE ${num} ${result.w}x${result.h} b64len=${result.b64.length}`);
  if (result.b64.length < 20000) { console.log('SUSPICIOUSLY SMALL OUTPUT; skipping write for safety'); continue; }
  fs.writeFileSync(out, Buffer.from(result.b64, 'base64'));
  console.log('WROTE ' + out);
}
await browser.close();
console.log('DONE');