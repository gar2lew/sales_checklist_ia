const PDFLib = require('C:\\dev\\Irrevoccable Authority CHECKLIST\\lib\\pdf-lib.min.js');
const fs = require('fs');
(async () => {
  const { PDFDocument, decodePDFRawStream, PDFRawStream, PDFName } = PDFLib;
  const sourceBytes = fs.readFileSync('C:\\dev\\Irrevoccable Authority CHECKLIST\\templates\\ASG-Disclosure-Waiver-2026.pdf');
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  for(let i = 0; i < pages.length; i++){
    const page = pages[i];
    const stream = await page.node.Contents();
    const ctorName = stream && stream.constructor && stream.constructor.name;
    const hasGetContents = typeof stream.getContents === 'function';
    const hasDict = !!stream.dict;
    console.log('page', i+1, 'ctor:', ctorName, 'hasGetContents:', hasGetContents, 'hasDict:', hasDict);
    if(hasGetContents && hasDict){
      try {
        const raw = stream.getContents();
        const dec = decodePDFRawStream({dict: stream.dict, contents: raw});
        const decoded = Buffer.from(dec.decode());
        const latin1 = decoded.toString('latin1');
        const hasDraft = latin1.includes('Updated draft');
        console.log('  raw len:', raw.length, 'decoded len:', decoded.length, 'hasDraft:', hasDraft);
      } catch(e){
        console.log('  ERROR:', e.message);
      }
    }
  }
})().catch(e => { console.error('ERR', e.stack); process.exit(1); });
