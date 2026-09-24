const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
(async () => {
  const fs = require('fs');
  const buf = fs.readFileSync('tmp/waiver-verify/sanitized.pdf');
  const doc = await getDocument({ data: new Uint8Array(buf) }).promise;
  const norm = s => s.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
  for (const p of [1,3,5,6]) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const text = tc.items.map(i => i.str).join(' ');
    console.log('p' + p + ' items=' + tc.items.length + ' textlen=' + text.length + ' waiverAndDisclosure=' + norm(text).includes('waiveranddisclosure') + ' clientsname=' + norm(text).includes('clientsname') + ' draft=' + /Updated draft/i.test(text) + ' starts=' + JSON.stringify(text.slice(0, 60)));
  }
  await doc.destroy();
})().catch(e => { console.error('ERR', e && e.message); process.exit(1); });
