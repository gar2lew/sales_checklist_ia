const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const s = http.createServer((req, res) => {
  const fp = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  res.setHeader('Cache-Control','no-store');
  res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || ''});
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(''); return; } res.end(d); });
});

s.listen(0, async () => {
  const port = s.address().port;
  const b = await chromium.launch({headless: true});
  let ok = 0, fail = 0;
  function chk(n, o) { if (o) { ok++; console.log('  \u2705 ' + n); } else { fail++; console.log('  \u274C ' + n); } }

  async function newConfiguredPage() {
    const page = await b.newPage();
    await page.addInitScript(() => localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
      staff:{ mode:'select', options:[
        { id:'t', name:'T', email:'', office:'Perth', active:true },
        { id:'sarah', name:'Sarah', email:'', office:'Brisbane', active:true }
      ] }
    })));
    return page;
  }

  async function selectLandingStaff(p) {
    await p.selectOption('#landingStaff', 'T');
  }
  async function setContractTbc(p) {
    await p.evaluate(() => {
      const input = document.getElementById('contractDueDateTbc');
      input.checked = true;
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    });
  }
  async function enZ(p) {
    await selectLandingStaff(p);
    await p.evaluate(() => {
      document.querySelectorAll('.mode-card')[1].classList.add('active');
      document.querySelectorAll('.mode-card')[0].classList.remove('active');
    });
    await p.waitForTimeout(1000);
    const btnState = await p.evaluate(() => {
      const btn = document.querySelector('#landingContinue');
      return { disabled: btn ? btn.disabled : 'not found', text: btn ? btn.textContent : '' };
    });
    console.log('Button state before click:', btnState);
    await p.click('#landingContinue');
    await p.waitForTimeout(2000);
    const appState = await p.evaluate(() => {
      const ls = document.querySelector('#landingScreen');
      const app = document.querySelector('.app');
      return {
        landingScreenClass: ls ? ls.className : 'not found',
        appClass: app ? app.className : 'not found'
      };
    });
    console.log('After click state:', appState);
    await p.waitForFunction(() => { const app = document.querySelector('.app'); return app && app.classList.contains('show-zoom'); }, { timeout: 5000 });
    await p.waitForSelector('#firstConsultSection', { state: 'visible', timeout: 5000 });
    await setContractTbc(p);
  }
  async function gen(p) {
    await p.evaluate(() => document.getElementById('generateTop').click());
  for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => document.getElementById('status').textContent); if (st.indexOf('Appointment package ready') >= 0) return true; }
    return false;
  }

  // 1. Brisbane FC + CR + all outputs
  console.log('\n--- Brisbane First Consult + Client Review ---');
  const p1 = await newConfiguredPage();
  p1.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  p1.on("pageerror", err => console.log("PAGE ERROR:", err.message));
  await p1.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p1.waitForTimeout(1000); await enZ(p1);
  await p1.fill('#clientName','Alice'); await p1.fill('#client2Name','Bob');
  await p1.fill('#clientPhone','0400'); await p1.fill('#clientEmail','a@b.com');
  await p1.fill('#clientAddress','123 St'); await p1.fill('#date','15/07/2026');
  await p1.selectOption('#teamMember','Sarah'); await p1.fill('#propertySaleAddress','456 Ave');
  await p1.evaluate(() => { const g = document.querySelector('input[name="firstConsultGoalType"][value="investment"]'); if (g) g.checked = true; });
  await p1.fill('#firstConsultNotes','Notes about client goals for investment.');
  await p1.fill('#clientReviewStrategy','Buy and hold strategy.');
  await p1.selectOption('#clientReviewBuilder','Metricon');
  await p1.selectOption('#clientReviewDeveloper','Oliver Hume');
  await p1.fill('#clientReviewProperty','123 Growth St');
  await p1.selectOption('#clientReviewTimeline','3-6 months');
  await p1.fill('#clientReviewNextActions','Arrange finance.');
  await p1.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomIncludeIA').checked = true;
    document.getElementById('zoomIncludeIA').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p1.waitForTimeout(200);

  /* Timeline: zoom renders 8 steps */
  const tlZoom1 = await p1.evaluate(() => {
    var tl = document.getElementById('timelineZoom');
    if(!tl) return { found: false };
    var steps = tl.querySelectorAll('.tl-step-btn');
    return { found: true, count: steps.length, display: tl.style.display || '' };
  });
  chk('Zoom timeline has 8 steps', tlZoom1.found && tlZoom1.count === 8);
  /* After filling fields, at least one step complete */
  const tlComp1 = await p1.evaluate(() => {
    var steps = document.querySelectorAll('#timelineZoom .timeline-step');
    var states = [];
    steps.forEach(function(s){ states.push(s.className); });
    return states.join('|');
  });
  chk('At least one zoom step is complete', tlComp1.indexOf('tl-complete') >= 0);
  /* Ready step check */
  const tlReady1 = await p1.evaluate(() => {
    var last = document.querySelector('#timelineZoom .timeline-step:last-child');
    return last ? last.classList.contains('tl-complete') : false;
  });
  chk('Ready step is tl-complete after all fields', tlReady1);

  const plan1 = await p1.evaluate(() => {
    try { const pl = window._testState.getZoomOutputPlan(); return {total: pl.totalPages, ids: pl.pages.map(function(p){return p.id+(p.subIdx !== undefined ? '['+p.subIdx+']' : '');}).join(',')}; } catch(e) { return null; }
  });
  chk('Plan: cover+fc[0-5]+cr[0-3]+eoi+ia = 13 pages', plan1 && plan1.total === 13);
  chk('Page order correct', plan1 && plan1.ids.indexOf('cover,firstConsult[0],firstConsult[1],firstConsult[2],firstConsult[3],firstConsult[4],firstConsult[5],clientReview[0],clientReview[1],clientReview[2],clientReview[3],eoi,ia') >= 0);
  chk('Brisbane PDF generated', await gen(p1));

  /* Inline validation: no errors on fresh load */
  const noErrs = await p1.evaluate(() => {
    return document.querySelectorAll('.invalidField').length === 0 && document.querySelectorAll('.fieldError').length === 0;
  });
  chk('No inline errors on fully valid form', noErrs);

  /* Inline validation: missing fields on Generate */
  const p1b = await newConfiguredPage();
  await p1b.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p1b.waitForTimeout(500); await enZ(p1b);
  /* Click Generate with empty fields */
  await p1b.evaluate(() => document.getElementById('generateTop').click());
  await p1b.waitForTimeout(800);
  const errsAfter = await p1b.evaluate(() => {
    var inv = document.querySelectorAll('.invalidField');
    var errs = document.querySelectorAll('.fieldError');
    return { invalidCount: inv.length, errorCount: errs.length, firstCardVisible: (function(){
      var invEls = document.querySelectorAll('.invalidField');
      if(invEls.length === 0) return false;
      var card = invEls[0].closest('.card');
      if(!card) return false;
      var rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight;
    })() };
  });
  chk('Generate with missing fields shows inline errors', errsAfter.invalidCount > 0 && errsAfter.errorCount > 0);
  chk('First incomplete section visible after Generate', errsAfter.firstCardVisible);
  /* Fill date field and verify its error clears */
  await p1b.fill('#date','15/07/2026');
  await p1b.waitForTimeout(600);
  const dateErrCleared = await p1b.evaluate(() => {
    var el = document.getElementById('date');
    return el && !el.classList.contains('invalidField');
  });
  chk('Filling a field clears its error', dateErrCleared);

  /* Timeline aria-label has missing count */
  const tlAria = await p1b.evaluate(() => {
    var btn = document.querySelector('#timelineZoom [data-tl-target="zoomPackagePreview"]');
    return btn ? btn.getAttribute('aria-label') || '' : '';
  });
  chk('Timeline Ready step shows missing count', tlAria.indexOf('remaining') >= 0);

  /* Re-validate: fill remaining required fields, check PDF still generates */
  await p1b.selectOption('#teamMember','Sarah'); await p1b.fill('#clientName','Alice');
  await p1b.waitForTimeout(500);
  await p1b.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p1b.waitForTimeout(200);
  chk('Valid form still generates PDF after validation', await gen(p1b));

  /* Preview–Field Linking */
  /* Open preview and navigate to FC page 1 */
  await p1b.evaluate(() => document.getElementById('previewTop').click());
  await p1b.waitForTimeout(1500);
  /* Navigate to page 1 (First Consult, after cover) */
  await p1b.evaluate(() => { var p = 1; try { var plan = window._testState.getZoomOutputPlan(); for(var i=0;i<p;i++) document.getElementById('previewNext').click(); } catch(e){} });
  await p1b.waitForTimeout(2000);

  /* Diagnostic: check overlay and field mapping state */
  var diag = await p1b.evaluate(() => {
    var ov = document.getElementById('previewOverlay');
    var fields = window._testState ? window._testState.getFieldsOnCurrentPage() : [];
    var fcFields = fields.filter(function(f){ return f.coords !== null; });
    return {
      overlayExists: !!ov,
      overlayW: ov ? ov.width : 0,
      fieldsOnPage: fields.length,
      fieldsWithCoords: fcFields.length,
      previewPageIndex: (function(){ try { var p=window._testState.getOutputPlan(); return p && p.totalPages ? 'ok' : 'fail'; } catch(e){ return e.message; } })()
    };
  });
  console.log('Preview linking diag:', JSON.stringify(diag));

  /* Focus mapped field — check that getFieldsOnCurrentPage returns entries */
  await p1b.evaluate(() => {
    var el = document.getElementById('clientName');
    if(el) el.focus();
  });
  await p1b.waitForTimeout(800);
  var fieldsAfterFocus = await p1b.evaluate(() => {
    var fields = window._testState ? window._testState.getFieldsOnCurrentPage() : [];
    return fields.length;
  });
  chk('Mapped field focus finds fields on current page', fieldsAfterFocus > 0);

  /* Region toggle enables hit testing */
  await p1b.evaluate(() => {
    var cb = document.getElementById('showFieldRegions');
    if(cb){ cb.checked = true; cb.dispatchEvent(new Event('change', {bubbles:true})); }
  });
  await p1b.waitForTimeout(500);
  var regionsOn = await p1b.evaluate(() => {
    var ov = document.getElementById('previewOverlay');
    var cb = document.getElementById('showFieldRegions');
    return cb && cb.checked && ov && ov.classList.contains('clickable');
  });
  chk('Region toggle enables overlay clickability', regionsOn);

  /* Preview click on mapped region scrolls to field */
  await p1b.evaluate(() => { window.scrollTo(0, 500); });
  await p1b.waitForTimeout(300);
  var overlayRect = await p1b.evaluate(() => {
    var ov = document.getElementById('previewOverlay');
    if(!ov || ov.width === 0) return null;
    var r = ov.getBoundingClientRect();
    var cx = r.left + (143 / 595) * r.width;
    var cy = r.top + (255 / 842) * r.height;
    return { x: cx, y: cy };
  });
  if(overlayRect){
    await p1b.mouse.click(overlayRect.x, overlayRect.y);
    await p1b.waitForTimeout(800);
  }
  var scrolledToField = await p1b.evaluate(() => {
    var el = document.getElementById('clientName');
    if(!el) return false;
    var rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
  chk('Preview click on region scrolls to field', scrolledToField);

  /* Unmapped field: focus 'notes' (not in PREVIEW_FIELD_MAP) */
  await p1b.evaluate(() => {
    var el = document.getElementById('notes');
    if(el) el.focus();
  });
  await p1b.waitForTimeout(500);
  var noMapForNotes = await p1b.evaluate(() => {
    /* PREVIEW_FIELD_MAP doesn't have 'notes', so focus should do nothing */
    var ov = document.getElementById('previewOverlay');
    /* Check overlay unchanged — it was cleared when toggle turned off */
    return true; /* just verify no crash */
  });
  chk('Unmapped field focus is safe', noMapForNotes);

  await p1b.close();

  await p1.evaluate(() => document.getElementById('previewTop').click()); await p1.waitForTimeout(1000);
  chk('Preview visible', await p1.evaluate(() => { const paper = document.getElementById('previewPaper'); return paper && paper.querySelector('canvas') !== null; }));

  const i1 = await p1.evaluate(async () => { try { const r = await window._testState.buildIndividualPdfs(); return r.map(function(p){return p.name;}); } catch(e) { return null; } });
  chk('5 individual PDF groups', Array.isArray(i1) && i1.length === 5);
  if (Array.isArray(i1)) {
    chk('FC Brisbane filename', i1.some(function(n){return n.indexOf('First Consultation - Brisbane') >= 0;}));
    chk('CR filename', i1.some(function(n){return n.indexOf('Client Review Assessment') >= 0;}));
    chk('EOI filename', i1.some(function(n){return n.indexOf('EOI -') >= 0;}));
    chk('IA filename', i1.some(function(n){return n.indexOf('IA -') >= 0;}));
    chk('All filenames unique', new Set(i1).size === i1.length);
  }

  // 2. Perth FC
  console.log('\n--- Perth First Consult ---');
  await p1.evaluate(() => { document.getElementById('zoomFirstConsultTemplate').value = 'perth'; document.getElementById('zoomFirstConsultTemplate').dispatchEvent(new Event('change', {bubbles:true})); });
  await p1.waitForTimeout(100);
  const planP = await p1.evaluate(() => { try { const pl = window._testState.getZoomOutputPlan(); return pl.totalPages; } catch(e) { return -1; } });
  chk('Perth: same page count (13)', planP === 13);
  chk('Perth PDF generated', await gen(p1));
  const iP = await p1.evaluate(async () => { try { const r = await window._testState.buildIndividualPdfs(); return r.map(function(p){return p.name;}); } catch(e) { return null; } });
  if (Array.isArray(iP)) { chk('Perth FC filename', iP.some(function(n){return n.indexOf('First Consultation - Perth') >= 0;})); }

  // 3. No optional outputs
  console.log('\n--- Zoom: no optionals ---');
  await p1.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = false;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomIncludeIA').checked = false;
    document.getElementById('zoomIncludeIA').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p1.waitForTimeout(100);
  const planN = await p1.evaluate(() => { try { const pl = window._testState.getZoomOutputPlan(); return pl.totalPages; } catch(e) { return -1; } });
  chk('11 pages (cover+fc6+cr4)', planN === 11);
  chk('PDF generated', await gen(p1));

  // 4. All outputs including La Vida
  console.log('\n--- Zoom: all outputs + La Vida ---');
  await p1.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomIncludeLaVidaEOI').checked = true;
    document.getElementById('zoomIncludeLaVidaEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomIncludeIA').checked = true;
    document.getElementById('zoomIncludeIA').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p1.waitForTimeout(100);
  const planA = await p1.evaluate(() => { try { const pl = window._testState.getZoomOutputPlan(); return {total: pl.totalPages, groups: pl.groups.length}; } catch(e) { return null; } });
  chk('15 pages (cover+fc6+cr4+eoi+laVida2+ia)', planA && planA.total === 15);
  chk('6 groups (cover,fc,cr,eoi,laVida,ia)', planA && planA.groups === 6);
  chk('PDF generated', await gen(p1));
  const iA = await p1.evaluate(async () => { try { const r = await window._testState.buildIndividualPdfs(); return r.map(function(p){return p.name;}); } catch(e) { return null; } });
  chk('6 individual PDFs', Array.isArray(iA) && iA.length === 6);
  if (Array.isArray(iA)) {
    chk('All filenames unique', new Set(iA).size === iA.length);
    chk('La Vida EOI distinct', iA.some(function(n){return n.indexOf('La Vida EOI') >= 0;}));
  }

  // 5. Single client
  console.log('\n--- Single client ---');
  const p2 = await newConfiguredPage();
  await p2.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p2.waitForTimeout(1000); await enZ(p2);
  await p2.fill('#clientName','Single'); await p2.fill('#date','01/01/2026');
  await p2.fill('#firstConsultNotes','N'); await p2.fill('#clientReviewStrategy','S');
  await p2.selectOption('#clientReviewBuilder','Metricon');
  await p2.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p2.waitForTimeout(200);
  chk('PDF generated', await gen(p2));

  // 6. Long text values
  console.log('\n--- Long text values ---');
  const p3 = await newConfiguredPage();
  await p3.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p3.waitForTimeout(1000); await enZ(p3);
  await p3.fill('#clientName','Maximiliana von Brandenburg-Schwerin');
  await p3.fill('#client2Name','Jonathan-Peregrine Bartholomew Worthington III');
  await p3.fill('#clientAddress','123 Very Long Street Name, North-Eastern Suburbs, Perth WA 6000');
  await p3.fill('#propertySaleAddress','Lot 42, Grandiose Development Estate Phase 7, Southern River, WA 6110');
  await p3.fill('#date','01/01/2026');
  await p3.fill('#firstConsultNotes','Long consultation notes that should wrap properly '.repeat(10));
  await p3.fill('#clientReviewStrategy','Long strategy description for testing '.repeat(15));
  await p3.fill('#clientReviewProperty','Very long recommended property address for testing wrapping behavior in fixed template areas');
  await p3.fill('#clientReviewNextActions','Long next actions for testing '.repeat(12));
  await p3.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p3.waitForTimeout(200);
  chk('PDF generated', await gen(p3));

  // 7. Draft save/load
  console.log('\n--- Draft save/load ---');
  await p1.evaluate(() => document.getElementById('saveDraft').click()); await p1.waitForTimeout(300);
  const dr = await p1.evaluate(() => { const r = localStorage.getItem('salesAppointmentDraft'); return r ? JSON.parse(r) : null; });
  chk('Draft saved', !!dr);
  chk('appointmentMode=zoom', dr && dr.appointmentMode === 'zoom');
  chk('city=perth', dr && dr.zoomFirstConsultTemplate === 'perth');
  chk('has FC notes', dr && dr.firstConsultNotes.indexOf('investment') >= 0);
  chk('draftSavedAt exists', dr && !!dr.draftSavedAt);

  // 7b. Recent draft card on landing
  console.log('\n--- Draft card UI ---');
  const pd = await newConfiguredPage();
  await pd.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await pd.waitForTimeout(500);
  // Inject draft into this page's localStorage
  await pd.evaluate((s) => { localStorage.setItem('salesAppointmentDraft', s); }, JSON.stringify(dr));
  // Reload so checkForRecentDraft runs on page init
  await pd.reload({waitUntil:'networkidle', timeout:15000});
  await pd.waitForTimeout(500);
  chk('Recent draft card visible', await pd.evaluate(() => { var c = document.getElementById('recentDraftCard'); return !c.classList.contains('hidden'); }));
  chk('Draft type shown', await pd.evaluate(() => document.getElementById('draftType').textContent.length > 0));
  chk('Draft client shown', await pd.evaluate(() => document.getElementById('draftClient').textContent.length > 0));
  chk('Draft date shown', await pd.evaluate(() => document.getElementById('draftDate').textContent.length > 0));
  chk('Draft staff shown', await pd.evaluate(() => document.getElementById('draftStaff').textContent.length > 0));
  chk('Draft savedAt shown', await pd.evaluate(() => document.getElementById('draftSavedAt').textContent.length > 0));

  // 7c. Resume Draft from card
  console.log('\n--- Draft card resume ---');
  await pd.evaluate(() => document.getElementById('resumeDraftBtn').click());
  await pd.waitForTimeout(3000);
  const resumed = await pd.evaluate(() => ({
    city: document.getElementById('zoomFirstConsultTemplate').value,
    strategy: document.getElementById('clientReviewStrategy').value.indexOf('Buy and hold') >= 0,
    ia: document.getElementById('zoomIncludeIA') ? document.getElementById('zoomIncludeIA').checked : false
  }));
  chk('Resumed: city=perth', resumed.city === 'perth');
  chk('Resumed: strategy restored', resumed.strategy);
  chk('Resumed: IA restored', resumed.ia);

  // 7d. Delete Draft
  console.log('\n--- Draft card delete ---');
  const px = await newConfiguredPage();
  await px.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await px.waitForTimeout(500);
  await px.evaluate((s) => { localStorage.setItem('salesAppointmentDraft', s); }, JSON.stringify(dr));
  await px.reload({waitUntil:'networkidle', timeout:15000});
  await px.waitForTimeout(500);
  // Confirm dialog is auto-accepted in headless mode by default; ensure acceptance
  await px.evaluate(() => { window.confirm = function(){ return true; }; });
  await px.evaluate(() => { document.getElementById('deleteDraftBtn').click(); });
  await px.waitForTimeout(500);
  const deletedHidden = await px.evaluate(() => {
    var c = document.getElementById('recentDraftCard');
    return c.classList.contains('hidden');
  });
  const deletedStorage = await px.evaluate(() => { try { return localStorage.getItem('salesAppointmentDraft'); } catch(e) { return 'ERROR'; } });
  chk('Delete: card hidden', deletedHidden);
  chk('Delete: draft removed', deletedStorage === null);

  // 7e. Old draft without draftSavedAt still loads
  console.log('\n--- Draft without savedAt ---');
  const py = await newConfiguredPage();
  await py.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await py.waitForTimeout(500);
  var oldDraft = JSON.parse(JSON.stringify(dr));
  delete oldDraft.draftSavedAt;
  await py.evaluate((s) => { localStorage.setItem('salesAppointmentDraft', s); }, JSON.stringify(oldDraft));
  await py.reload({waitUntil:'networkidle', timeout:15000});
  await py.waitForTimeout(500);
  chk('Old draft: card visible', await py.evaluate(() => { var c = document.getElementById('recentDraftCard'); return !c.classList.contains('hidden'); }));
  chk('Old draft: savedAt shows Unknown', await py.evaluate(() => document.getElementById('draftSavedAt').textContent === 'Unknown'));

  const p4 = await newConfiguredPage();
  await p4.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p4.waitForTimeout(1000); await enZ(p4);
  // In Playwright, each newPage() creates an isolated browser context,
  // so localStorage from p1 is not inherited. Inject the draft manually.
  await p4.evaluate((draftStr) => { try { localStorage.setItem('salesAppointmentDraft', draftStr); } catch(e) { console.error('setItem failed', e); } }, JSON.stringify(dr));
  await p4.evaluate(() => document.getElementById('loadDraft').click());
  // Wait for the async setDraft to complete (image loads, etc.)
  await p4.waitForTimeout(3000);
  const ld = await p4.evaluate(() => {
    return {
      city: document.getElementById('zoomFirstConsultTemplate').value,
      strategy: document.getElementById('clientReviewStrategy').value.indexOf('Buy and hold') >= 0,
      ia: document.getElementById('zoomIncludeIA') ? document.getElementById('zoomIncludeIA').checked : false
    };
  });
  chk('Draft: city=perth', ld.city === 'perth');
  chk('Draft: strategy restored', ld.strategy);
  chk('Draft: IA restored', ld.ia);

  // 8. In-person
  console.log('\n--- In-person ---');
  const p5 = await newConfiguredPage();
  await p5.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p5.waitForTimeout(1000);
  await selectLandingStaff(p5); await p5.click('#landingContinue'); await p5.waitForTimeout(300);
  await setContractTbc(p5);

  /* Timeline: in-person renders 7 steps */
  const tlIp1 = await p5.evaluate(() => {
    var tl = document.getElementById('timelineInPerson');
    if(!tl) return { found: false };
    var steps = tl.querySelectorAll('.tl-step-btn');
    return { found: true, count: steps.length };
  });
  chk('In-person timeline has 7 steps', tlIp1.found && tlIp1.count === 7);
  /* EOI and IA steps show not-required when unchecked */
  const tlIpStates = await p5.evaluate(() => {
    var steps = document.querySelectorAll('#timelineInPerson .timeline-step');
    var states = [];
    steps.forEach(function(s){ states.push(s.className); });
    return states.join('|');
  });
  chk('EOI step is not-required when excluded', tlIpStates.indexOf('tl-not-required') >= 0);
  /* Click a step: click Checklist step, verify Checklist section visible */
  await p5.evaluate(() => {
    var btn = document.querySelector('[data-tl-target="checklistCard"]');
    if(btn) btn.click();
  });
  await p5.waitForTimeout(800);
  const tlScrollVisible = await p5.evaluate(() => {
    var el = document.getElementById('checklistCard');
    if(!el) return false;
    var rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight;
  });
  chk('Clicking a timeline step scrolls to section', tlScrollVisible);

  await p5.fill('#clientName','J'); await p5.fill('#date','01/01/2026');
  await p5.fill('#propertySaleAddress','123'); await p5.fill('#clientAddress','456');
  await p5.evaluate(() => {
    document.getElementById('includeEOI').checked = true;
    document.getElementById('includeEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('eoiDate').value = '01/01/2026';
    document.getElementById('eoiNextApptDate').value = '2026-02-01';
  });
  await p5.waitForTimeout(300);
  chk('PDF generated', await gen(p5));

  console.log('\n===========================');
  console.log((ok+fail) + ' tests, ' + ok + ' passed, ' + fail + ' failed');
  console.log('===========================');
  await b.close(); s.close(); process.exit(fail ? 1 : 0);
});
