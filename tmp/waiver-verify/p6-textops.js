const { getDocument, OPS } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
(async () => {
  const bytes = fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf');
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await doc.getPage(6);
  const op = await page.getOperatorList();
  const names = {};
  for (const k of Object.keys(OPS)) names[OPS[k]] = k;
  // print beginText/setFont/setTextMatrix/showText/endText lines
  for (let i = 0; i < op.fnArray.length; i++) {
    const fni = op.fnArray[i];
    const n = names[fni];
    const a = op.argsArray[i];
    let pretty = '';
    try {
      if (n.includes('Text')) {
        if (n === 'showText') {
          const it = a[0];
          const arr = Array.isArray(it) ? it : [it];
          const strs = arr.map(v => (typeof v === 'object' ? (v.str || ('off' + (v.vert ? 'v' : 'h') + ':' + v.horizontalAdvance + ':' + v.verticalAdvance)) : String(v))).join(' | ');
          pretty = '"' + strs.slice(0, 140) + '"';
        } else if (n === 'setTextMatrix' || n === 'moveText') {
          pretty = a.map(v => +Number(v).toFixed(1)).join(',');
        } else if (n === 'setFont') {
          pretty = a.join(' ');
        } else if (n === 'setLeading') {
          pretty = a.join(' ');
        } else if (n === 'setTextRise') {
          pretty = a.join(' ');
        }
      }
    } catch (e) { pretty = '?'; }
    if (n && n.includes('Text')) {
      console.log(`${i}\t${n}\t${pretty}`);
    }
  }
  await doc.destroy();
})().catch(e => { console.error('FAIL', e); process.exit(1); });