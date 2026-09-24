const { PDFDocument, decodePDFRawStream } = require('pdf-lib');
const fs = require('fs');

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf'), { updateMetadata: false });
  const page = pdf.getPage(5);
  const stream = await page.node.Contents();
  const decoder = decodePDFRawStream({ dict: stream.dict, contents: stream.getContents() });
  const decoded = Buffer.from(decoder.decode().buffer || decoder.decode());
  const text = decoded.toString('latin1');
  fs.writeFileSync('tmp/waiver-verify/p6.content.stream.txt', text);
  console.log('decoded length:', text.length);
  const idx = text.indexOf('Updated draft');
  console.log('footer idx:', idx);
  if (idx >= 0) {
    console.log(text.slice(Math.max(0, idx - 1200), idx + 600).replace(/\n/g, '\\n'));
  }
})().catch((e) => { console.error(e.stack); process.exit(1); });