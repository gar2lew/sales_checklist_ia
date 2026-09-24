import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readFileSync } from 'node:fs';

const data = new Uint8Array(readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf'));
const pdf = await getDocument({ data }).promise;
console.log(`pages=${pdf.numPages}`);
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = tc.items.map(i => ({ str: i.str.trim(), y: i.transform[5], x: i.transform[4] }));
  const bottom = items.filter(i => i.str && i.y < 60).sort((a, b) => a.y - b.y);
  const top = items.filter(i => i.str && i.y > 800).sort((a, b) => b.y - a.y);
  const firstBody = items.filter(i => i.str).slice(0, 4).map(i => `${i.x.toFixed(0)},${i.y.toFixed(0)} ${i.str.slice(0, 60)}`).join(' || ');
  console.log(`\n--- PAGE ${n} (h=${vp.height.toFixed(2)}) ---`);
  console.log(`BOTTOM(<60): ${bottom.map(i => `${i.y.toFixed(1)} ${i.str.slice(0, 70)}`).join(' | ')}`);
  console.log(`TOP(>800): ${top.map(i => `${i.y.toFixed(1)} ${i.str.slice(0, 70)}`).join(' | ')}`);
  console.log(`HEAD: ${firstBody}`);
}
const p6 = await pdf.getPage(6);
const t6 = await p6.getTextContent();
const joined = t6.items.map(i => i.str).join(' ');
for (const m of joined.matchAll(/(CLAUSE\s*\d+)/gi)) console.log('matched:', m[0]);
const ack = joined.indexOf('ACKNOWLEDGEMENT');
console.log('ack index:', ack, 'context:', joined.slice(ack - 80, ack + 160).replace(/\s+/g, ' '));
pdf.destroy();