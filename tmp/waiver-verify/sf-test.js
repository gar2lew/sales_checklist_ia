const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
(async () => {
  // Mimic the vector path: load source, draw Helvetica text, save, reload.
  const PDFLib = require(path.join(root, 'node_modules', 'pdf-lib'));
  const { PDFDocument, StandardFonts } = PDFLib;
  const src = fs.readFileSync(path.join(root, 'templates', 'ASG-Disclosure-Waiver-2026.pdf'));
  const pdfDoc = await PDFDocument.load(src);
  const p6 = pdfDoc.getPage(5);
  const hb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  p6.drawText('John Smith', { x: 121, y: 604.8, size: 10.5, font: hb });
  p6.drawText('25/08/2026', { x: 78, y: 480.6, size: 10.5, font: hb });
  const bytes = await pdfDoc.save();
  const standardFontUrl = new URL('../../node_modules/pdfjs-dist/standard_fonts/', 'file://' + __dirname + '/x').href + '/';
  console.log('standardFontUrl:', standardFontUrl);
  const doc = await getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: standardFontUrl }).promise;
  const page = await doc.getPage(6);
  const tc = await page.getTextContent();
  const text = tc.items.map(i => i.str).join(' ');
  console.log('has John Smith:', text.includes('John Smith'));
  console.log('has 25/08/2026:', text.includes('25/08/2026'));
  await doc.destroy();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
