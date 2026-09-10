/**
 * Waiver & Disclosure Only workflow tests.
 *
 * Verifies the standalone waiver presentation layer, validation scope,
 * Client 2 optional toggle, PDF-only Ready state, and regressions for
 * the In-Person and Zoom timelines.
 *
 * Run: npx vitest run tests/waiver-only-workflow.test.mjs
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const baseURL = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch({ headless:true });

function installSafeHooks(context, errors){
  errors.length = 0;
  context.addInitScript(() => { window.confirm = () => true; });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
}

async function startWaiverOnly(page){
  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-waiver', { timeout:5000 });
  await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
}

async function drawOnPad(page, selector){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 10 && box.height > 10, `${selector} must be visible`);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
}

function visibleQuery(page, selector){
  return page.evaluate(sel => {
    const el = document.querySelector(sel);
    if(!el) return false;
    if(el.hasAttribute('hidden')) return false;
    const style = getComputedStyle(el);
    if(style.display === 'none' || style.visibility === 'hidden') return false;
    return el.offsetParent !== null || el.getBoundingClientRect().height > 0;
  }, selector);
}

function fieldErrorData(page){
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.fieldError'))
      .map(e => String(e.getAttribute('data-field') || ''))
  );
}

test('waiver-only standalone presentation (header, timeline, hidden appointment UI)', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await startWaiverOnly(page);

  assert.equal(await page.textContent('#brandTitle'), 'Waiver & Disclosure', 'header brand title is waiver-specific');
  assert.ok(await visibleQuery(page, '#brandSubtitle'), 'waiver subtitle visible');
  assert.ok((await page.textContent('#brandSubtitle')).includes('Complete, sign and download the Waiver & Disclosure'));

  /* Timeline: appointment timelines hidden, 3-step waiver timeline visible */
  assert.equal(await visibleQuery(page, '#timelineInPerson'), false, 'in-person timeline hidden');
  assert.equal(await visibleQuery(page, '#timelineZoom'), false, 'zoom timeline hidden');
  assert.ok(await visibleQuery(page, '#timelineWaiver'), 'waiver timeline visible');
  const waiverSteps = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#timelineWaiver .timeline-step .tl-label')).map(el => el.textContent.trim()));
  assert.deepEqual(waiverSteps, ['Client Details', 'Waiver & Disclosure', 'Ready'], 'waiver timeline has 3 steps in order');

  /* Appointment-only UI all hidden */
  assert.equal(await visibleQuery(page, '#appointmentSummaryCard'), false, 'appointment summary card hidden');
  assert.equal(await visibleQuery(page, '#eoiDetailsCard'), false, 'EOI card hidden');
  assert.equal(await visibleQuery(page, '#iaDetailsCard'), false, 'IA card hidden');
  assert.equal(await visibleQuery(page, '#clientIdSection'), false, 'client ID section hidden');
  assert.equal(await visibleQuery(page, '#signaturesSection'), false, 'signatures section hidden');
  assert.equal(await visibleQuery(page, '#checklistCard'), false, 'checklist card hidden');
  assert.equal(await visibleQuery(page, '.previewWrap'), false, 'output preview hidden');
  assert.equal(await visibleQuery(page, '#appointmentInfoSection .appointment-only'), false, 'date/team member row hidden');
  assert.equal(await visibleQuery(page, '#appointmentInfoSection .in-person-only'), false, 'EOI/IA/Waiver checkboxes hidden');

  /* Legacy output actions hidden */
  assert.equal(await visibleQuery(page, '#downloadTop, #downloadBottom, #downloadPackageTop, #downloadPackageBottom, #shareTop, #shareBottom, #sharePackage'), false, 'legacy output actions hidden');

  /* Action labels */
  assert.equal(await page.textContent('#generateTop'), 'Create Waiver PDF', 'primary generate label');
  assert.equal(await page.textContent('#downloadPackage'), 'Download PDF', 'ready download label');

  /* Client 2 toggle initially off and fields hidden; toggling on exposes them */
  assert.equal(await visibleQuery(page, '#client2Fields'), false, 'client 2 fields hidden when toggle off');
  assert.equal(await page.evaluate(() => document.getElementById('waiverClient2Toggle').checked), false, 'client 2 toggle unchecked by default');
  await page.check('#waiverClient2Toggle');
  assert.ok(await visibleQuery(page, '#client2Fields'), 'client 2 fields revealed after toggle');

  assert.deepEqual(errors, [], 'no page errors in waiver-only presentation');
  await context.close();
  console.log('PASS waiver-only standalone presentation');
});

test('waiver-only validation requires client + waiver items only (no appointment fields)', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await startWaiverOnly(page);

  /* Empty form: client name + waiver client 1 name get field flags; appointment fields never required */
  await page.click('#generateTop');
  let ids = await fieldErrorData(page);
  assert.deepEqual(ids, ['clientName'], 'client name flagged first');
  assert.deepEqual(ids.filter(id => ['date','teamMember','contractDueDate'].includes(id)), [],
    'appointment date/team member/contract due date never flagged in waiver mode');
  assert.match(await page.textContent('#status'), /Complete 2 required items before generating\./, 'status lists remaining waiver items');

  /* Client name is copied to waiver name; only the drawn signature remains, via status (no field element) */
  await page.fill('#clientName', 'Fictional Test Client');
  await page.click('#generateTop');
  ids = await fieldErrorData(page);
  assert.deepEqual(ids, [], 'remaining requirement (waiver signature) has no form field');
  assert.deepEqual(ids.filter(id => ['date','teamMember','contractDueDate'].includes(id)), [],
    'appointment fields still not required in waiver mode');
  assert.match(await page.textContent('#status'), /Complete 1 required item before generating\./, 'waiver signature still required');

  /* Timeline Ready step drives the same validation */
  await page.click('#timelineWaiver .tl-step-btn[data-tl-target="footerBar"]');
  ids = await fieldErrorData(page);
  assert.deepEqual(ids, [], 'ready step keeps validation appointment-free (no field errors)');
  assert.deepEqual(ids.filter(id => ['date','teamMember','contractDueDate'].includes(id)), [],
    'ready step never flags appointment fields');
  assert.match(await page.textContent('#status'), /Complete 1 required item before generating\./, 'ready step still requires waiver signature');

  assert.deepEqual(errors, [], 'no page errors during waiver validation');
  await context.close();
  console.log('PASS waiver-only validation scope');
});

test('waiver-only ready flow: Client 2 optional, PDF ready state, no ZIP controls', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await startWaiverOnly(page);

  /* Client 2 off — Client 1 only should reach Ready */
  await page.fill('#clientName', 'Fictional Test Client');
  await drawOnPad(page, '#signature');
  await page.waitForFunction(() => {
    const el = document.getElementById('waiverClient1Date');
    return el && /^\d{2}\/\d{2}\/\d{4}$/.test(el.value);
  }, null, { timeout:5000 });

  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:60000 });
  assert.equal(await page.textContent('#appointmentPackageReadyTitle'), 'Waiver & Disclosure Ready', 'ready title is waiver-specific');
  assert.ok(await visibleQuery(page, '#downloadPackage'), 'Download PDF action visible');
  assert.ok(await visibleQuery(page, '#preparePackageEmail'), 'Prepare Email action visible');
  assert.equal(await visibleQuery(page, '#saveCombinedPdf'), false, 'Save Combined PDF hidden in waiver');
  assert.equal(await visibleQuery(page, '#savePackageZip'), false, 'Save ZIP hidden in waiver');
  assert.equal(await visibleQuery(page, '#packageReadyZipRow'), false, 'ZIP row hidden in waiver');
  const pdfName = await page.textContent('#packageReadyPdfName');
  assert.match(pdfName, /\.pdf$/i, 'package filename exposed');

  /* Download PDF action produces a valid single PDF */
  const downloadPromise = page.waitForEvent('download', { timeout:15000 });
  await page.click('#downloadPackage');
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.pdf$/i, 'downloaded filename is a PDF');
  const hash = await download.createReadStream().then(stream => new Promise((res, rej) => {
    const digest = createHash('sha256');
    stream.on('data', d => digest.update(d));
    stream.on('end', () => res(digest.digest('hex')));
    stream.on('error', rej);
  }));
  assert.ok(hash, 'downloaded PDF has content');

  assert.deepEqual(errors, [], 'no page errors during waiver ready flow');
  await context.close();
  console.log('PASS waiver-only ready flow');
});

test('waiver-only Client 2 enforced once enabled', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await startWaiverOnly(page);

  await page.fill('#clientName', 'Fictional Test Client');
  await drawOnPad(page, '#signature');
  await page.check('#waiverClient2Toggle');
  await page.fill('#client2Name', 'Fictional Test Client Two');
  await page.evaluate(() => { document.getElementById('client2Name').dispatchEvent(new Event('change', { bubbles:true })); });
  await drawOnPad(page, '#signature2');

  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:60000 });
  assert.equal(await page.textContent('#appointmentPackageReadyTitle'), 'Waiver & Disclosure Ready', 'both clients signed reaches ready');
  await page.click('#backToStart');

  assert.deepEqual(errors, [], 'no page errors with Client 2 enabled');
  await context.close();
  console.log('PASS waiver-only Client 2 enforced');
});

test('regression: in-person and zoom timelines and waiver toggles unchanged', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();

  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="inPerson"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-in-person', { timeout:5000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:5000 });

  assert.ok(await visibleQuery(page, '#timelineInPerson'), 'in-person timeline visible');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#timelineInPerson .timeline-step').length), 8, 'in-person timeline has 8 steps');
  assert.ok(await visibleQuery(page, '#appointmentSummaryCard'), 'summary card visible for in-person');
  assert.ok(await visibleQuery(page, '.previewWrap'), 'preview visible for in-person');
  assert.equal(await page.textContent('#generateTop'), 'Generate Appointment Package', 'in-person generate label unchanged');
  assert.equal(await visibleQuery(page, '#includeWaiver'), true, 'waiver toggle present for in-person');
  assert.equal(await page.textContent('#brandTitle'), 'Client Appointment Checklist', 'header brand title in-person');

  await page.click('#backToStart');
  await page.click('.mode-card[data-mode="zoom"]');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-zoom', { timeout:5000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:5000 });
  assert.ok(await visibleQuery(page, '#timelineZoom'), 'zoom timeline visible');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#timelineZoom .timeline-step').length), 9, 'zoom timeline has 9 steps');
  assert.equal(await visibleQuery(page, '#zoomIncludeWaiver'), true, 'waiver toggle present for zoom');

  assert.deepEqual(errors, [], 'no page errors in regression modes');
  await context.close();
  console.log('PASS in-person/zoom regression');
});

function syntheticDraw(page, selector){
  return page.evaluate(sel => {
    const pad = document.getElementById(String(sel).replace(/^#/, ''));
    const rect = pad.getBoundingClientRect();
    const base = { bubbles:true, cancelable:true, pointerId:12, pointerType:'touch',
      clientX:rect.left + rect.width * 0.2, clientY:rect.top + rect.height * 0.5 };
    pad.dispatchEvent(new PointerEvent('pointerdown', base));
    pad.dispatchEvent(new PointerEvent('pointermove', { ...base, clientX:rect.left + rect.width * 0.8 }));
    pad.dispatchEvent(new PointerEvent('pointerup', base));
  }, selector);
}

test('waiver-only mobile: no horizontal overflow, 44px touch targets, ready actions usable', async () => {
  const context = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  context.addInitScript(() => { Element.prototype.setPointerCapture = function(){}; });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await startWaiverOnly(page);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, 'no horizontal overflow on mobile');

  const preReadyUnder = await page.evaluate(() => {
    const targets = ['#generateTop', '#backToStart'];
    return targets.map(sel => {
      const el = document.querySelector(sel);
      if(!el) return { sel, missing:true };
      const r = el.getBoundingClientRect();
      return { sel, w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(t => t.missing || t.w < 44 || t.h < 44);
  });
  assert.deepEqual(preReadyUnder, [], 'always-visible primary actions are at least 44x44px');

  /* Complete the waiver on mobile and verify Ready actions are tappable-sized */
  await page.fill('#clientName', 'Fictional Test Client');
  await syntheticDraw(page, '#signature');
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:60000 });

  const readyUnder = await page.evaluate(() => {
    const targets = ['#downloadPackage', '#preparePackageEmail'];
    return targets.map(sel => {
      const el = document.querySelector(sel);
      if(!el) return { sel, missing:true };
      const r = el.getBoundingClientRect();
      return { sel, w: Math.round(r.width), h: Math.round(r.height) };
    }).filter(t => t.missing || t.w < 44 || t.h < 44);
  });
  assert.deepEqual(readyUnder, [], 'ready actions are at least 44x44px');

  assert.deepEqual(errors, [], 'no page errors on mobile');
  await context.close();
  console.log('PASS waiver-only mobile');
});

afterAll(async () => {
  await browser.close();
  server.close();
});

console.log('\nAll waiver-only workflow tests PASSED');
