const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
(async () => {
  const buf = fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf');
  const doc = await getDocument({ data: new Uint8Array(buf) }).promise;
  for(const p of [1,3,5,6]) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ');
    console.log('p' + p + ' draft=' + /Updated draft/i.test(text) + ' textsample=' + JSON.stringify(text.slice(0,80)));
  }
  await doc.destroy();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
