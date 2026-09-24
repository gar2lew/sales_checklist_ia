import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nodeCanvasFactory = {
  create(width, height) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext('2d') };
  },
  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  },
  destroy() {}
};

const input = process.argv[2];
const scale = Number(process.argv[3] || '2');
const data = new Uint8Array(readFileSync(input));
const pdf = await getDocument({ data, canvasFactory: nodeCanvasFactory }).promise;
console.log(`pages=${pdf.numPages}`);
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const viewport = page.getViewport({ scale });
  const { canvas, context } = nodeCanvasFactory.create(viewport.width, viewport.height);
  await page.render({ canvasContext: context, viewport, canvasFactory: nodeCanvasFactory }).promise;
  const out = process.argv[4] ? `${process.argv[4]}-p${n}.png` : `${input}.p${n}.png`;
  writeFileSync(out, canvas.toBuffer('image/png'));
  console.log(out);
}