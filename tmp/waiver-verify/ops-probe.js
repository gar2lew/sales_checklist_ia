const { PDFDocument } = require('pdf-lib');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
(async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const jpg = await doc.embedJpg(new Uint8Array(fs.readFileSync('templates/rendered/waiver-page-6.jpg')));
  page.drawImage(jpg, { x: 0, y: 0, width: 595.28, height: 841.89 });
  const bytes = await doc.save();
  const pdf = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const p = await pdf.getPage(1);
  const op = await p.getOperatorList();
  for (let i = 0; i < op.fnArray.length; i++) {
    const fni = op.fnArray[i];
    const args = op.argsArray[i];
    if (fni === 85 && args && args.length) {
      const im = args[0];
      console.log('  image dims', im.width, im.height, 'hasData', !!im.data, 'dataLen', im.data && im.data.length, 'type', im.data && im.data.constructor.name);
      let ink = 0, tot = 0;
      const H = im.height;
      const y0 = Math.floor(H * 0.95);
      for (let y = y0; y < H; y += 8) {
        for (let x = 0; x < im.width; x += 8) {
          const o = (y * im.width + x) * 4;
          const lum = 0.299 * im.data[o] + 0.587 * im.data[o + 1] + 0.114 * im.data[o + 2];
          if (lum < 200) ink++;
          tot++;
        }
      }
      console.log('  bottom5% ink ratio', (ink / tot).toFixed(4));
      break;
    }
  }
  await pdf.destroy();
})().catch(e => { console.error('ERR', e && e.message); process.exit(1); });
