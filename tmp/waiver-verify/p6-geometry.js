/* Dump page-6 drawing ops (text + lines) from the authoritative source, PDF coords (bottom-left origin). */
const { getDocument, OPS } = require('pdfjs-dist/legacy/build/pdf.mjs');
const fs = require('fs');
(async () => {
  const bytes = fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf');
  const doc = await getDocument({ data: new Uint8Array(bytes) }).promise;
  const page = await doc.getPage(6);
  const H = page.view[3];
  const op = await page.getOperatorList();
  const rows = [];
  for (let i = 0; i < op.fnArray.length; i++) {
    const fni = op.fnArray[i];
    const args = op.argsArray[i];
    if (fni === OPS.showText) {
      const item = args[0][0];
      const tr = item && item.transform;
      rows.push({ kind: 'txt', str: (item && item.str || '').toString().slice(0, 40), transform: tr });
    } else if (fni === OPS.setFont) {
      const name = args[0];
      const size = args[1];
      rows.push({ kind: 'font', name, size });
    } else if (fni === OPS.rectangle) {
      const [x, y, w, h] = args;
      rows.push({ kind: 'rect', x, y, w, h });
    } else if (fni === OPS.moveTo || fni === OPS.lineTo) {
      const last = rows[rows.length - 1];
      if (last && last.kind === 'line') { last.x.push(args[0]); last.y.push(args[1]); }
      else rows.push({ kind: 'line', x: [args[0]], y: [args[1]] });
    } else if (fni === OPS.curveTo) {
      const last = rows[rows.length - 1];
      if (last && last.kind === 'line') { last.x.push(args[4]); last.y.push(args[5]); }
    } else if (fni === OPS.setLineWidth) {
      const last = rows[rows.length - 1];
      if (last) last.lw = args[0];
    } else if (fni === OPS.paintJpegXObject || fni === OPS.paintImageXObject) {
      rows.push({ kind: 'img', name: args[0] });
    }
  }
  // dedupe consecutive text into a running output
  for (const r of rows) {
    if (r.kind === 'txt' && r.transform) {
      console.log(`TXT y=${r.transform[5].toFixed(1).padStart(7)} x=${r.transform[4].toFixed(1).padStart(7)} "${r.str}"`);
    } else if (r.kind === 'font') {
      console.log(`FONT ${r.name} ${r.size}`);
    } else if (r.kind === 'rect') {
      if (r.y > 200 && r.y < 700) console.log(`RECT x=${r.x.toFixed(1)} y=${r.y.toFixed(1)} w=${r.w.toFixed(1)} h=${r.h.toFixed(1)}`);
    } else if (r.kind === 'line') {
      const yMin = Math.min(...r.y), yMax = Math.max(...r.y);
      if (yMax > 200 && yMax < 700) {
        console.log(`LINE x=${Math.min(...r.x).toFixed(1)}..${Math.max(...r.x).toFixed(1)} y=${yMin.toFixed(1)}..${yMax.toFixed(1)}${r.lw ? ' lw=' + r.lw : ''}`);
      }
    }
  }
  console.log('page6 H =', H);
  await doc.destroy();
})().catch(e => { console.error('FAIL', e); process.exit(1); });