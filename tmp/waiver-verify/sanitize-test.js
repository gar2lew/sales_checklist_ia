const { PDFDocument, decodePDFRawStream, PDFRawStream, PDFName } = require('pdf-lib');
const fs = require('fs');

function tokenizeBlocks(decoded) {
  const blocks = [];
  let pos = 0;
  while (true) {
    const bt = decoded.indexOf('BT', pos);
    if (bt < 0) break;
    const etIn = decoded.indexOf('ET', bt + 2);
    const et = decoded.indexOf('ET', etIn);
    if (et < 0) break;
    const btStart = decoded.lastIndexOf('\n', bt) + 1;
    const etEnd = decoded.indexOf('\n', et);
    const block = decoded.slice(bt, et + 2);
    blocks.push({ btStart, btEnd: et + 2, etEnd, block });
    pos = et + 2;
  }
  return blocks;
}

function isFooterBlock(block) {
  let x = 0, y = 0;
  for (const m of block.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(Td|TD|Tm)\b/g)) {
    const vx = parseFloat(m[1]), vy = parseFloat(m[2]), op = m[3];
    if (op === 'Tm') { x = vx; y = vy; }
    else if (op === 'TD') { y -= vy; x += vx; }
    else { x += vx; y += vy; }
    if (y >= 27 && y <= 41 && x > -5 && x < 600) return true;
  }
  return false;
}

function sanitizeDecoded(decoded) {
  const blocks = tokenizeBlocks(decoded);
  const footerBlocks = blocks.filter((b) => isFooterBlock(b.block));
  let out = decoded;
  for (const b of [...footerBlocks].sort((a, c) => c.btStart - a.btStart)) {
    out = out.slice(0, b.btStart) + out.slice(b.etEnd + 1);
  }
  return { out, total: blocks.length, removed: footerBlocks.length };
}

(async () => {
  const pdf = await PDFDocument.load(fs.readFileSync('templates/ASG-Disclosure-Waiver-2026.pdf'), { updateMetadata: false });
  const out = await PDFDocument.create();
  const results = [];
  for (let i = 0; i < 6; i++) {
    const page = pdf.getPage(i);
    const stream = await page.node.Contents();
    if (!stream || stream.constructor.name !== 'PDFRawStream') {
      console.log(`page ${i + 1}: unexpected stream ${stream && stream.constructor.name}`);
      continue;
    }
    const decoder = decodePDFRawStream({ dict: stream.dict, contents: stream.getContents() });
    const decodedBuf = Buffer.from(decoder.decode());
    const decoded = decodedBuf.toString('latin1');
    const { out: edited, total, removed } = sanitizeDecoded(decoded);
    const contentDict = stream.dict.clone(pdf.context);
    contentDict.delete(PDFName.of('Filter'));
    contentDict.delete(PDFName.of('Length'));
    const newStream = PDFRawStream.of(contentDict, new Uint8Array(Buffer.from(edited, 'latin1')));
    page.node.set(PDFName.of('Contents'), pdf.context.register(newStream));
    results.push({ page: i + 1, streamLen: decoded.length, editedLen: edited.length, totalBlocks: total, removed });
  }
  const pages = await out.copyPages(pdf, [0, 1, 2, 3, 4, 5]);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  fs.writeFileSync('tmp/waiver-verify/sanitized.pdf', bytes);
  console.log(JSON.stringify(results, null, 2));
  console.log('sanitized.pdf written');
})().catch((e) => { console.error(e.stack); process.exit(1); });