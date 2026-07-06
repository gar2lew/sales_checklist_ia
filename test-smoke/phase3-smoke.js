const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  res.setHeader('Cache-Control', 'no-store');
  res.writeHead(200, { 'Content-Type': contentType });
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end(''); return; }
    res.end(data);
  });
});

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;
  console.log('Test server on', baseUrl);

  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  \u2705 ' + name); }
    else { fail++; console.log('  \u274C ' + name + (detail ? ': ' + detail : '')); }
  }

  async function pdfGenerated(page) {
    const s = await page.evaluate(() => document.getElementById('status').textContent);
    return s.indexOf('PDF ready') >= 0 || s.indexOf('ready') >= 0;
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // =========================================================================
    // TEST 1: In-person unchanged
    // =========================================================================
    console.log('\n--- 1. In-person workflow unchanged ---');
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.fill('#landingStaff', 'InPerson Tester');
    await page.waitForTimeout(100);
    await page.click('#landingContinue');
    await page.waitForTimeout(300);

    check('In-person: landing hidden',
      await page.evaluate(() => document.getElementById('landingScreen').classList.contains('hidden')));
    check('In-person: show-in-person class',
      await page.evaluate(() => document.querySelector('.app').className.indexOf('show-in-person') >= 0));

    await page.fill('#clientName', 'John Smith');
    await page.fill('#date', '01/01/2026');
    await page.evaluate(() => document.getElementById('includeEOI').checked = true);
    await page.fill('#propertySaleAddress', '123 Test St');
    await page.waitForTimeout(200);
    await page.evaluate(() => document.getElementById('generateTop').click());
    await page.waitForTimeout(2000);

    check('In-person: PDF generated', await pdfGenerated(page));
    const ipStatus = await page.evaluate(() => document.getElementById('status').textContent);
    check('In-person: filename correct', ipStatus.indexOf('Sales Appointment') >= 0);

    // =========================================================================
    // TEST 2: Zoom compiled booklet
    // =========================================================================
    console.log('\n--- 2. Zoom compiled booklet ---');
    const page2 = await context.newPage();
    await page2.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page2.waitForTimeout(1000);
    await page2.fill('#landingStaff', 'Zoom Tester');
    await page2.waitForTimeout(100);
    await page2.evaluate(() => {
      document.querySelectorAll('.mode-btn')[1].classList.add('active');
      document.querySelectorAll('.mode-btn')[0].classList.remove('active');
    });
    await page2.click('#landingContinue');
    await page2.waitForTimeout(300);

    check('Zoom: landing hidden',
      await page2.evaluate(() => document.getElementById('landingScreen').classList.contains('hidden')));
    check('Zoom: show-zoom class',
      await page2.evaluate(() => document.querySelector('.app').className.indexOf('show-zoom') >= 0));

    await page2.fill('#clientName', 'Jane Smith');
    await page2.fill('#date', '15/06/2026');
    await page2.fill('#firstConsultNotes', 'Investment property');
    await page2.fill('#clientReviewStrategy', 'Buy and hold');
    await page2.selectOption('#clientReviewBuilder', 'Metricon');
    await page2.fill('#clientReviewProperty', '123 Growth St');
    await page2.selectOption('#clientReviewTimeline', '3-6 months');
    await page2.evaluate(() => {
      document.getElementById('zoomIncludeStandardEOI').checked = true;
      document.getElementById('zoomIncludeIA').checked = true;
    });
    await page2.waitForTimeout(200);
    await page2.evaluate(() => document.getElementById('generateTop').click());
    await page2.waitForTimeout(3000);

    check('Zoom: PDF generated', await pdfGenerated(page2));
    const zStatus = await page2.evaluate(() => document.getElementById('status').textContent);
    check('Zoom: filename has Zoom', zStatus.indexOf('Zoom') >= 0);

    // Plan via testState
    const planInfo = await page2.evaluate(() => {
      try {
        const p = window._testState.getZoomOutputPlan();
        return p ? { totalPages: p.totalPages, groupsLen: p.groups.length } : null;
      } catch(e) { return null; }
    });
    check('Zoom: plan has pages', planInfo && planInfo.totalPages > 0);
    check('Zoom: plan has >= 3 groups', planInfo && planInfo.groupsLen >= 3);
    check('Zoom: plan totalPages = 5', planInfo && planInfo.totalPages === 5);

    // =========================================================================
    // TEST 3: Zoom preview
    // =========================================================================
    console.log('\n--- 3. Zoom preview ---');
    await page2.evaluate(() => document.getElementById('previewTop').click());
    await page2.waitForTimeout(1500);

    check('Zoom: preview canvas',
      await page2.evaluate(() => {
        const paper = document.getElementById('previewPaper');
        return paper && paper.querySelector('canvas') !== null;
      }));

    // =========================================================================
    // TEST 4: Individual PDFs
    // =========================================================================
    console.log('\n--- 4. Individual PDFs ---');
    const pdfNames = await page2.evaluate(async () => {
      try {
        const result = await window._testState.buildIndividualPdfs();
        return result.map(p => p.name);
      } catch(e) { return null; }
    });
    check('Zoom: individual PDFs created', Array.isArray(pdfNames) && pdfNames.length > 0);

    if (Array.isArray(pdfNames)) {
      check('ZIP: First Consultation', pdfNames.some(n => n.indexOf('First Consultation') >= 0));
      check('ZIP: Client Review', pdfNames.some(n => n.indexOf('Client Review') >= 0));
      check('ZIP: EOI', pdfNames.some(n => n.indexOf('EOI') >= 0));
      check('ZIP: IA', pdfNames.some(n => n.indexOf('IA') >= 0));
      check('ZIP: 5 documents', pdfNames.length === 5);
    }

    // =========================================================================
    // TEST 5: ZIP
    // =========================================================================
    console.log('\n--- 5. ZIP ---');
    const zipResult = await page2.evaluate(async () => {
      try {
        const pdfs = await window._testState.buildIndividualPdfs();
        if (!pdfs || pdfs.length === 0) return null;
        const name = 'Zoom-Appointment-Documents.zip';
        const blob = await window._testState.buildZip(pdfs, name);
        return { size: blob.size };
      } catch(e) { return null; }
    });
    check('Zoom: ZIP blob', zipResult && zipResult.size > 0);
    check('Zoom: ZIP > 10KB', zipResult && zipResult.size > 10000);

    // =========================================================================
    // TEST 6: EOI only
    // =========================================================================
    console.log('\n--- 6. Zoom EOI only ---');
    await page2.evaluate(() => {
      document.getElementById('zoomIncludeStandardEOI').checked = true;
      document.getElementById('zoomIncludeLaVidaEOI').checked = false;
      document.getElementById('zoomIncludeIA').checked = false;
    });
    await page2.waitForTimeout(100);
    await page2.evaluate(() => document.getElementById('generateTop').click());
    await page2.waitForTimeout(2000);

    check('Zoom EOI only: PDF generated', await pdfGenerated(page2));
    const eoiPlan = await page2.evaluate(() => {
      try { return window._testState.getZoomOutputPlan().totalPages; } catch(e) { return -1; }
    });
    check('Zoom EOI only: 4 pages', eoiPlan === 4);

    // =========================================================================
    // TEST 7: IA only
    // =========================================================================
    console.log('\n--- 7. Zoom IA only ---');
    await page2.evaluate(() => {
      document.getElementById('zoomIncludeStandardEOI').checked = false;
      document.getElementById('zoomIncludeIA').checked = true;
    });
    await page2.waitForTimeout(100);
    await page2.evaluate(() => document.getElementById('generateTop').click());
    await page2.waitForTimeout(2000);

    check('Zoom IA only: PDF generated', await pdfGenerated(page2));
    const iaPlan = await page2.evaluate(() => {
      try { return window._testState.getZoomOutputPlan().totalPages; } catch(e) { return -1; }
    });
    check('Zoom IA only: 4 pages', iaPlan === 4);

    // =========================================================================
    // TEST 8: All outputs
    // =========================================================================
    console.log('\n--- 8. Zoom all outputs ---');
    await page2.evaluate(() => {
      document.getElementById('zoomIncludeStandardEOI').checked = true;
      document.getElementById('zoomIncludeLaVidaEOI').checked = true;
      document.getElementById('zoomIncludeIA').checked = true;
    });
    await page2.waitForTimeout(100);

    const allPlan = await page2.evaluate(() => {
      try { return window._testState.getZoomOutputPlan().totalPages; } catch(e) { return -1; }
    });
    check('Zoom all: 7 pages', allPlan === 7);

    // =========================================================================
    // TEST 9: Draft save/load
    // =========================================================================
    console.log('\n--- 9. Draft save/load ---');
    await page2.evaluate(() => document.getElementById('saveDraft').click());
    await page2.waitForTimeout(300);

    const draft = await page2.evaluate(() => {
      const raw = localStorage.getItem('salesAppointmentDraft');
      return raw ? JSON.parse(raw) : null;
    });
    check('Draft saved', !!draft);
    check('Draft: zoom fields', draft && draft.firstConsultNotes === 'Investment property');
    check('Draft: appointmentMode zoom', draft && draft.appointmentMode === 'zoom');

    const page3 = await context.newPage();
    await page3.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page3.waitForTimeout(1000);
    await page3.fill('#landingStaff', 'Loader');
    await page3.waitForTimeout(100);
    await page3.click('#landingContinue');
    await page3.waitForTimeout(300);
    await page3.evaluate(() => document.getElementById('loadDraft').click());
    await page3.waitForTimeout(1000);

    const loaded = await page3.evaluate(() => {
      return {
        zoom: document.querySelector('.app').className.indexOf('show-zoom') >= 0,
        notes: document.getElementById('firstConsultNotes').value,
        strategy: document.getElementById('clientReviewStrategy').value
      };
    });
    check('Draft: zoom mode restored', loaded.zoom);
    check('Draft: notes restored', loaded.notes === 'Investment property');
    check('Draft: strategy restored', loaded.strategy === 'Buy and hold');

    // =========================================================================
    // TEST 10: Legacy draft
    // =========================================================================
    console.log('\n--- 10. Legacy draft ---');
    await page3.evaluate(() => {
      localStorage.setItem('salesAppointmentDraft', JSON.stringify({
        teamMember: 'Legacy', clientName: 'Old', date: '01/01/2026'
      }));
    });
    await page3.evaluate(() => document.getElementById('loadDraft').click());
    await page3.waitForTimeout(500);

    const legacy = await page3.evaluate(() => {
      return {
        inPerson: document.querySelector('.app').className.indexOf('show-in-person') >= 0,
        tm: document.getElementById('teamMember').value
      };
    });
    check('Legacy: show-in-person', legacy.inPerson);
    check('Legacy: teamMember', legacy.tm === 'Legacy');

    // =========================================================================
    // TEST 11: Version
    // =========================================================================
    console.log('\n--- 11. Version check ---');
    const ver = await page.evaluate(() => {
      const labels = document.querySelectorAll('[data-app-version-label]');
      return Array.from(labels).map(el => el.textContent);
    });
    check('Version 2.2.0-alpha.1', ver[0] === 'Version 2.2.0-alpha.1');

    // Summary
    console.log('\n===========================');
    console.log('Phase 3 smoke test: ' + (pass + fail) + ' total, ' + pass + ' passed, ' + fail + ' failed');
    console.log('===========================');

    await browser.close();
  } finally {
    server.close();
    process.exit(fail > 0 ? 1 : 0);
  }
});
