const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const s = http.createServer((req, res) => {
  const fp = path.join(__dirname, '..', req.url === '/' ? 'index.html' : req.url);
  res.setHeader('Cache-Control','no-store');
  res.writeHead(200);
  fs.readFile(fp, (e, d) => { if (e) { res.writeHead(404); res.end(''); return; } res.end(d); });
});

s.listen(0, async () => {
  const port = s.address().port;
  const b = await chromium.launch({headless:true});

  // Save draft with Perth + IA
  const p1 = await b.newPage();
  const errs = [];
  p1.on('pageerror', e => errs.push(e.message));
  p1.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });

  await p1.goto('http://localhost:' + port, {waitUntil:'networkidle',timeout:15000});
  await p1.waitForTimeout(1000);
  await p1.fill('#landingStaff','T');
  await p1.evaluate(() => { document.querySelectorAll('.mode-btn')[1].classList.add('active'); document.querySelectorAll('.mode-btn')[0].classList.remove('active'); });
  await p1.click('#landingContinue'); await p1.waitForTimeout(300);
  await p1.fill('#clientName','Test'); await p1.fill('#date','01/01/2026');
  await p1.fill('#firstConsultNotes','N'); await p1.fill('#clientReviewStrategy','Strategy text');
  await p1.evaluate(() => {
    document.getElementById('zoomIncludeStandardEOI').checked = true;
    document.getElementById('zoomIncludeStandardEOI').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomIncludeIA').checked = true;
    document.getElementById('zoomIncludeIA').dispatchEvent(new Event('change', {bubbles:true}));
    document.getElementById('zoomFirstConsultTemplate').value = 'perth';
    document.getElementById('zoomFirstConsultTemplate').dispatchEvent(new Event('change', {bubbles:true}));
  });
  await p1.waitForTimeout(100);
  await p1.evaluate(() => document.getElementById('saveDraft').click());
  await p1.waitForTimeout(300);

  // Verify draft
  const draft = await p1.evaluate(() => { const r = localStorage.getItem('salesAppointmentDraft'); return r ? JSON.parse(r) : null; });
  console.log('Draft:', JSON.stringify({template:draft.zoomFirstConsultTemplate, ia:draft.zoomIncludeIA, strategy:draft.clientReviewStrategy}));

  // Load on fresh page 
  const p2 = await b.newPage();
  const errs2 = [];
  p2.on('pageerror', e => errs2.push(e.message));
  p2.on('console', msg => { if (msg.type() === 'error') errs2.push('CONSOLE: ' + msg.text()); });

  await p2.goto('http://localhost:' + port, {waitUntil:'networkidle',timeout:15000});
  await p2.waitForTimeout(1000);
  await p2.fill('#landingStaff','T');
  await p2.evaluate(() => { document.querySelectorAll('.mode-btn')[1].classList.add('active'); document.querySelectorAll('.mode-btn')[0].classList.remove('active'); });
  await p2.click('#landingContinue'); await p2.waitForTimeout(300);

  console.log('Before loadDraft, template:', await p2.evaluate(() => document.getElementById('zoomFirstConsultTemplate').value));
  console.log('Errors before:', errs2.length ? errs2 : 'none');

  // Click loadDraft
  await p2.evaluate(() => document.getElementById('loadDraft').click());
  await p2.waitForTimeout(2000);

  const after = await p2.evaluate(() => {
    return {
      template: document.getElementById('zoomFirstConsultTemplate').value,
      ia: document.getElementById('zoomIncludeIA').checked,
      strategy: document.getElementById('clientReviewStrategy').value
    };
  });
  console.log('After loadDraft:', JSON.stringify(after));
  console.log('Errors after:', errs2.length ? errs2 : 'none');

  await b.close(); s.close(); process.exit(0);
});
