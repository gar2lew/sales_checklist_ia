const { PDFDocument } = require('pdf-lib');
const fs = require('fs');

async function main() {
  const bytes = fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf');
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const pgIdx of [0, 5]) {
    const page = pdf.getPage(pgIdx);
    const contents = page.node.get('Contents');
    console.log(`\n===== PAGE ${pgIdx + 1} Contents node type =====`, contents?.constructor.name);
    const arr = contents && contents.constructor.name === 'PDFArray' ? contents.asArray() : [contents];
    for (const item of arr) {
      const stream = pdf.context.lookup(item);
      console.log('stream type:', stream?.constructor.name, 'rawLen:', stream?.getRawContents?.()?.length, 'decodedLen:', stream?.getContents?.()?.length);
      const decoded = stream ? Buffer.from(stream.getContents()).toString('latin1') : '';
      console.log('decoded head:', decoded.slice(0, 200).replace(/\n/g, '\\n'));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });