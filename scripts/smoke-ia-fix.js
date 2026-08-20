// Smoke test for IA alignment fixes v1.6.2
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== IA Alignment Fix Smoke Test (v1.6.2) ===\n');
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const downloads = [];
  page.on('download', async (download) => {
    const dir = path.join(__dirname, '..', 'test-smoke');
    fs.mkdirSync(dir, { recursive: true });
    const fp = path.join(dir, download.suggestedFilename());
    await download.saveAs(fp);
    downloads.push({ filename: download.suggestedFilename(), path: fp });
  });
  
  let failures = 0;
  
  try {
    // 1. Load app
    await page.goto('http://localhost:3457/');
    await page.waitForLoadState('networkidle');
    const title = await page.title();
    console.log(`1. App loaded: ${title}`);
    if (title !== 'Sales Appointment Capture') { console.log('   FAIL: wrong title'); failures++; }
    
    // 2. Load test data
    page.once('dialog', d => d.accept());
    await page.click('button:has-text("Load Test Data")');
    await page.waitForTimeout(800);
    
    // Set specific test values
    await page.fill('#client2Name', 'Jenny Smith');
    await page.fill('#iaSolicitor', 'B.O.S.S Conveyancing');
    await page.fill('#iaAmount', '$10,000');
    
    const client1 = await page.inputValue('#clientName');
    const client2 = await page.inputValue('#client2Name');
    const solicitor = await page.inputValue('#iaSolicitor');
    console.log(`2. Test data: Client 1="${client1}", Client 2="${client2}", Solicitor="${solicitor}"`);
    
    // Inject ID images (needed for PDF generation)
    await page.evaluate(async () => {
      const colors = ['#3366cc','#339933'];
      const labels = ['Client 1 - ID Front','Client 1 - ID Back'];
      const st = window._testState, photos = st.getPhotos();
      for (let i = 0; i < 2; i++) {
        const c = document.createElement('canvas'); c.width = 400; c.height = 300;
        const ctx = c.getContext('2d');
        ctx.fillStyle = colors[i]; ctx.fillRect(0, 0, c.width, c.height);
        ctx.fillStyle = '#fff'; ctx.font = '24px Arial'; ctx.textAlign = 'center';
        ctx.fillText(labels[i], c.width/2, c.height/2);
        st.setPhotoImg(i, c);
        photos[i].name = labels[i] + '.jpg';
        photos[i].dataURL = c.toDataURL();
      }
    });
    console.log('3. ID images injected');
    
    // Navigate preview to IA page (page 2 — EOI is page 0, IA is page 1)
    // First generate to make sure preview is current
    await page.click('#generateBottom');
    await page.waitForTimeout(3000);
    
    const status = await page.textContent('#status');
    console.log(`4. PDF generated. Status: ${status}`);
    
    if (!status.includes('PDF ready')) { console.log('   FAIL: PDF not ready'); failures++; }
    
    // Navigate preview to IA page
    // EOI has 1 page, IA is page 2 (1-indexed) or page 1 (0-indexed)
    // Click "Next" in preview to advance to IA page
    const previewLabel = await page.textContent('#previewPageLabel');
    console.log(`   Preview: ${previewLabel}`);
    
    // Advance to page 2 (IA page)
    await page.click('#previewNext');
    await page.waitForTimeout(500);
    const previewLabel2 = await page.textContent('#previewPageLabel');
    console.log(`   Preview after Next: ${previewLabel2}`);
    
    // Take screenshot of the IA page preview
    const screenshotDir = path.join(__dirname, '..', 'test-smoke');
    fs.mkdirSync(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'ia-preview.png'), fullPage: false });
    console.log('5. IA page preview screenshot saved to test-smoke/ia-preview.png');
    
    // 6. Download PDF
    downloads.length = 0;
    await page.click('#downloadBottom');
    await page.waitForTimeout(1000);
    const pdfDl = downloads.find(d => d.filename.endsWith('.pdf'));
    console.log(`6. Download PDF: ${pdfDl ? pdfDl.filename + ' (' + fs.statSync(pdfDl.path).size + ' bytes)' : 'FAIL'}`);
    if (!pdfDl) failures++;
    
    // 7. Download Package
    downloads.length = 0;
    await page.click('#downloadPackageBottom');
    await page.waitForTimeout(5000);
    const zipDl = downloads.find(d => d.filename.endsWith('.zip'));
    console.log(`7. Download Package: ${zipDl ? zipDl.filename + ' (' + fs.statSync(zipDl.path).size + ' bytes)' : 'FAIL'}`);
    if (!zipDl) failures++;
    
    // Verify ZIP contents include IA
    if (zipDl) {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(fs.readFileSync(zipDl.path));
      const files = Object.keys(zip.files).filter(f => !zip.files[f].dir);
      const iaFile = files.find(f => /^IA\b/i.test(f));
      console.log(`   ZIP IA file: ${iaFile || 'MISSING'}`);
      if (!iaFile) failures++;
    }
    
    // 8. Check page title in PDF filename
    const fileName = await page.textContent('#fileNamePreview');
    console.log(`8. PDF filename: ${fileName}`);
    
    // 9. Version check
    const versionEl = await page.$('[data-app-version-label]');
    const version = await page.evaluate(el => el.textContent, versionEl);
    console.log(`9. Displayed version: ${version}`);
    if (!version.includes('1.6.2')) { console.log('   FAIL: wrong version displayed'); failures++; }
    
  } catch (err) {
    console.error('Smoke test error:', err.message);
    failures++;
  } finally {
    await browser.close();
  }
  
  console.log(`\n=== Smoke Test Complete: ${failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'} ===`);
  process.exit(failures > 0 ? 1 : 0);
})();
