const { PDFDocument, decodePDFRawStream } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf'), { updateMetadata: false });
  const page = pdf.getPage(0);
  const stream = await page.node.Contents();
  const decoder = decodePDFRawStream({ dict: stream.dict, contents: stream.getContents() });
  const decoded = Buffer.from(decoder.decode()).toString('latin1');
  const idx = decoded.indexOf('Td\n') >= 0 ? decoded : decoded;
  let i = 0;
  // print all Td/Tj/TJ lines near footer band (pdf y <= 40)
  for (const line of decoded.split('\n')) {
    if (/\d+\.\d+ Td$/i.test(line.trim())) {
      const y = parseFloat(line.trim().split(' ')[1]);
      if (y <= 40) console.log('FOOTER?:', line.trim());
    }
  }
  // dump the last ~3000 chars raw with line numbers so we can see BT/ET structure
  const tail = decoded.slice(-3500);
  const lines = tail.split('\n');
  console.log('--- tail lines (annotated) ---');
  lines.forEach((l, n) => {
    const t = l.trim();
    if (!t) return;
    if (/^(BT|ET|Tf|Td|Tj|TJ|q|Q|W\*|n|re|EMC|BDC|T\*|Tc|cm|Do)\b/.test(t) || t.endsWith('TJ') || t.endsWith('Tj')) {
      console.log(t.length > 110 ? t.slice(0, 107) + '...[glyphs]' : t);
    }
  });
})().catch((e) => { console.error(e.stack); process.exit(1); });