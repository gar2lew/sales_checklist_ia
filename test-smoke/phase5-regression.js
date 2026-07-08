const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME = {'.html':'text/html','.js':'application/javascript'};
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

  async function enZ(p) {
    await p.evaluate(() => {
      const si = document.querySelector('#landingStaff');
      if (si) { si.value = 'T'; si.dispatchEvent(new Event('input', {bubbles:true})); si.dispatchEvent(new Event('change', {bubbles:true})); }
      document.querySelectorAll('.mode-btn')[1].classList.add('active');
      document.querySelectorAll('.mode-btn')[0].classList.remove('active');
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
  }
  async function gen(p) {
    await p.evaluate(() => document.getElementById('generateTop').click());
    for (let i = 0; i < 16; i++) { await p.waitForTimeout(500); const st = await p.evaluate(() => document.getElementById('status').textContent); if (st.indexOf('PDF ready') >= 0) return true; }
    return false;
  }

  // 1. Brisbane FC + CR + all outputs
  console.log('\n--- Brisbane First Consult + Client Review ---');
  const p1 = await b.newPage();
  p1.on("console", msg => console.log("CONSOLE:", msg.type(), msg.text()));
  p1.on("pageerror", err => console.log("PAGE ERROR:", err.message));
  await p1.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p1.waitForTimeout(1000); await enZ(p1);
  await p1.fill('#clientName','Alice'); await p1.fill('#client2Name','Bob');
  await p1.fill('#clientPhone','0400'); await p1.fill('#clientEmail','a@b.com');
  await p1.fill('#clientAddress','123 St'); await p1.fill('#date','15/07/2026');
  await p1.fill('#teamMember','Sarah'); await p1.fill('#propertySaleAddress','456 Ave');
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

  const plan1 = await p1.evaluate(() => {
    try { const pl = window._testState.getZoomOutputPlan(); return {total: pl.totalPages, ids: pl.pages.map(function(p){return p.id+(p.subIdx !== undefined ? '['+p.subIdx+']' : '');}).join(',')}; } catch(e) { return null; }
  });
  chk('Plan: cover+fc[0-5]+cr[0-3]+eoi+ia = 13 pages', plan1 && plan1.total === 13);
  chk('Page order correct', plan1 && plan1.ids.indexOf('cover,firstConsult[0],firstConsult[1],firstConsult[2],firstConsult[3],firstConsult[4],firstConsult[5],clientReview[0],clientReview[1],clientReview[2],clientReview[3],eoi,ia') >= 0);
  chk('Brisbane PDF generated', await gen(p1));
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
  const p2 = await b.newPage();
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
  const p3 = await b.newPage();
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
  const pd = await b.newPage();
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
  const px = await b.newPage();
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
  const py = await b.newPage();
  await py.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await py.waitForTimeout(500);
  var oldDraft = JSON.parse(JSON.stringify(dr));
  delete oldDraft.draftSavedAt;
  await py.evaluate((s) => { localStorage.setItem('salesAppointmentDraft', s); }, JSON.stringify(oldDraft));
  await py.reload({waitUntil:'networkidle', timeout:15000});
  await py.waitForTimeout(500);
  chk('Old draft: card visible', await py.evaluate(() => { var c = document.getElementById('recentDraftCard'); return !c.classList.contains('hidden'); }));
  chk('Old draft: savedAt shows Unknown', await py.evaluate(() => document.getElementById('draftSavedAt').textContent === 'Unknown'));

  const p4 = await b.newPage();
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
  const p5 = await b.newPage();
  await p5.goto('http://localhost:' + port, {waitUntil:'networkidle', timeout:15000});
  await p5.waitForTimeout(1000);
  await p5.fill('#landingStaff','T'); await p5.click('#landingContinue'); await p5.waitForTimeout(300);
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
