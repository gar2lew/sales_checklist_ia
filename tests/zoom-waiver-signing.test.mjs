/*
 * Zoom + waiver signing exposure (release-blocker GUI fix).
 *
 * When "Include Waiver & Disclosure" is enabled in the Zoom workflow, the
 * shared signature pads (#signature / #signature2) must be relocated into the
 * waiver stage's #waiverPadsHost so they are genuinely visible and signable.
 * With the waiver OFF, the Zoom layout must remain unchanged (no signature UI,
 * pads stay inside the hidden in-person-only #sigPadsHost).
 *
 * Run: npx vitest run tests/zoom-waiver-signing.test.mjs
 */

import assert from 'node:assert/strict';
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

const CLIENT_1 = 'John Smith';
const CLIENT_2 = 'Jane Smith';
const DATE = '25/08/2026';

const todayDDMMYYYY = (() => {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  return pad(now.getDate()) + '/' + pad(now.getMonth() + 1) + '/' + now.getFullYear();
})();

const browser = await chromium.launch({ headless:true });

function installSafeHooks(context, errors){
  errors.length = 0;
  context.addInitScript(() => { window.confirm = () => true; });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
}

async function enterZoom(page){
  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-zoom', { timeout:10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:10000 });
}

async function fillSharedAppointment(page){
  await page.fill('#date', DATE);
  await page.selectOption('#teamMember', { label:'Garry Lewis' });
  await page.fill('#clientName', CLIENT_1);
  await page.evaluate(() => {
    const el = document.getElementById('contractDueDateTbc');
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
}

async function enableZoomWaiver(page){
  await page.check('#zoomIncludeWaiver');
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:10000 });
}

async function drawOnPad(page, selector){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 10 && box.height > 10, `${selector} must be visible and sizable`);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
}

function structuredReadiness(page){
  return page.evaluate(() => window._testState.structuredReadinessCheck());
}

function padLayout(page){
  return page.evaluate(() => ({
    sigChildren: document.getElementById('sigPadsHost').childElementCount,
    waiverChildren: document.getElementById('waiverPadsHost').childElementCount,
    completeCount: document.querySelectorAll('#signature').length + document.querySelectorAll('#signature2').length,
    signatureHost: document.getElementById('signature').closest('#waiverPadsHost') ? 'waiverPadsHost' : (document.getElementById('signature').closest('#sigPadsHost') ? 'sigPadsHost' : 'none'),
    signature2Host: document.getElementById('signature2').closest('#waiverPadsHost') ? 'waiverPadsHost' : (document.getElementById('signature2').closest('#sigPadsHost') ? 'sigPadsHost' : 'none'),
    waiverSectionDisplay: getComputedStyle(document.getElementById('waiverSignatureSection')).display,
    waiverStepNotRequired: document.querySelector('#timelineZoom [data-tl-target="waiverSignatureSection"]')?.closest('.timeline-step')?.classList.contains('tl-not-required'),
    zoomSteps: document.querySelectorAll('#timelineZoom li.timeline-step').length
  }));
}

function inkRatioFn(page, sel){
  return page.evaluate(sel => {
    const c = document.querySelector(sel);
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for(let i = 3; i < data.length; i += 4){ if(data[i] > 0) ink++; }
    return ink / (data.length / 4);
  }, sel);
}

test('zoom + waiver OFF: no signature UI in the Zoom flow, layout unchanged', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);

  const layout = await padLayout(page);
  assert.equal(layout.sigChildren, 2, 'pads remain in the in-person-only #sigPadsHost when waiver is OFF');
  assert.equal(layout.waiverChildren, 0, '#waiverPadsHost stays empty when waiver is OFF');
  assert.equal(layout.completeCount, 2, 'no duplicate signature canvases are ever created');
  assert.equal(layout.waiverSectionDisplay, 'none', 'waiver stage hidden when waiver is OFF');
  assert.equal(layout.waiverStepNotRequired, true, 'zoom waiver timeline step is greyed out when waiver is OFF');
  assert.equal(layout.zoomSteps, 9, 'existing 9-step Zoom timeline is preserved');
  assert.equal(await page.locator('#signature').isVisible(), false, 'signature pads are not visible in the Zoom flow when waiver is OFF');
  assert.ok(await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.width > 0), 'Zoom whiteboard remains present');
  assert.equal((await structuredReadiness(page)).ready, false, 'waiver is not required while OFF');
  assert.deepEqual(errors, [], 'no page errors in zoom without waiver');
  await context.close();
  console.log('PASS zoom + waiver OFF: no signature UI, layout unchanged');
});

test('zoom + waiver ON: signing stage revealed with shared pads relocated (no duplicates)', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);
  await enableZoomWaiver(page);

  const layout = await padLayout(page);
  assert.equal(layout.waiverChildren, 2, 'both pad wraps are relocated into #waiverPadsHost');
  assert.equal(layout.sigChildren, 0, 'pads are removed from the hidden #sigPadsHost');
  assert.equal(layout.completeCount, 2, 'the two shared canvases are not duplicated');
  assert.equal(layout.signatureHost, 'waiverPadsHost', '#signature lives inside the waiver stage');
  assert.equal(layout.signature2Host, 'waiverPadsHost', '#signature2 lives inside the waiver stage');
  assert.equal(layout.waiverSectionDisplay, 'block', 'waiver stage is shown in zoom + waiver');
  assert.equal(layout.waiverStepNotRequired, false, 'zoom waiver timeline step is active when included');

  const box = await page.locator('#signature').boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, `Client 1 pad is visibly sized (got ${JSON.stringify(box)})`);
  const box2 = await page.locator('#signature2').boundingBox();
  assert.ok(box2 && box2.width > 100 && box2.height > 100, 'Client 2 pad is visibly sized');
  assert.equal(await page.locator('#signaturesSection').isVisible(), false, 'in-person signatures section stays hidden in zoom');
  assert.deepEqual(errors, [], 'no page errors in zoom + waiver');
  await context.close();
  console.log('PASS zoom + waiver ON: stage revealed, pads relocated, unique canvases');
});

test('zoom + waiver ON: drawing, signing-date auto-fill, and validation gating for Client 1', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);
  await fillSharedAppointment(page);
  await enableZoomWaiver(page);

  let readiness = await structuredReadiness(page);
  assert.equal(readiness.ready, false, 'generation is gated while waiver fields are incomplete');
  const missingIds = readiness.items.map(item => item.id);
  assert.ok(missingIds.includes('waiverSignature1'), 'unsigned pad blocks readiness');
  assert.ok(!missingIds.includes('waiverClient1Name'), 'Client 1 waiver name is satisfied via the shared client name');

  await page.fill('#waiverClient1Name', CLIENT_1);
  await page.evaluate(() => {
    document.getElementById('waiverClient1Name').dispatchEvent(new Event('change', { bubbles:true }));
  });
  readiness = await structuredReadiness(page);
  assert.equal(readiness.ready, false, 'still gated until the signature is captured');
  assert.deepEqual(readiness.items.map(item => item.id), ['waiverSignature1'], 'only the missing signature remains');

  await drawOnPad(page, '#signature');
  await page.waitForFunction(() => {
    const el = document.getElementById('waiverClient1Date');
    return el && /^\d{2}\/\d{2}\/\d{4}$/.test(el.value);
  }, null, { timeout:5000 });
  assert.equal(await page.inputValue('#waiverClient1Date'), todayDDMMYYYY, 'Client 1 signing date auto-fills to today');
  assert.equal((await structuredReadiness(page)).ready, true, 'zoom + waiver + Client 1 becomes generation-ready');
  assert.deepEqual(errors, [], 'no page errors during zoom Client 1 signing');
  await context.close();
  console.log('PASS zoom + waiver ON: Client 1 draw, auto-date, readiness gating');
});

test('zoom + waiver toggle OFF returns pads and hides the stage symmetrically', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);
  await enableZoomWaiver(page);
  assert.equal((await padLayout(page)).waiverChildren, 2);

  await page.uncheck('#zoomIncludeWaiver');
  await page.waitForFunction(() => getComputedStyle(document.getElementById('waiverSignatureSection')).display === 'none');
  let layout = await padLayout(page);
  assert.equal(layout.waiverChildren, 0, 'host emptied when waiver toggled OFF');
  assert.equal(layout.sigChildren, 2, 'pads returned to the in-person-only host');
  assert.equal(await page.locator('#signature').isVisible(), false, 'signature UI not exposed once waiver is OFF');

  await page.check('#zoomIncludeWaiver');
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:10000 });
  layout = await padLayout(page);
  assert.equal(layout.waiverChildren, 2, 'pads relocate back into the waiver stage on re-enable');
  assert.equal(layout.sigChildren, 0, 'no leftovers in the in-person host');
  assert.equal(layout.completeCount, 2, 'no duplicate canvases across toggles');
  assert.deepEqual(errors, [], 'no page errors toggling the zoom waiver switch');
  await context.close();
  console.log('PASS zoom + waiver toggle OFF: symmetric relocation, no duplicates');
});

test('zoom + waiver ON: Client 2 signing block is revealed and gated', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);
  await fillSharedAppointment(page);
  await enableZoomWaiver(page);

  await page.fill('#waiverClient1Name', CLIENT_1);
  await page.evaluate(() => {
    document.getElementById('waiverClient1Name').dispatchEvent(new Event('change', { bubbles:true }));
  });
  await drawOnPad(page, '#signature');
  await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient1Date').value));

  await page.fill('#client2Name', CLIENT_2);
  await page.evaluate(() => {
    document.getElementById('client2Name').dispatchEvent(new Event('change', { bubbles:true }));
  });
  await page.waitForFunction(() => !document.getElementById('waiverClient2Block').classList.contains('hidden'));

  let readiness = await structuredReadiness(page);
  assert.equal(readiness.ready, false, 'Client 2 presence re-gates generation');
  const missingIds = readiness.items.map(item => item.id);
  assert.ok(missingIds.includes('waiverSignature2'), 'Client 2 signature required');
  assert.ok(!missingIds.includes('waiverClient2Name'), 'Client 2 waiver name is satisfied via #client2Name');
  assert.ok(!missingIds.includes('waiverClient2Date'), 'Client 2 signing date falls back to the appointment date until the live date auto-fills');

  await page.fill('#waiverClient2Name', CLIENT_2);
  await page.evaluate(() => {
    document.getElementById('waiverClient2Name').dispatchEvent(new Event('change', { bubbles:true }));
  });
  await drawOnPad(page, '#signature2');
  await page.waitForFunction(() => {
    const el = document.getElementById('waiverClient2Date');
    return el && /^\d{2}\/\d{2}\/\d{4}$/.test(el.value);
  }, null, { timeout:5000 });
  assert.equal(await page.inputValue('#waiverClient2Date'), todayDDMMYYYY, 'Client 2 signing date auto-fills to today');
  assert.equal((await structuredReadiness(page)).ready, true, 'zoom + waiver + both clients becomes generation-ready');
  assert.deepEqual(errors, [], 'no page errors during zoom Client 2 signing');
  await context.close();
  console.log('PASS zoom + waiver ON: Client 2 block, draw, auto-date, readiness');
});

test('zoom + waiver ON: draft save/reopen restores stage, signatures, and readiness', async () => {
  const context = await browser.newContext({ viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterZoom(page);
  await fillSharedAppointment(page);
  await enableZoomWaiver(page);

  await page.fill('#waiverClient1Name', CLIENT_1);
  await page.evaluate(() => {
    document.getElementById('waiverClient1Name').dispatchEvent(new Event('change', { bubbles:true }));
  });
  await drawOnPad(page, '#signature');
  await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient1Date').value));

  await page.evaluate(() => document.getElementById('saveDraft').click());
  await page.waitForFunction(() => {
    const el = document.getElementById('saveStatus');
    return el && el.textContent.trim() === 'Saved just now';
  }, null, { timeout:10000 });

  const saved = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('sales-appointment-capture', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return await new Promise((res, rej) => {
      const req = db.transaction('drafts', 'readonly').objectStore('drafts').get('active');
      req.onsuccess = () => { db.close(); res(req.result); };
      req.onerror = () => { db.close(); rej(req.error); };
    });
  });
  assert.equal(saved.draft.appointmentMode, 'zoom', 'zoom mode persisted');
  assert.equal(saved.draft.zoomIncludeWaiver, true, 'waiver inclusion persisted');
  assert.equal(saved.draft.waiverClient1Name, CLIENT_1, 'Client 1 waiver name persisted');
  assert.ok(String(saved.draft.signature).startsWith('data:image/png'), 'Client 1 signature persisted');

  await page.reload({ waitUntil:'networkidle' });
  await page.click('#resumeDraftBtn');
  await page.waitForFunction(() => document.documentElement.dataset.draftRestoreState === 'restored', null, { timeout:10000 });
  await page.waitForSelector(`.app.show-zoom`, { timeout:10000 });

  assert.equal(await page.evaluate(() => document.getElementById('zoomIncludeWaiver').checked), true, 'waiver switch restored to ON');
  assert.equal(await page.inputValue('#waiverClient1Name'), CLIENT_1, 'Client 1 waiver name restored');
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:10000 });
  const layout = await padLayout(page);
  assert.equal(layout.waiverChildren, 2, 'pads relocated into the restored waiver stage');
  assert.equal(layout.signatureHost, 'waiverPadsHost', '#signature restored inside the waiver stage');
  assert.ok(await inkRatioFn(page, '#signature') > 0.01, 'Client 1 signature re-inked after restore');
  assert.equal((await structuredReadiness(page)).ready, true, 'restored zoom + waiver draft remains generation-ready');
  assert.deepEqual(errors, [], 'no page errors during zoom + waiver save/restore');
  await context.close();
  console.log('PASS zoom + waiver ON: draft save/reopen restore');
});

test('zoom + waiver mobile: stage usable at 375px, no overflow, 44px targets', async () => {
  for (const viewport of [{width:375,height:667},{width:390,height:844}]){
    const context = await browser.newContext({ viewport });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await enterZoom(page);

    const overflowOff = await page.evaluate(() => ({
      body: document.body.scrollWidth - window.innerWidth,
      main: document.getElementById('mainApp').scrollWidth - document.getElementById('mainApp').clientWidth
    }));
    assert.ok(overflowOff.body <= 1, `zoom no-waiver body overflow at ${viewport.width}px (${overflowOff.body}px)`);
    assert.ok(overflowOff.main <= 1, `zoom no-waiver #mainApp overflow at ${viewport.width}px (${overflowOff.main}px)`);

    await enableZoomWaiver(page);
    const box = await page.locator('#signature').boundingBox();
    assert.ok(box && box.width > 100 && box.height > 100, `signature pad visually sized at ${viewport.width}px`);

    const overflow = await page.evaluate(() => {
      const waiverHost = document.getElementById('waiverPadsHost');
      return {
        body: document.body.scrollWidth - window.innerWidth,
        main: document.getElementById('mainApp').scrollWidth - document.getElementById('mainApp').clientWidth,
        host: waiverHost.scrollWidth - waiverHost.clientWidth
      };
    });
    assert.ok(overflow.body <= 1, `zoom + waiver body overflow at ${viewport.width}px (${overflow.body}px)`);
    assert.ok(overflow.main <= 1, `zoom + waiver #mainApp overflow at ${viewport.width}px (${overflow.main}px)`);
    assert.ok(overflow.host <= 1, `#waiverPadsHost overflow at ${viewport.width}px (${overflow.host}px)`);

    await drawOnPad(page, '#signature');
    const clearBox = await page.locator('#clearSignature').boundingBox();
    assert.ok(clearBox && clearBox.height >= 44, 'clear-signature control meets the 44px touch target');
    assert.match(await page.inputValue('#waiverClient1Date'), /^\d{2}\/\d{2}\/\d{4}$/, 'drawing works on mobile and auto-fills the date');
    assert.deepEqual(errors, [], `no page errors at ${viewport.width}px`);
    await context.close();
  }
  console.log('PASS zoom + waiver mobile: usable stage, no overflow, 44px targets');
});

afterAll(async () => {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
});

console.log('\nAll zoom waiver signing tests PASSED');