/**
 * Phase 3 QA Hardening — Comprehensive stress test for Zoom document engine.
 * v2 - fixes: longer timeouts, dispatch events on programmatic changes, clear cache between tests.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  res.setHeader('Cache-Control','no-store');
  res.writeHead(200,{'Content-Type': MIME[ext] || 'application/octet-stream'});
  fs.readFile(filePath,(err,data)=>{if(err){res.writeHead(404);res.end('');return;}res.end(data);});
});

server.listen(0, async () => {
  const port = server.address().port;
  const baseUrl = 'http://localhost:' + port;
  console.log('=== Phase 3 QA Stress Test ===\n');

  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  \u2705 ' + name); }
    else { fail++; console.log('  \u274C ' + name + (detail ? ': ' + detail : '')); }
  }

  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext();

  async function enterZoom(page, staffName) {
    await page.fill('#landingStaff', staffName);
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      document.querySelectorAll('.mode-btn')[1].classList.add('active');
      document.querySelectorAll('.mode-btn')[0].classList.remove('active');
    });
    await page.click('#landingContinue');
    await page.waitForTimeout(300);
  }

  // Click generate and wait for completion
  async function generatePdf(page, timeoutMs) {
    timeoutMs = timeoutMs || 4000;
    await page.evaluate(() => document.getElementById('generateTop').click());
    // Poll for completion
    for (let i = 0; i < timeoutMs / 500; i++) {
      await page.waitForTimeout(500);
      const s = await page.evaluate(() => document.getElementById('status').textContent);
      if (s.indexOf('PDF ready') >= 0) return true;
      if (s.indexOf('failed') >= 0) return false;
    }
    return false; // timeout
  }

  // Clear cached PDFs so buildIndividualPdfs is forced to regenerate
  async function clearPdfCache(page) {
    await page.evaluate(() => {
      if (typeof clearGenerated === 'function') clearGenerated();
      lastIndividualPdfs = null;
      lastZipBlob = null;
    });
    // Force clearGenerated via page events
    await page.evaluate(() => {
      // Trigger a field event to clear generated state
      const el = document.getElementById('clientName');
      if (el) {
        el.dispatchEvent(new Event('input', {bubbles: true}));
      }
    });
    await page.waitForTimeout(100);
  }

  async function getPlanInfo(page) {
    return await page.evaluate(() => {
      try { const p = window._testState.getZoomOutputPlan(); return p ? { pages: p.pages.length, groups: p.groups.length, total: p.totalPages } : null; }
      catch(e) { return null; }
    });
  }

  async function getIndividualNames(page) {
    return await page.evaluate(async () => {
      try {
        const result = await window._testState.buildIndividualPdfs();
        return result.map(p => p.name);
      } catch(e) { return null; }
    });
  }

  async function getZipSize(page) {
    return await page.evaluate(async () => {
      try {
        const pdfs = await window._testState.buildIndividualPdfs();
        if (!pdfs || pdfs.length === 0) return 0;
        const blob = await window._testState.buildZip(pdfs, 'test.zip');
        return blob.size;
      } catch(e) { return -1; }
    });
  }

  // Helper: check checkboxes with event dispatch to trigger clearGenerated
  async function setCheckboxes(page, config) {
    await page.evaluate(function(cfg) {
      if (cfg.stdEOI !== undefined) {
        var el = document.getElementById('zoomIncludeStandardEOI');
        if (el) { el.checked = cfg.stdEOI; el.dispatchEvent(new Event('change', {bubbles:true})); }
      }
      if (cfg.laVidaEOI !== undefined) {
        var el = document.getElementById('zoomIncludeLaVidaEOI');
        if (el) { el.checked = cfg.laVidaEOI; el.dispatchEvent(new Event('change', {bubbles:true})); }
      }
      if (cfg.ia !== undefined) {
        var el = document.getElementById('zoomIncludeIA');
        if (el) { el.checked = cfg.ia; el.dispatchEvent(new Event('change', {bubbles:true})); }
      }
    }, config);
    await page.waitForTimeout(200);
  }

  // =========================================================================
  // 1. In-person unchanged
  // =========================================================================
  console.log('--- 1. In-person workflow unchanged ---');
  const p1 = await context.newPage();
  const consoleErrs = [];
  p1.on('pageerror', e => consoleErrs.push('PAGE_ERROR: ' + e.message));
  p1.on('console', msg => { if (msg.type() === 'error') consoleErrs.push('CONSOLE: ' + msg.text()); });
  await p1.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p1.waitForTimeout(1000);
  await p1.fill('#landingStaff','InPerson');
  await p1.click('#landingContinue');
  await p1.waitForTimeout(300);
  await p1.fill('#clientName','John Smith');
  await p1.fill('#date','01/01/2026');
  await p1.evaluate(() => { document.getElementById('includeEOI').checked = true;
    document.getElementById('includeEOI').dispatchEvent(new Event('change', {bubbles:true})); });
  await p1.fill('#propertySaleAddress','123 Test St');
  await p1.waitForTimeout(200);
  check('In-person: PDF generated', await generatePdf(p1));
  check('In-person: no console errors', consoleErrs.length === 0, JSON.stringify(consoleErrs));

  // =========================================================================
  // 2. Stress: Single client, all outputs
  // =========================================================================
  console.log('\n--- 2. Single client, all outputs ---');
  const p2 = await context.newPage();
  await p2.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p2.waitForTimeout(1000);
  await enterZoom(p2, 'Rep One');
  await p2.fill('#clientName', 'Alice Johnson');
  await p2.fill('#date', '15/03/2026');
  await p2.fill('#teamMember', 'Rep One');
  await p2.fill('#firstConsultNotes', 'Single client looking for first home.');
  await p2.fill('#clientReviewStrategy', 'Recommend first home buyer grant.');
  await p2.fill('#clientReviewProperty', '15 Green Ave, Perth WA 6000');
  await p2.selectOption('#clientReviewBuilder', 'Metricon');
  await p2.selectOption('#clientReviewTimeline', '3-6 months');
  await setCheckboxes(p2, {stdEOI: true, laVidaEOI: true, ia: true});
  await clearPdfCache(p2);
  check('Single all: PDF generated', await generatePdf(p2, 6000)); // longer for La Vida images
  const plan2 = await getPlanInfo(p2);
  check('Single all: 7 pages (cover+consult+review+stdEOI+laVida(2)+ia)', plan2 && plan2.total === 7);
  await clearPdfCache(p2);
  const names2 = await getIndividualNames(p2);
  check('Single all: 6 individual docs', Array.isArray(names2) && names2.length === 6);
  if (Array.isArray(names2)) {
    check('Single all: names unique', new Set(names2).size === names2.length);
    check('Single all: has La Vida EOI distinct', names2.some(n => n.indexOf('La Vida EOI') >= 0));
    check('Single all: has EOI', names2.some(n => n === 'EOI - Alice Johnson - Rep One - 15-03-2026.pdf'));
    check('Single all: has IA', names2.some(n => n.indexOf('IA') >= 0));
    check('Single all: has First Consultation', names2.some(n => n.indexOf('First Consultation') >= 0));
    check('Single all: has Client Review', names2.some(n => n.indexOf('Client Review') >= 0));
  }
  const zip2 = await getZipSize(p2);
  check('Single all: ZIP > 20KB', zip2 > 20000);

  // =========================================================================
  // 3. Stress: Dual client, long names
  // =========================================================================
  console.log('\n--- 3. Dual client, long names ---');
  const p3 = await context.newPage();
  await p3.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p3.waitForTimeout(1000);
  await enterZoom(p3, 'Long Name Rep');
  await p3.fill('#clientName', 'Maximiliana von Brandenburg-Schwerin');
  await p3.fill('#client2Name', 'Jonathan-Peregrine Bartholomew Worthington III');
  await p3.fill('#date', '22/12/2026');
  await p3.fill('#clientAddress', '123 Very Long Street Name Avenue, North-Eastern Suburbs District, Perth WA 6000');
  await p3.fill('#propertySaleAddress', 'Lot 42, Grandiose Development Estate Phase 7, Southern River Precinct, WA 6110');
  await p3.fill('#firstConsultAnnualIncome', '$350,000');
  await p3.fill('#firstConsultExistingMortgage', '$180,000');
  await p3.fill('#firstConsultSavings', '$95,500');
  await p3.fill('#firstConsultSuper', '$420,000');
  await p3.fill('#firstConsultInvestmentProperties', '2 (value $1.2M)');
  await p3.fill('#firstConsultBorrowingCapacity', '$1,500,000');
  await p3.fill('#firstConsultNotes', 'Long-term wealth creation strategy. Clients have significant equity in existing portfolio. Looking to expand into commercial property as well as additional residential.');
  await p3.fill('#clientReviewStrategy', 'Recommended strategy involves leveraging existing equity in current portfolio (estimated $1.8M available) to acquire both a commercial property in the growing industrial precinct and an additional residential investment property.');
  await p3.selectOption('#clientReviewBuilder', 'Metricon');
  await p3.selectOption('#clientReviewDeveloper', 'Oliver Hume');
  await p3.selectOption('#clientReviewTimeline', '6-12 months');
  await p3.fill('#clientReviewProperty', 'Lot 99, Very Long Street Name That Goes On And On, Distant Suburb, Western Australia 6110');
  await p3.fill('#clientReviewNextActions', 'Arrange finance pre-approval with recommended broker. Prepare SMSF trust documentation. Engage conveyancer for contract review.');
  await setCheckboxes(p3, {stdEOI: true, ia: true});
  await clearPdfCache(p3);
  check('Dual long: PDF generated', await generatePdf(p3));
  const plan3 = await getPlanInfo(p3);
  check('Dual long: plan has pages', plan3 && plan3.total > 0);
  await clearPdfCache(p3);
  const names3 = await getIndividualNames(p3);
  check('Dual long: individual docs', Array.isArray(names3) && names3.length > 0);
  if (Array.isArray(names3)) {
    check('Dual long: filenames unique', new Set(names3).size === names3.length);
    names3.forEach(n => check('Dual long: clean filename: ' + n.substring(0,50), !/[<>:"\/\\|?*]/.test(n)));
  }

  // =========================================================================
  // 4. Only First Consult + Review (no outputs)
  // =========================================================================
  console.log('\n--- 4. Only First Consult + Review ---');
  const p4 = await context.newPage();
  await p4.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p4.waitForTimeout(1000);
  await enterZoom(p4, 'Minimal Rep');
  await p4.fill('#clientName', 'Bob Minimal');
  await p4.fill('#date', '01/01/2026');
  await p4.fill('#firstConsultNotes', 'Minimal test');
  await p4.fill('#clientReviewStrategy', 'Test');
  await setCheckboxes(p4, {stdEOI: false, laVidaEOI: false, ia: false});
  await clearPdfCache(p4);
  check('Minimal: PDF generated', await generatePdf(p4));
  const plan4 = await getPlanInfo(p4);
  check('Minimal: 3 pages (cover+consult+review)', plan4 && plan4.total === 3);
  await clearPdfCache(p4);
  const names4 = await getIndividualNames(p4);
  check('Minimal: 3 individual docs', Array.isArray(names4) && names4.length === 3);

  // =========================================================================
  // 5. Only Standard EOI (new page to avoid cache)
  // =========================================================================
  console.log('\n--- 5. Zoom + Standard EOI only ---');
  const p5 = await context.newPage();
  await p5.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p5.waitForTimeout(1000);
  await enterZoom(p5, 'EOI Rep');
  await p5.fill('#clientName', 'Bob Minimal');
  await p5.fill('#date', '01/01/2026');
  await setCheckboxes(p5, {stdEOI: true, laVidaEOI: false, ia: false});
  await clearPdfCache(p5);
  check('StdEOI: PDF generated', await generatePdf(p5));
  const plan5 = await getPlanInfo(p5);
  check('StdEOI: 4 pages', plan5 && plan5.total === 4);
  await clearPdfCache(p5);
  const names5 = await getIndividualNames(p5);
  check('StdEOI: 4 individual docs', Array.isArray(names5) && names5.length === 4);

  // =========================================================================
  // 6. Only La Vida EOI (new page)
  // =========================================================================
  console.log('\n--- 6. Zoom + La Vida EOI only ---');
  const p6 = await context.newPage();
  await p6.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p6.waitForTimeout(1000);
  await enterZoom(p6, 'LaVida Rep');
  await p6.fill('#clientName', 'Bob Minimal');
  await p6.fill('#date', '01/01/2026');
  await setCheckboxes(p6, {stdEOI: false, laVidaEOI: true, ia: false});
  await clearPdfCache(p6);
  check('LaVidaEOI: PDF generated', await generatePdf(p6, 8000)); // 2 La Vida images
  const plan6 = await getPlanInfo(p6);
  check('LaVidaEOI: 5 pages (cover+consult+review+laVida(2))', plan6 && plan6.total === 5);
  await clearPdfCache(p6);
  const names6 = await getIndividualNames(p6);
  check('LaVidaEOI: 4 individual docs', Array.isArray(names6) && names6.length === 4);
  if (Array.isArray(names6)) {
    check('LaVidaEOI: distinct La Vida EOI filename', names6.some(n => n.indexOf('La Vida EOI') >= 0));
  }

  // =========================================================================
  // 7. Only IA (new page)
  // =========================================================================
  console.log('\n--- 7. Zoom + IA only ---');
  const p7 = await context.newPage();
  await p7.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p7.waitForTimeout(1000);
  await enterZoom(p7, 'IA Rep');
  await p7.fill('#clientName', 'Bob Minimal');
  await p7.fill('#date', '01/01/2026');
  await setCheckboxes(p7, {stdEOI: false, laVidaEOI: false, ia: true});
  await clearPdfCache(p7);
  check('IA only: PDF generated', await generatePdf(p7));
  const plan7 = await getPlanInfo(p7);
  check('IA only: 4 pages (cover+consult+review+ia)', plan7 && plan7.total === 4);
  await clearPdfCache(p7);
  const names7 = await getIndividualNames(p7);
  check('IA only: 4 individual docs', Array.isArray(names7) && names7.length === 4);

  // =========================================================================
  // 8. All optional outputs (new page)
  // =========================================================================
  console.log('\n--- 8. All optional outputs ---');
  const p8 = await context.newPage();
  await p8.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await p8.waitForTimeout(1000);
  await enterZoom(p8, 'All Rep');
  await p8.fill('#clientName', 'Bob Minimal');
  await p8.fill('#date', '01/01/2026');
  await p8.fill("#firstConsultNotes", "Draft notes");
  await p8.fill("#clientReviewStrategy", "Draft strategy");
  await setCheckboxes(p8, {stdEOI: true, laVidaEOI: true, ia: true});
  await clearPdfCache(p8);
  const plan8 = await getPlanInfo(p8);
  check('All optional: 7 pages', plan8 && plan8.total === 7);
  await clearPdfCache(p8);
  const names8 = await getIndividualNames(p8);
  check('All optional: 6 individual docs', Array.isArray(names8) && names8.length === 6);
  if (Array.isArray(names8)) {
    check('All optional: all names unique', new Set(names8).size === names8.length);
  }

  // =========================================================================
  // 9. ZIP content audit
  // =========================================================================
  console.log('\n--- 9. ZIP content audit ---');
  if (Array.isArray(names8)) {
    const hasCover = names8.some(n => n.indexOf('Sales Appointment') >= 0);
    const hasConsult = names8.some(n => n.indexOf('First Consultation') >= 0);
    const hasReview = names8.some(n => n.indexOf('Client Review') >= 0);
    const hasStdEoi = names8.some(n => n === 'EOI - Bob Minimal - All Rep - 01-01-2026.pdf');
    const hasLaVidaEoi = names8.some(n => n.indexOf('La Vida EOI') >= 0);
    const hasIA = names8.some(n => n.indexOf('IA') >= 0);
    check('ZIP: cover booklet', hasCover);
    check('ZIP: first consultation', hasConsult);
    check('ZIP: client review', hasReview);
    check('ZIP: standard EOI distinct', hasStdEoi);
    check('ZIP: La Vida EOI distinct', hasLaVidaEoi);
    check('ZIP: IA distinct', hasIA);
    check('ZIP: exactly 5 files', names8.length === 6);
  }

  const zip8 = await getZipSize(p8);
  check('ZIP: size > 25KB (all outputs)', zip8 > 25000);

  // =========================================================================
  // 10. Draft save/load
  // =========================================================================
  console.log('\n--- 10. Draft save/load ---');
  await p8.evaluate(() => document.getElementById('saveDraft').click());
  await p8.waitForTimeout(300);
  const draft = await p8.evaluate(() => {
    const raw = localStorage.getItem('salesAppointmentDraft');
    return raw ? JSON.parse(raw) : null;
  });
  check('Draft saved', !!draft);
  check('Draft: appointmentMode zoom', draft && draft.appointmentMode === 'zoom');
  check('Draft: all outputs preserved', draft && draft.zoomIncludeStandardEOI === true && draft.zoomIncludeLaVidaEOI === true && draft.zoomIncludeIA === true);

  const pLoad = await context.newPage();
  await pLoad.goto(baseUrl, {waitUntil:'networkidle',timeout:15000});
  await pLoad.waitForTimeout(1000);
  await pLoad.fill('#landingStaff','LoadRep');
  await pLoad.click('#landingContinue');
  await pLoad.waitForTimeout(300);
  await pLoad.evaluate(() => document.getElementById('loadDraft').click());
  await pLoad.waitForTimeout(1000);
  const loaded = await pLoad.evaluate(() => {
    return {
      zoom: document.querySelector('.app').className.indexOf('show-zoom') >= 0,
      strategy: document.getElementById('clientReviewStrategy').value,
      notes: document.getElementById('firstConsultNotes').value,
      stdEOI: document.getElementById('zoomIncludeStandardEOI').checked,
      laVidaEOI: document.getElementById('zoomIncludeLaVidaEOI').checked,
      ia: document.getElementById('zoomIncludeIA').checked
    };
  });
  check('Draft: zoom mode', loaded.zoom);
  check("Draft: strategy restored", loaded.strategy === "Draft strategy");
  check("Draft: notes restored", loaded.notes === "Draft notes");
  check('Draft: stdEOI restored', loaded.stdEOI);
  check('Draft: laVidaEOI restored', loaded.laVidaEOI);
  check('Draft: IA restored', loaded.ia);

  // =========================================================================
  // 11. Old drafts
  // =========================================================================
  console.log('\n--- 11. Old draft compatibility ---');
  await pLoad.evaluate(() => {
    localStorage.setItem('salesAppointmentDraft', JSON.stringify({
      teamMember: 'Legacy User', clientName: 'Old Client', date: '01/01/2026'
    }));
  });
  await pLoad.evaluate(() => document.getElementById('loadDraft').click());
  await pLoad.waitForTimeout(500);
  const legacy = await pLoad.evaluate(() => {
    return {
      inPerson: document.querySelector('.app').className.indexOf('show-in-person') >= 0,
      tm: document.getElementById('teamMember').value
    };
  });
  check('Legacy: show-in-person', legacy.inPerson);
  check('Legacy: teamMember', legacy.tm === 'Legacy User');

  // =========================================================================
  // 12. Version
  // =========================================================================
  console.log('\n--- 12. Version check ---');
  const ver = await p1.evaluate(() => {
    const labels = document.querySelectorAll('[data-app-version-label]');
    return Array.from(labels).map(el => el.textContent);
  });
  check('Version 2.2.0-alpha.1', ver[0] === 'Version 2.2.0-alpha.1');

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n===========================');
  console.log('Phase 3 QA stress test: ' + (pass + fail) + ' total, ' + pass + ' passed, ' + fail + ' failed');
  console.log('===========================');

  if (consoleErrs.length > 0) {
    console.log('\nConsole errors during test:');
    consoleErrs.forEach(e => console.log('  ' + e));
  }

  await browser.close();
  server.close();
  process.exit(fail > 0 ? 1 : 0);
});
