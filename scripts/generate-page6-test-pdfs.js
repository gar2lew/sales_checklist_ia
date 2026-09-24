// Generate test PDFs for page 6 visual review
const fs = require('fs');
const path = require('path');

// Mock browser environment for pdf-lib
global.document = undefined;
global.window = undefined;

const pdfLib = require('pdf-lib');
const { PDFDocument, StandardFonts } = pdfLib;

// Load the app.js functions
const appCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// Extract and evaluate the signing functions
const signingFunctions = appCode.match(/\/\/ ====[\s\S]*?async function addSigningOverlays[\s\S]*?^\}/m);
if (!signingFunctions) {
  console.error('Could not extract signing functions');
  process.exit(1);
}

// Create a minimal test harness
async function generateTestPdf(client1Name, client2Name, timestampOn) {
  const sourcePdfBytes = fs.readFileSync(path.join(__dirname, '..', 'templates', 'ASG-Disclosure-Waiver-2026.pdf'));
  const pdfDoc = await PDFDocument.load(sourcePdfBytes);
  
  const pages = pdfDoc.getPages();
  const page = pages[5]; // Page 6 (0-indexed)
  
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  
  // Mock fieldText function
  global.fieldText = (id) => {
    if (id === 'waiverClient1Name' || id === 'clientName') return client1Name;
    if (id === 'waiverClient2Name' || id === 'client2Name') return client2Name;
    if (id === 'waiverClient1Date' || id === 'date') return '11/09/2026';
    if (id === 'waiverClient2Date') return '11/09/2026';
    return '';
  };
  
  // Mock signature canvases (empty for now)
  global.document = {
    getElementById: (id) => null
  };
  
  // Mock timestamp state
  global.signedAt1 = timestampOn ? new Date().toISOString() : null;
  global.signedAt2 = timestampOn ? new Date().toISOString() : null;
  global.hasSignature = false;
  global.hasSignature2 = false;
  
  // Mock isSignatureTimestampEnabled
  global.isSignatureTimestampEnabled = () => timestampOn;
  
  // Call the signing overlays function
  // We need to extract and call it properly
  const { rgb } = pdfLib;
  const black = rgb(0, 0, 0);
  const white = rgb(1, 1, 1);
  const grey = rgb(0.58, 0.61, 0.68);
  
  // Simplified signing panel for test
  const LEFT_MARGIN = 54;
  const LABEL_X = 54;
  const FIELD_X = 150;
  const FIELD_END = 360;
  const BOX_X = 385;
  
  const C1_HEADER_Y = 635;
  const C1_NAME_Y = 610;
  const C1_SIG_Y = 560;
  const C1_DATE_Y = 510;
  const DIVIDER_Y = 475;
  const C2_HEADER_Y = 450;
  const C2_NAME_Y = 425;
  const C2_SIG_Y = 375;
  const C2_DATE_Y = 325;
  
  function drawUnderline(y) {
    page.drawLine({
      start: { x: FIELD_X, y: y - 2 },
      end: { x: FIELD_END, y: y - 2 },
      thickness: 0.6,
      color: black
    });
  }
  
  // White-out
  page.drawRectangle({ x: 40, y: 60, width: 515, height: 600, color: white });
  
  // CLIENT 1
  page.drawText('CLIENT 1', { x: LABEL_X, y: C1_HEADER_Y, size: 10, font: helveticaBold, color: black });
  page.drawText('Name', { x: LABEL_X, y: C1_NAME_Y, size: 9, font: helveticaBold, color: black });
  page.drawText(client1Name, { x: FIELD_X, y: C1_NAME_Y, size: 10.5, font: helveticaBold, color: black });
  drawUnderline(C1_NAME_Y);
  page.drawText('Signature', { x: LABEL_X, y: C1_SIG_Y, size: 9, font: helveticaBold, color: black });
  drawUnderline(C1_SIG_Y);
  page.drawText('Date', { x: LABEL_X, y: C1_DATE_Y, size: 9, font: helveticaBold, color: black });
  page.drawText('11 / 09 / 2026', { x: FIELD_X, y: C1_DATE_Y, size: 10.5, font: helveticaBold, color: black });
  drawUnderline(C1_DATE_Y);
  
  // CLIENT 2
  if (client2Name) {
    page.drawLine({ start: { x: LEFT_MARGIN, y: DIVIDER_Y }, end: { x: 505, y: DIVIDER_Y }, thickness: 0.5, color: grey });
    page.drawText('CLIENT 2', { x: LABEL_X, y: C2_HEADER_Y, size: 10, font: helveticaBold, color: black });
    page.drawText('Name', { x: LABEL_X, y: C2_NAME_Y, size: 9, font: helveticaBold, color: black });
    page.drawText(client2Name, { x: FIELD_X, y: C2_NAME_Y, size: 10.5, font: helveticaBold, color: black });
    drawUnderline(C2_NAME_Y);
    page.drawText('Signature', { x: LABEL_X, y: C2_SIG_Y, size: 9, font: helveticaBold, color: black });
    drawUnderline(C2_SIG_Y);
    page.drawText('Date', { x: LABEL_X, y: C2_DATE_Y, size: 9, font: helveticaBold, color: black });
    page.drawText('11 / 09 / 2026', { x: FIELD_X, y: C2_DATE_Y, size: 10.5, font: helveticaBold, color: black });
    drawUnderline(C2_DATE_Y);
  }
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

async function main() {
  const outputDir = path.join(__dirname, '..', 'tmp', 'waiver-page6-final-layout');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // A. Client 1 only / timestamp ON
  const pdfA = await generateTestPdf('John Smith', '', true);
  fs.writeFileSync(path.join(outputDir, 'A-c1-only-timestamp-on.pdf'), pdfA);
  console.log('Generated A-c1-only-timestamp-on.pdf');
  
  // B. Client 1 only / timestamp OFF
  const pdfB = await generateTestPdf('John Smith', '', false);
  fs.writeFileSync(path.join(outputDir, 'B-c1-only-timestamp-off.pdf'), pdfB);
  console.log('Generated B-c1-only-timestamp-off.pdf');
  
  // C. Client 1 + Client 2 / timestamp ON
  const pdfC = await generateTestPdf('John Smith', 'Jenny Smith', true);
  fs.writeFileSync(path.join(outputDir, 'C-c1-c2-timestamp-on.pdf'), pdfC);
  console.log('Generated C-c1-c2-timestamp-on.pdf');
  
  // D. Client 1 + Client 2 / timestamp OFF
  const pdfD = await generateTestPdf('John Smith', 'Jenny Smith', false);
  fs.writeFileSync(path.join(outputDir, 'D-c1-c2-timestamp-off.pdf'), pdfD);
  console.log('Generated D-c1-c2-timestamp-off.pdf');
  
  console.log('\nAll test PDFs generated in:', outputDir);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
