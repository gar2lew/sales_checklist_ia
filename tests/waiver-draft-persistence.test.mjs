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

async function readActiveDraft(page){
  return page.evaluate(async () => {
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
}

async function startWaiverOnly(page){
  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
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

function inkRatio(page, selector){
  return page.evaluate(sel => {
    const c = document.querySelector(sel);
    const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let ink = 0;
    for(let i = 3; i < data.length; i += 4){ if(data[i] > 0) ink++; }
    return ink / (data.length / 4);
  }, selector);
}

test('waiver-only draft: save, auto-fill dates, restore, signature re-ink', async () => {
  /* Scenario A: waiver-only draft — persistence, auto-fill dates, restore, pad re-ink */
  {
    const context = await browser.newContext({ viewport:{width:1688,height:1000} });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await startWaiverOnly(page);

    await page.fill('#clientName', 'Fictional Test Client One');
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', 'Fictional Test Client Two');
    await page.evaluate(() => { document.getElementById('client2Name').dispatchEvent(new Event('change', { bubbles:true })); });
    await page.waitForFunction(() => !document.getElementById('waiverClient2Block').classList.contains('hidden'));
    await page.evaluate(() => {
      const el = document.getElementById('date');
      el.value = '01/01/2025';
      el.dispatchEvent(new Event('change', { bubbles:true }));
    });

    assert.ok(await page.evaluate(() => document.getElementById('mainApp').classList.contains('show-waiver')), 'waiver-only mode active after landing');
    assert.ok(await page.evaluate(() => !document.getElementById('waiverSignatureSection').hidden), 'waiver signature section visible');

    await drawOnPad(page, '#signature');
    const c1Date = await page.inputValue('#waiverClient1Date');
    assert.match(c1Date, /^\d{2}\/\d{2}\/\d{4}$/, 'Client 1 signing date auto-populated DD/MM/YYYY');
    assert.equal(c1Date, todayDDMMYYYY, 'auto-filled date is today, not the appointment date');

    await drawOnPad(page, '#signature2');
    const c2Date = await page.inputValue('#waiverClient2Date');
    assert.equal(c2Date, todayDDMMYYYY, 'Client 2 signing date auto-populated');
    assert.notEqual(c1Date, '01/01/2025', 'signing date is independent of appointment date');

    await page.fill('#waiverClient1Date', '15/03/2026');
    await drawOnPad(page, '#signature');
    assert.equal(await page.inputValue('#waiverClient1Date'), '15/03/2026', 're-signing does not overwrite a manual date');

    await page.evaluate(() => document.getElementById('saveDraft').click());
    await page.waitForFunction(() => {
      const el = document.getElementById('saveStatus');
      return el && el.textContent.trim() === 'Saved just now';
    }, null, { timeout:10000 });

    const saved = await readActiveDraft(page);
    assert.equal(saved.schemaVersion, 1, 'draft saved with schema version 1');
    assert.equal(saved.draft.appointmentMode, 'waiverOnly', 'mode persisted (waiver inclusion implied by waiverOnly mode)');
    assert.equal(saved.draft.waiverClient1Name, 'Fictional Test Client One', 'Client 1 name persisted');
    assert.equal(saved.draft.waiverClient2Name, 'Fictional Test Client Two', 'Client 2 name persisted');
    assert.equal(saved.draft.waiverClient1Date, '15/03/2026', 'Client 1 signing date persisted');
    assert.equal(saved.draft.waiverClient2Date, todayDDMMYYYY, 'Client 2 signing date persisted');
    assert.ok(String(saved.draft.signature).startsWith('data:image/png'), 'Client 1 signature dataURL persisted');
    assert.ok(String(saved.draft.signature2).startsWith('data:image/png'), 'Client 2 signature dataURL persisted');
    assert.ok(new Date(saved.expiry) > new Date(), 'retention expiry set in future');

    await page.reload({ waitUntil:'networkidle' });
    await page.click('#resumeDraftBtn');
    await page.waitForFunction(() => document.documentElement.dataset.draftRestoreState === 'restored', null, { timeout:10000 });

    assert.equal(await page.inputValue('#clientName'), 'Fictional Test Client One', 'Client 1 name restored');
    assert.equal(await page.inputValue('#client2Name'), 'Fictional Test Client Two', 'Client 2 name restored');
    assert.equal(await page.inputValue('#waiverClient1Date'), '15/03/2026', 'Client 1 signing date restored');
    assert.ok(await page.evaluate(() => document.getElementById('mainApp').classList.contains('show-waiver')), 'waiver-only mode restored');
    assert.ok(await inkRatio(page, '#signature') > 0.01, 'Client 1 signature re-inked after restore');
    assert.ok(await inkRatio(page, '#signature2') > 0.01, 'Client 2 signature re-inked after restore');
    assert.deepEqual(errors, [], 'no page errors during waiver-only save/restore');
    await context.close();
    console.log('PASS waiver-only draft: save, auto-fill dates, restore, signature re-ink');
  }
});

test('signing timestamps and timestamp preference survive draft save/restore', async () => {
  /* Scenario D: signedAt1/signedAt2 + includeSignatureTimestamp persist via draft */
  {
    const context = await browser.newContext({ viewport:{width:1688,height:1000} });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await startWaiverOnly(page);

    await page.fill('#clientName', 'Fictional Test Client One');
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', 'Fictional Test Client Two');
    await page.evaluate(() => { document.getElementById('client2Name').dispatchEvent(new Event('change', { bubbles:true })); });
    await page.evaluate(() => {
      const el = document.getElementById('includeSignatureTimestamp');
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles:true }));
    });

    await drawOnPad(page, '#signature');
    await drawOnPad(page, '#signature2');

    const before = await page.evaluate(() => ({
      signedAt1: window._testState.getSignedAt1(),
      signedAt2: window._testState.getSignedAt2(),
    }));
    assert.ok(before.signedAt1 && before.signedAt2, 'both signing times captured before saving');

    await page.evaluate(() => document.getElementById('saveDraft').click());
    await page.waitForFunction(() => {
      const el = document.getElementById('saveStatus');
      return el && el.textContent.trim() === 'Saved just now';
    }, null, { timeout:10000 });

    const saved = await readActiveDraft(page);
    assert.equal(saved.draft.signedAt1, before.signedAt1, 'signedAt1 persisted in the draft');
    assert.equal(saved.draft.signedAt2, before.signedAt2, 'signedAt2 persisted in the draft');
    assert.equal(saved.draft.includeSignatureTimestamp, false, 'timestamp preference persisted');

    await page.reload({ waitUntil:'networkidle' });
    await page.click('#resumeDraftBtn');
    await page.waitForFunction(() => document.documentElement.dataset.draftRestoreState === 'restored', null, { timeout:10000 });

    const restored = await page.evaluate(() => ({
      s1: window._testState.getSignedAt1(),
      s2: window._testState.getSignedAt2(),
      ts: document.getElementById('includeSignatureTimestamp').checked,
    }));
    assert.equal(restored.s1, before.signedAt1, 'signedAt1 restored exactly');
    assert.equal(restored.s2, before.signedAt2, 'signedAt2 restored exactly');
    assert.equal(restored.ts, false, 'timestamp preference restored OFF');

    assert.deepEqual(errors, [], 'no page errors during timestamp draft save/restore');
    await context.close();
    console.log('PASS signing timestamps and timestamp preference survive draft save/restore');
  }
});

test('legacy draft (no waiver keys) restores with waiver off, valid', async () => {
  /* Scenario B: legacy draft without any waiver keys loads with waiver off */
  {
    const context = await browser.newContext({ viewport:{width:1688,height:1000} });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil:'networkidle' });

    const tinyPNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const legacy = {
      schemaVersion:1,
      draft:{
        appointmentMode:'zoom',
        staffName:'Garry Lewis',
        clientName:'Fictional Test Client',
        date:'01/01/2025',
        includeEOI:true,
        includeIA:true,
        contractDueDateTbc:true,
        eoiTemplate:'standard',
        signature:tinyPNG,
        signature2:undefined,
        photos:[
          { label:'Photo 1', dataURL:tinyPNG, rotation:0 },
          { label:'Photo 2', dataURL:null, rotation:0 },
          { label:'Photo 3', dataURL:null, rotation:0 },
          { label:'Photo 4', dataURL:null, rotation:0 }
        ],
        additionalDocsCount:0,
        whiteboardPages:[],
        wbSavedPages:[],
        client1FinancePercentage:undefined,
        client2FinancePercentage:undefined
      },
      created: new Date().toISOString(),
      lastSaved: new Date().toISOString(),
      expiry: new Date(Date.now() + 7 * 86400000).toISOString()
    };
    await page.evaluate(async payload => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('sales-appointment-capture', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put(payload, 'active');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      });
    }, legacy);
    await page.reload({ waitUntil:'networkidle' });
    await page.click('#resumeDraftBtn');
    await page.waitForFunction(() => document.documentElement.dataset.draftRestoreState === 'restored', null, { timeout:10000 });

    assert.equal(await page.inputValue('#clientName'), 'Fictional Test Client', 'legacy client restored');
    assert.ok(await page.evaluate(() => document.getElementById('mainApp').classList.contains('show-zoom')), 'legacy zoom mode restored');
    assert.equal(await page.evaluate(() => document.getElementById('zoomIncludeWaiver').checked), false, 'waiver restored OFF for legacy draft');
    const zoomSteps = await page.evaluate(() => document.querySelectorAll('#timelineZoom li.timeline-step').length);
    assert.equal(zoomSteps, 9, 'zoom timeline shows its expected steps');
    assert.deepEqual(errors, [], 'no page errors restoring a legacy draft');
    await context.close();
    console.log('PASS legacy draft (no waiver keys) restores with waiver off, valid');
  }
});

test('expired draft purged at startup and not restored', async () => {
  /* Scenario C: expired draft is purged, nothing restored */
  {
    const context = await browser.newContext({ viewport:{width:1688,height:1000} });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil:'networkidle' });

    const expired = {
      schemaVersion:1,
      draft:{ appointmentMode:'waiverOnly', clientName:'Fictional Test Client', includeWaiver:true },
      created: new Date(Date.now() - 8 * 86400000).toISOString(),
      lastSaved: new Date(Date.now() - 8 * 86400000).toISOString(),
      expiry: new Date(Date.now() - 1 * 86400000).toISOString()
    };
    await page.evaluate(async payload => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('sales-appointment-capture', 1);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction('drafts', 'readwrite');
        tx.objectStore('drafts').put(payload, 'active');
        tx.oncomplete = () => { db.close(); res(); };
        tx.onerror = () => { db.close(); rej(tx.error); };
      });
    }, expired);
    await page.reload({ waitUntil:'networkidle' });
    await page.waitForFunction(() => window._db && window._db.loadDraft, null, { timeout:5000 });
    const statusNow = await page.evaluate(() => window._db.loadDraft().then(r => r.status));
    assert.ok(statusNow === 'expired' || statusNow === 'missing', 'expired draft no longer valid');
    await page.evaluate(() => window._db.removeExpiredDrafts().then(r => r));
    const after = await page.evaluate(() => window._db.loadDraft().then(r => r.status));
    assert.equal(after, 'missing', 'expired draft removed from device storage');
    assert.deepEqual(errors, [], 'no page errors during expiry purge');
    await context.close();
    console.log('PASS expired draft purged at startup and not restored');
  }
});

afterAll(async () => {
  await browser.close();
  server.close();
});

console.log('\nAll waiver draft persistence tests PASSED');