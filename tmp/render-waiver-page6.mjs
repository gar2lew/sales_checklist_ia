import { chromium } from 'playwright';
import fs from 'fs';

const PDF_URL = 'http://127.0.0.1:8766/templates/ASG-Disclosure-Waiver-2026.pdf';
const OUT_JPG = 'templates/rendered/waiver-page-6.jpg';
const SCALE = 2;

const pdfB64 = fs.readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.min.mjs').toString('base64');
const workerB64 = fs.readFileSync('node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs').toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil: 'domcontentloaded' });

const result = await page.evaluate(async ({ pdfB64, workerB64, PDF_URL }) => {
  const codepoints = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const pdfjsLib = await import('data:text/javascript;base64,' + pdfB64);
  pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(
    new Blob([codepoints(workerB64)], { type: 'text/javascript' })
  );
  const resp = await fetch(PDF_URL);
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  const data = new Uint8Array(await resp.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const p6 = await doc.getPage(6);
  const viewport = p6.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');
  await p6.render({ canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const b64 = dataUrl.split(',')[1];
  doc.destroy();
  return { w: canvas.width, h: canvas.height, b64 };
}, { pdfB64, workerB64, PDF_URL });

console.log('SIZE ' + result.w + 'x' + result.h + ' b64len=' + result.b64.length);
fs.writeFileSync(OUT_JPG, Buffer.from(result.b64, 'base64'));
await browser.close();
console.log('WROTE ' + OUT_JPG);