const PDFLib = require('C:/dev/Irrevoccable Authority CHECKLIST/lib/pdf-lib.min.js');
const fs = require('fs');
const path = require('path');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.mjs');
const root = 'C:/dev/Irrevoccable Authority CHECKLIST';

function latin1FromBytes(bytes){ let s=''; for(let i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]); return s; }
function bytesFromLatin1(s){ const b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i)&0xff; return b; }
function isWaiverFooterContentBlock(block){
  let x=0,y=0;
  for(const m of block.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(Td|TD|Tm)\b/g)){
    const vx=parseFloat(m[1]),vy=parseFloat(m[2]),op=m[3];
    if(op==='Tm'){x=vx;y=vy;}
    else if(op==='TD'){y-=vy;x+=vx;}
    else{x+=vx;y+=vy;}
    if(y>=27&&y<=41&&x>-5&&x<600) return true;
  }
  return false;
}
async function sanitizeWaiverPage(page, pdfDoc, pdfLib){
  try{
    const stream = await page.node.Contents();
    if(!stream || typeof stream.getContents !== 'function' || !stream.dict) return 'SKIP';
    const rawBytes = stream.getContents();
    if(!rawBytes || rawBytes.length===0) return 'EMPTY';
    const decoder = pdfLib.decodePDFRawStream({ dict: stream.dict, contents: rawBytes });
    const decoded = latin1FromBytes(new Uint8Array(decoder.decode()));
    const blocks=[];
    let pos=0;
    while(true){
      const bt=decoded.indexOf('BT',pos);
      if(bt<0) break;
      const et=decoded.indexOf('ET',bt+2);
      if(et<0) break;
      const btStart=decoded.lastIndexOf('\n',bt)+1;
      const etEnd=decoded.indexOf('\n',et);
      blocks.push({btStart, etEnd:etEnd<0?decoded.length:etEnd, block:decoded.slice(bt,et+2)});
      pos=et+2;
    }
    const footerBlocks=blocks.filter(b=>isWaiverFooterContentBlock(b.block));
    let edited=decoded;
    for(const block of [...footerBlocks].sort((a,b)=>b.btStart-a.btStart)){
      edited=edited.slice(0,block.btStart)+edited.slice(block.etEnd+1);
    }
    if(edited===decoded) return 'NO_CHANGE blocks=' + blocks.length;
    const contentDict=stream.dict.clone(pdfDoc.context);
    contentDict.delete(pdfLib.PDFName.of('Filter'));
    contentDict.delete(pdfLib.PDFName.of('Length'));
    const newStream=pdfLib.PDFRawStream.of(contentDict, bytesFromLatin1(edited));
    page.node.set(pdfLib.PDFName.of('Contents'), pdfDoc.context.register(newStream));
    return 'OK removed=' + footerBlocks.length;
  }catch(err){ return 'ERR ' + err.message; }
}

(async () => {
  const { PDFDocument, StandardFonts } = PDFLib;
  const sourceBytes = fs.readFileSync(path.join(root, 'templates/ASG-Disclosure-Waiver-2026.pdf'));
  const pdfDoc = await PDFDocument.load(sourceBytes);
  const pages = pdfDoc.getPages();
  for(let i=0;i<pages.length;i++){
    console.log('page', i+1, await sanitizeWaiverPage(pages[i], pdfDoc, PDFLib));
  }
  const hb = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const h = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pages[5].drawText('John Smith', { x: 121, y: 604.8, size: 10.5, font: hb, color: PDFLib.rgb(0,0,0) });
  pages[5].drawText('25/08/2026', { x: 78, y: 480.6, size: 10.5, font: hb, color: PDFLib.rgb(0,0,0) });
  const bytes = await pdfDoc.save({ useObjectStreams: true });
  fs.writeFileSync(path.join(root, 'tmp/waiver-verify/generated-vector.pdf'), Buffer.from(bytes));

  const sfDir = path.join(root, 'node_modules/pdfjs-dist/standard_fonts/');
  const doc = await getDocument({ data: new Uint8Array(bytes), standardFontDataUrl: 'file://' + encodeURI(sfDir.replace(/\\/g, '/')) }).promise;
  const page = await doc.getPage(6);
  const tc = await page.getTextContent();
  const text = tc.items.map(i => i.str).join(' ');
  console.log('p6 extracted:', JSON.stringify(text.slice(-160)));
  console.log('hasJohnSmith:', text.includes('John Smith'), 'hasDate:', text.includes('25/08/2026'), 'hasDraft:', /Updated draft/i.test(text));
  await doc.destroy();
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
