const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  let pass = 0, fail = 0;
  function check(name, ok, detail) {
    if (ok) { pass++; console.log('  \u2705 ' + name); }
    else { fail++; console.log('  \u274C ' + name + (detail ? ': ' + detail : '')); }
  }

  const filePath = 'file://' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'load', timeout: 15000 }).catch(e => console.log('Goto warning:', e.message));
  await page.waitForTimeout(2000);

  // ---- 1. Fresh load shows landing screen ----
  console.log('\n--- 1. Landing screen on fresh load ---');
  const landingVisible = await page.evaluate(() => {
    const ls = document.getElementById('landingScreen');
    if (!ls) return 'missing';
    return !ls.classList.contains('hidden') && window.getComputedStyle(ls).display !== 'none';
  });
  check('Landing screen visible on fresh load', landingVisible === true);

  // ---- 2. Staff input exists ----
  console.log('\n--- 2. Staff input ---');
  const staffInputExists = await page.evaluate(() => {
    return document.getElementById('landingStaff') !== null;
  });
  check('landingStaff element exists', staffInputExists);

  // ---- 3. Continue disabled until staff selected, then enabled ----
  console.log('\n--- 3. Continue button validation ---');
  const continueDisabled = await page.evaluate(() => {
    const btn = document.getElementById('landingContinue');
    return btn && btn.disabled;
  });
  check('Continue disabled when staff empty', continueDisabled);

  // Use Playwright fill (which triggers real input events)
  await page.fill('#landingStaff', 'Test User');
  await page.waitForTimeout(200);

  const continueEnabled = await page.evaluate(() => {
    const btn = document.getElementById('landingContinue');
    return btn && !btn.disabled;
  });
  check('Continue enabled after staff entered', continueEnabled);

  // ---- 4. In-person Continue ----
  console.log('\n--- 4. In-person mode Continue ---');
  await page.evaluate(() => {
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (btns[0]) btns[0].classList.add('active');
  });
  await page.waitForTimeout(100);

  await page.click('#landingContinue');
  await page.waitForTimeout(300);

  const landingHidden = await page.evaluate(() => {
    const ls = document.getElementById('landingScreen');
    return ls && ls.classList.contains('hidden');
  });
  check('Landing hidden after Continue', landingHidden);

  const teamMemberFilled = await page.evaluate(() => {
    const el = document.getElementById('teamMember');
    return el && el.value === 'Test User';
  });
  check('teamMember field populated', teamMemberFilled);

  const appClass = await page.evaluate(() => {
    const app = document.querySelector('.app');
    return app ? app.className : '';
  });
  check('.app has show-in-person class', appClass.indexOf('show-in-person') >= 0);

  const backBtnVisible = await page.evaluate(() => {
    const btn = document.getElementById('backToStart');
    return btn && btn.style.display !== 'none';
  });
  check('Back to Start button visible', backBtnVisible);

  // ---- 5. Back to Start ----
  console.log('\n--- 5. Back to Start ---');
  await page.click('#backToStart');
  await page.waitForTimeout(300);

  const landingShownAgain = await page.evaluate(() => {
    const ls = document.getElementById('landingScreen');
    return ls && !ls.classList.contains('hidden');
  });
  check('Landing shown after Back to Start', landingShownAgain);

  const backHidden = await page.evaluate(() => {
    const btn = document.getElementById('backToStart');
    return btn && btn.style.display === 'none';
  });
  check('Back button hidden after going back', backHidden);

  // ---- 6. Zoom mode Continue ----
  console.log('\n--- 6. Zoom mode ---');
  await page.fill('#landingStaff', 'Zoom User');
  await page.waitForTimeout(100);

  await page.evaluate(() => {
    const btns = document.querySelectorAll('.mode-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (btns[1]) btns[1].classList.add('active');
  });
  await page.waitForTimeout(100);

  await page.click('#landingContinue');
  await page.waitForTimeout(300);

  const zoomClass = await page.evaluate(() => {
    const app = document.querySelector('.app');
    return app ? app.className : '';
  });
  check('.app has show-zoom class for zoom mode', zoomClass.indexOf('show-zoom') >= 0);

  const zoomCardVisible = await page.evaluate(() => {
    const card = document.getElementById('zoomPlaceholderCard');
    if (!card) return false;
    const style = window.getComputedStyle(card);
    return style.display !== 'none';
  });
  check('Zoom placeholder card visible', zoomCardVisible);

  const inPersonCardsHidden = await page.evaluate(() => {
    const card = document.getElementById('iaDetailsCard');
    if (!card) return true;
    const style = window.getComputedStyle(card);
    return style.display === 'none';
  });
  check('In-person cards hidden in zoom mode', inPersonCardsHidden);

  // ---- 7. Draft save/load with appointmentMode ----
  console.log('\n--- 7. Draft save/load ---');
  await page.click('#saveDraft');
  await page.waitForTimeout(300);

  // Verify draft has appointmentMode in localStorage
  const draftHasMode = await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('salesAppointmentDraft');
      if (!raw) return 'no draft';
      const data = JSON.parse(raw);
      return data.appointmentMode === 'zoom';
    } catch(e) { return 'error: ' + e.message; }
  });
  check('Draft saved with appointmentMode=zoom', draftHasMode === true);

  // Load the draft
  await page.click('#loadDraft');
  await page.waitForTimeout(500);

  const afterDraftLoad = await page.evaluate(() => {
    const app = document.querySelector('.app');
    return app ? app.className : '';
  });
  check('Draft preserves zoom mode after load', afterDraftLoad.indexOf('show-zoom') >= 0);

  // ---- 8. Legacy draft (without appointmentMode) loads as inPerson ----
  console.log('\n--- 8. Legacy draft compatibility ---');
  await page.evaluate(() => {
    const draft = {
      teamMember: 'Legacy User',
      clientName: 'Old Client',
      date: '01/01/2026'
    };
    localStorage.setItem('salesAppointmentDraft', JSON.stringify(draft));
  });
  await page.waitForTimeout(100);
  await page.click('#loadDraft');
  await page.waitForTimeout(500);

  const legacyMode = await page.evaluate(() => {
    const app = document.querySelector('.app');
    const staff = document.getElementById('teamMember');
    return {
      appClass: app ? app.className : '',
      teamMemberValue: staff ? staff.value : ''
    };
  });
  check('Legacy draft loads as show-in-person', legacyMode.appClass.indexOf('show-in-person') >= 0);
  check('Legacy draft populates teamMember', legacyMode.teamMemberValue === 'Legacy User');

  // ---- 9. New Appointment returns to landing ----
  console.log('\n--- 9. New Appointment ---');
  // Accept confirm dialog
  page.once('dialog', async (dialog) => {
    await dialog.accept();
  });
  await page.click('#resetForm');
  await page.waitForTimeout(500);

  const afterReset = await page.evaluate(() => {
    const ls = document.getElementById('landingScreen');
    const app = document.querySelector('.app');
    const staffInput = document.getElementById('landingStaff');
    const contBtn = document.getElementById('landingContinue');
    return {
      landingHidden: ls ? ls.classList.contains('hidden') : false,
      landingDisplay: ls ? window.getComputedStyle(ls).display : '',
      appClass: app ? app.className : '',
      staffVal: staffInput ? staffInput.value : '',
      continueDisabled: contBtn ? contBtn.disabled : true
    };
  });
  check('New Appointment shows landing', !afterReset.landingHidden);
  check('New Appointment has no mode class on .app',
    afterReset.appClass.indexOf('show-in-person') < 0 && afterReset.appClass.indexOf('show-zoom') < 0);
  check('New Appointment clears landing staff', afterReset.staffVal === '');
  check('New Appointment disables Continue', afterReset.continueDisabled);

  // ---- Summary ----
  console.log('\n===========================');
  console.log('Tests: ' + (pass + fail) + ' total, ' + pass + ' passed, ' + fail + ' failed');
  console.log('===========================');

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
