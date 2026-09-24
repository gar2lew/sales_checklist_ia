const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
const path = require('path');
(async () => {
  const buf = fs.readFileSync(path.join(__dirname, '..', '..', 'templates', 'ASG-Disclosure-Waiver-2026.pdf'));
  const cMapUrl = new URL('../../node_modules/pdfjs-dist/cmaps/', 'file://' + __dirname + '/x').href;
  console.log('cMapUrl:', cMapUrl);
  const doc = await getDocument({ data: new Uint8Array(buf), cMapUrl: cMapUrl + '/', cMapPacked: true }).promise;
  const page = await doc.getPage(6);
  const tc = await page.getTextContent();
  console.log('p6 text:', tc.items.map(i => i.str).join(' | '));
  await doc.destroy();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
