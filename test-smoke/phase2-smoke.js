const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MIME = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg', '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found: ' + req.url); return; }
    res.writeHead(200, { 'Content-Type': contentType });
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

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // === PAGE 1: Full workflow test ===
    const page = await context.newPage();
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // ---- 1. Version check ----
    console.log('\n--- 1. Version check ---');
    const ver = await page.evaluate(() => {
      const labels = document.querySelectorAll('[data-app-version-label]');
      return Array.from(labels).map(el => el.textContent);
    });
    check('Version is 2.1.0-alpha.1', ver[0] === 'Version 2.1.0-alpha.1');

    // ---- 2. Landing ----
    console.log('\n--- 2. Landing screen ---');
    const landingVisible = await page.evaluate(() => {
      const ls = document.getElementById('landingScreen');
      return ls && !ls.classList.contains('hidden');
    });
    check('Landing visible on fresh load', landingVisible);

    await page.fill('#landingStaff', 'Phase2 Tester');
    await page.waitForTimeout(200);

    // ---- 3. In-person mode ----
    console.log('\n--- 3. In-person mode ---');
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.mode-btn');
      btns.forEach(b => b.classList.remove('active'));
      btns[0].classList.add('active');
    });
    await page.click('#landingContinue');
    await page.waitForTimeout(300);

    check('In-person: Landing hidden',
      await page.evaluate(() => document.getElementById('landingScreen').classList.contains('hidden')));

    const appClass = await page.evaluate(() => document.querySelector('.app').className);
    check('In-person: .app has show-in-person', appClass.indexOf('show-in-person') >= 0);

    check('In-person: EOI card visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('eoiDetailsCard')).display !== 'none'));

    check('In-person: IA card visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('iaDetailsCard')).display !== 'none'));

    check('In-person: Zoom section 2 hidden',
      await page.evaluate(() => {
        const el = document.getElementById('firstConsultSection');
        return !el || window.getComputedStyle(el).display === 'none';
      }));

    // ---- 4. In-person summary ----
    console.log('\n--- 4. In-person summary ---');
    check('In-person: Summary columns visible',
      await page.evaluate(() => {
        const body = document.querySelector('.summary-card-body:not(#zoomSummaryBody)');
        return body && window.getComputedStyle(body).display !== 'none';
      }));

    check('In-person: Zoom summary hidden',
      await page.evaluate(() => {
        const zb = document.getElementById('zoomSummaryBody');
        return !zb || window.getComputedStyle(zb).display === 'none';
      }));

    // ---- 5. Back to Start then Zoom mode ----
    console.log('\n--- 5. Zoom mode ---');
    await page.click('#backToStart');
    await page.waitForTimeout(200);

    await page.fill('#landingStaff', 'Zoom Tester');
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      const btns = document.querySelectorAll('.mode-btn');
      btns.forEach(b => b.classList.remove('active'));
      btns[1].classList.add('active');
    });
    await page.waitForTimeout(50);
    await page.click('#landingContinue');
    await page.waitForTimeout(300);

    check('Zoom: .app has show-zoom',
      await page.evaluate(() => document.querySelector('.app').className.indexOf('show-zoom') >= 0));

    check('Zoom: Section 2 exists', await page.evaluate(() => !!document.getElementById('firstConsultSection')));
    check('Zoom: Section 3 exists', await page.evaluate(() => !!document.getElementById('clientReviewSection')));
    check('Zoom: Section 4 exists', await page.evaluate(() => !!document.getElementById('zoomOutputsSection')));
    check('Zoom: Section 5 exists', await page.evaluate(() => !!document.getElementById('zoomAttachmentsSection')));

    check('Zoom: Section 2 visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('firstConsultSection')).display !== 'none'));
    check('Zoom: Section 3 visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('clientReviewSection')).display !== 'none'));
    check('Zoom: Section 4 visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('zoomOutputsSection')).display !== 'none'));
    check('Zoom: Section 5 visible',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('zoomAttachmentsSection')).display !== 'none'));

    check('Zoom: EOI hidden',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('eoiDetailsCard')).display === 'none'));
    check('Zoom: IA hidden',
      await page.evaluate(() => window.getComputedStyle(document.getElementById('iaDetailsCard')).display === 'none'));

    // ---- 6. Zoom summary ----
    console.log('\n--- 6. Zoom summary ---');
    check('Zoom: Summary shows zoom columns',
      await page.evaluate(() => {
        const zb = document.getElementById('zoomSummaryBody');
        return zb && window.getComputedStyle(zb).display !== 'none';
      }));

    check('Zoom: In-person summary hidden',
      await page.evaluate(() => {
        const body = document.querySelector('.summary-card-body:not(#zoomSummaryBody)');
        return body && window.getComputedStyle(body).display === 'none';
      }));

    check('Zoom summary: Staff name',
      await page.evaluate(() => document.getElementById('zoomSumStaff').textContent === 'Zoom Tester'));

    // ---- 7. Zoom field existence ----
    console.log('\n--- 7. Zoom fields ---');
    const fieldIds = [
      'firstConsultGoalType', 'firstConsultAnnualIncome', 'firstConsultSavings', 'firstConsultNotes',
      'clientReviewStrategy', 'clientReviewBuilder', 'clientReviewDeveloper', 'clientReviewBroker',
      'clientReviewConveyancer', 'clientReviewProperty', 'clientReviewTimeline', 'clientReviewNextActions',
      'zoomIncludeStandardEOI', 'zoomIncludeLaVidaEOI', 'zoomIncludeIA'
    ];
    for (const id of fieldIds) {
      check('Field: ' + id,
        await page.evaluate(function(fid) {
          // For radio button names, check by name
          if (fid === 'firstConsultGoalType') return !!document.querySelector('input[name="firstConsultGoalType"]');
          return !!document.getElementById(fid);
        }, id));
    }

    check('Builder dropdown has options',
      await page.evaluate(() => document.getElementById('clientReviewBuilder').options.length > 1));
    check('Developer dropdown has options',
      await page.evaluate(() => document.getElementById('clientReviewDeveloper').options.length > 1));
    check('Timeline dropdown has options',
      await page.evaluate(() => document.getElementById('clientReviewTimeline').options.length > 1));

    // ---- 8. Fill fields ----
    console.log('\n--- 8. Fill fields ---');
    await page.evaluate(() => {
      const goal = document.querySelector('input[name="firstConsultGoalType"][value="investment"]');
      if (goal) goal.checked = true;
    });
    await page.fill('#firstConsultAnnualIncome', '$120,000');
    await page.fill('#firstConsultSavings', '$50,000');
    await page.fill('#firstConsultNotes', 'Test consultation notes');
    await page.fill('#clientReviewStrategy', 'Buy and hold strategy');
    await page.selectOption('#clientReviewBuilder', 'Metricon');
    await page.selectOption('#clientReviewDeveloper', 'Oliver Hume');
    await page.fill('#clientReviewProperty', '123 Example St, Sydney');
    await page.selectOption('#clientReviewTimeline', '3-6 months');
    await page.fill('#clientReviewNextActions', 'Send documents');
    await page.evaluate(() => {
      document.getElementById('zoomIncludeStandardEOI').checked = true;
      document.getElementById('zoomIncludeIA').checked = true;
    });
    await page.waitForTimeout(200);

    // ---- 9. Draft save/load (via evaluate to bypass landing overlay) ----
    console.log('\n--- 9. Draft save/load ---');
    await page.evaluate(() => document.getElementById('saveDraft').click());
    await page.waitForTimeout(300);

    const draftData = await page.evaluate(() => {
      const raw = localStorage.getItem('salesAppointmentDraft');
      return raw ? JSON.parse(raw) : null;
    });
    check('Draft saved', !!draftData);
    check('Draft appointmentMode=zoom', draftData && draftData.appointmentMode === 'zoom');
    check('Draft firstConsultNotes', draftData && draftData.firstConsultNotes === 'Test consultation notes');
    check('Draft clientReviewBuilder=Metricon', draftData && draftData.clientReviewBuilder === 'Metricon');
    check('Draft clientReviewDeveloper=Oliver Hume', draftData && draftData.clientReviewDeveloper === 'Oliver Hume');
    check('Draft clientReviewStrategy', draftData && draftData.clientReviewStrategy === 'Buy and hold strategy');
    check('Draft clientReviewProperty', draftData && draftData.clientReviewProperty === '123 Example St, Sydney');
    check('Draft zoomIncludeStandardEOI=true', draftData && draftData.zoomIncludeStandardEOI === true);
    check('Draft zoomIncludeIA=true', draftData && draftData.zoomIncludeIA === true);

    // Load draft on fresh page (navigate through landing first since button is covered)
    const page2 = await context.newPage();
    await page2.goto(baseUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page2.waitForTimeout(1000);

    // Need to dismiss landing first (the loadDraft button is behind it)
    await page2.fill('#landingStaff', 'Draft Loader');
    await page2.waitForTimeout(100);
    await page2.evaluate(() => {
      document.querySelectorAll('.mode-btn')[0].classList.add('active');
      document.querySelectorAll('.mode-btn')[1].classList.remove('active');
    });
    await page2.click('#landingContinue');
    await page2.waitForTimeout(300);

    // Now load draft via evaluate (the loadDraft button is in the toolbar)
    await page2.evaluate(() => document.getElementById('loadDraft').click());
    await page2.waitForTimeout(1000);

    const loadedState = await page2.evaluate(() => {
      const app = document.querySelector('.app');
      return {
        isZoom: app.className.indexOf('show-zoom') >= 0,
        builder: document.getElementById('clientReviewBuilder').value,
        strategy: document.getElementById('clientReviewStrategy').value,
        notes: document.getElementById('firstConsultNotes').value,
        property: document.getElementById('clientReviewProperty').value,
        stdEOI: document.getElementById('zoomIncludeStandardEOI').checked,
        zoomIA: document.getElementById('zoomIncludeIA').checked,
        income: document.getElementById('firstConsultAnnualIncome').value
      };
    });
    check('Draft load: zoom mode restored', loadedState.isZoom);
    check('Draft load: builder restored', loadedState.builder === 'Metricon');
    check('Draft load: strategy restored', loadedState.strategy === 'Buy and hold strategy');
    check('Draft load: notes restored', loadedState.notes === 'Test consultation notes');
    check('Draft load: property restored', loadedState.property === '123 Example St, Sydney');
    check('Draft load: stdEOI restored', loadedState.stdEOI);
    check('Draft load: IA restored', loadedState.zoomIA);
    check('Draft load: income restored', loadedState.income === '$120,000');

    // ---- 10. Legacy draft ----
    console.log('\n--- 10. Legacy draft ---');
    // Set a legacy draft via evaluate
    await page2.evaluate(() => {
      localStorage.setItem('salesAppointmentDraft', JSON.stringify({
        teamMember: 'Legacy User', clientName: 'Old Client', date: '01/01/2026'
      }));
    });
    await page2.evaluate(() => document.getElementById('loadDraft').click());
    await page2.waitForTimeout(1000);

    const legacyState = await page2.evaluate(() => {
      return {
        isInPerson: document.querySelector('.app').className.indexOf('show-in-person') >= 0,
        teamMember: document.getElementById('teamMember').value
      };
    });
    check('Legacy draft: loads as show-in-person', legacyState.isInPerson);
    check('Legacy draft: teamMember restored', legacyState.teamMember === 'Legacy User');

    // ---- 11. New Appointment ----
    console.log('\n--- 11. New Appointment ---');
    page2.once('dialog', async (dialog) => { await dialog.accept(); });
    await page2.evaluate(() => document.getElementById('resetForm').click());
    await page2.waitForTimeout(500);

    const afterReset = await page2.evaluate(() => {
      const ls = document.getElementById('landingScreen');
      return {
        landingHidden: ls.classList.contains('hidden'),
        staffVal: document.getElementById('landingStaff').value,
        continueDisabled: document.getElementById('landingContinue').disabled
      };
    });
    check('New Appointment: shows landing', !afterReset.landingHidden);
    check('New Appointment: clears staff', afterReset.staffVal === '');
    check('New Appointment: disables Continue', afterReset.continueDisabled);

    // ---- 12. Back to Start ----
    console.log('\n--- 12. Back to Start ---');
    // Use page (still has zoom data) 
    await page.evaluate(() => document.getElementById('backToStart').click());
    await page.waitForTimeout(200);

    const backState = await page.evaluate(() => {
      return {
        landingVisible: !document.getElementById('landingScreen').classList.contains('hidden'),
        backHidden: document.getElementById('backToStart').style.display === 'none'
      };
    });
    check('Back to Start: landing visible', backState.landingVisible);
    check('Back to Start: back button hidden', backState.backHidden);

    // ---- Summary ----
    console.log('\n===========================');
    console.log('Phase 2 smoke test: ' + (pass + fail) + ' total, ' + pass + ' passed, ' + fail + ' failed');
    console.log('===========================');

    await browser.close();
  } finally {
    server.close();
    process.exit(fail > 0 ? 1 : 0);
  }
});
