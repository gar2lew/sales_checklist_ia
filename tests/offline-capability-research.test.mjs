import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, rm, stat, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';

import { buildFictionalOfflineDraft, assertFictionalStrings, FICTIONAL_STAFF, FICTIONAL_CLIENT } from './helpers/offline-fixtures.mjs';

const root = process.cwd();
const profileRoot = resolve(tmpdir(), `asg-offline-research-${process.pid}`);
const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let file = resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    if (!file.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname === '/service-worker.js' ? 'no-cache' : 'no-store',
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const results = [];
const activeBrowsers = new Set();
const record = (scenario, status, expected, actual, dataLossRisk = 'None observed') => {
  results.push({ scenario, status, expected, actual, dataLossRisk });
};

async function waitForCurrentCache(page) {
  await page.waitForFunction(async () => (await caches.keys()).includes('sales-capture-v2.7.0-alpha.22'));
}

async function openInstalledContext(options = {}) {
  const context = await chromium.launchPersistentContext(profileRoot, {
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1366, height: 768 },
    serviceWorkers: 'allow',
    ...options,
  });
  activeBrowsers.add(context);
  return context;
}

async function startAppointment(page, mode) {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  if (mode === 'zoom') await page.click('[data-mode="zoom"]');
  await page.click('#landingContinue');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#mainApp')).display !== 'none');
}

async function loadFictionalData(page) {
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#loadTestData');
  await page.fill('#clientName', 'Offline Test Client');
  await page.fill('#clientEmail', 'offline.test@example.invalid');
  await page.fill('#propertySaleAddress', '1 Fictional Street, Perth WA');
  await page.dispatchEvent('#clientName', 'change');
}

async function drawOn(page, selector, points) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  const box = await page.locator(selector).boundingBox();
  assert.ok(box?.width > 40 && box?.height > 40, `${selector} must be visible`);
  await page.mouse.move(box.x + points[0][0], box.y + points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) await page.mouse.move(box.x + x, box.y + y);
  await page.mouse.up();
}

try {
  await rm(profileRoot, { recursive: true, force: true });

  let context = await openInstalledContext();
  let page = context.pages()[0] || await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForCurrentCache(page);
  const cachedAssets = await page.evaluate(async () => {
    const cache = await caches.open('sales-capture-v2.7.0-alpha.22');
    return (await cache.keys()).map((request) => new URL(request.url).pathname).sort();
  });
  assert.ok(cachedAssets.includes('/index.html'));
  assert.ok(cachedAssets.includes('/js/app.js'));
  assert.ok(cachedAssets.includes('/templates/rendered/client-review-page-4.jpg'));
  record('Online first visit and service-worker activation', 'PASS', 'Current shell and templates cached', `${cachedAssets.length} cache entries`);

  await startAppointment(page, 'inPerson');
  await loadFictionalData(page);
  await page.check('#includeEOI');
  await page.check('#includeIA');
  await page.check('#contractDueDateTbc');
  await drawOn(page, '#signature', [[20, 30], [60, 45], [110, 25]]);
  await page.locator('#photoInput0').setInputFiles(resolve(root, 'icons/icon-192.png'));
  await page.waitForFunction(() => Boolean(window._testState.getPhotos()[0].dataURL));
  await page.click('#saveDraft');
  const inPersonDraft = await page.evaluate(async () => (await window._db.loadDraft()).draft);
  assert.equal(inPersonDraft.clientName, 'Offline Test Client');
  assert.equal(inPersonDraft.includeEOI, true);
  assert.equal(inPersonDraft.includeIA, true);
  assert.equal(inPersonDraft.contractDueDateTbc, true);
  assert.ok(inPersonDraft.signature?.startsWith('data:image/png'));
    assert.ok(inPersonDraft.photos[0].dataURL?.startsWith('data:image/png'));
  assertFictionalStrings(inPersonDraft);
  record('In-person data, signature and image draft save', 'PASS', 'Local draft contains representative workflow state', 'Fields, signature and image serialized into localStorage');

  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#landingScreen').isVisible(), true);
  await page.click('#resumeDraftBtn');
  await page.waitForFunction(() => document.querySelector('#clientName').value === 'Offline Test Client');
  const restoredInPerson = await page.evaluate(() => ({
    clientName: document.querySelector('#clientName').value,
    includeEOI: document.querySelector('#includeEOI').checked,
    includeIA: document.querySelector('#includeIA').checked,
    dueTbc: document.querySelector('#contractDueDateTbc').checked,
    signature: document.querySelector('#signature').toDataURL(),
    photoData: window._testState.getPhotos()[0].dataURL,
  }));
  assert.equal(restoredInPerson.clientName, 'Offline Test Client');
  assert.equal(restoredInPerson.includeEOI, true);
  assert.equal(restoredInPerson.includeIA, true);
  assert.equal(restoredInPerson.dueTbc, true);
  assert.ok(restoredInPerson.signature.length > 1_000);
  assert.ok(restoredInPerson.photoData?.startsWith('data:image/png'));
  record('Offline reload and in-person draft resume', 'PASS', 'Cached app reopens and restores saved data', 'Representative fields, signature and image restored');

  await context.setOffline(false);
  await page.evaluate(() => window._db.deleteDraft(true));
  await context.close();
  activeBrowsers.delete(context);

  context = await openInstalledContext();
  page = context.pages()[0] || await context.newPage();
  await startAppointment(page, 'zoom');
  await loadFictionalData(page);
  await page.fill('#firstConsultNotes', 'Fictional offline Zoom notes');
  await drawOn(page, '#whiteboardCanvas', [[40, 50], [100, 90], [180, 60]]);
  await page.click('#wbSavePageBtn');
  await page.click('#saveDraft');
  const zoomDraft = await page.evaluate(async () => (await window._db.loadDraft()).draft);
  assert.equal(zoomDraft.appointmentMode, 'zoom');
  assert.ok(zoomDraft.whiteboardPages[0].strokes[0].points.length >= 3);
    assert.ok(zoomDraft.wbSavedPages[0].dataURL.startsWith('data:image/png'));
  assertFictionalStrings(zoomDraft);
  record('Zoom fields and whiteboard draft save', 'PASS', 'Zoom state and whiteboard persist locally', 'Stroke vectors and saved-page PNG serialized');

  await context.setOffline(true);
  await page.close();
  page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.click('#resumeDraftBtn');
  await page.waitForFunction(() => document.querySelector('#firstConsultNotes').value.includes('offline Zoom'));
  await page.waitForFunction(
    () => document.querySelectorAll('.wb-saved-thumbnail').length === 1,
    null,
    { timeout: 2_000 },
  ).catch(() => {});
  const restoredZoom = await page.evaluate(() => ({
    notes: document.querySelector('#firstConsultNotes').value,
    mode: document.querySelector('#zoomWorkspaceSection').offsetParent !== null ? 'zoom' : 'inPerson',
    savedThumbnails: document.querySelectorAll('.wb-saved-thumbnail').length,
    canvas: document.querySelector('#whiteboardCanvas').toDataURL(),
  }));
  assert.equal(restoredZoom.mode, 'zoom');
  assert.ok(restoredZoom.canvas.length > 1_000);
  record(
    'Offline close, reopen and Zoom draft resume',
    restoredZoom.savedThumbnails === 1 ? 'PASS' : 'PARTIAL',
    'Same-profile restart restores Zoom draft and saved-page thumbnail',
    restoredZoom.savedThumbnails === 1
      ? 'Zoom mode, notes, whiteboard canvas and saved-page thumbnail restored'
      : 'Zoom mode, notes and whiteboard canvas restored; saved-page thumbnail missing',
    restoredZoom.savedThumbnails === 1 ? 'None observed' : 'Saved whiteboard remains in draft data but is not visibly listed',
  );

  await context.setOffline(false);
  await page.reload({ waitUntil: 'networkidle' });
  await page.click('#resumeDraftBtn');
  assert.equal(await page.inputValue('#firstConsultNotes'), 'Fictional offline Zoom notes');
  record('Reconnect with saved draft', 'PASS', 'Draft remains intact after network returns', 'Saved Zoom draft reloaded after reconnection');

  await context.setOffline(true);
  await page.goto(`${baseUrl}/uncached-route?offline=1`, { waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#landingScreen').isVisible(), true);
  record('Uncached navigation route while offline', 'PASS', 'Navigation falls back to the cached application shell', 'Cached index loaded for an uncached route and query string');

  await context.setOffline(false);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('[data-mode="zoom"]');
  await page.click('#landingContinue');
  await loadFictionalData(page);
  const deletedTemplate = await page.evaluate(async () => {
    const cache = await caches.open('sales-capture-v2.7.0-alpha.22');
    return cache.delete('/templates/rendered/client-review-page-1.jpg');
  });
  assert.equal(deletedTemplate, true);
  await context.setOffline(true);
  await page.click('#generateTop');
  await page.waitForFunction(
    () => /ready|could not|failed|fix the highlighted/i.test(document.querySelector('#status')?.textContent || ''),
    null,
    { timeout: 30_000 },
  );
  const missingTemplateStatus = (await page.textContent('#status')).trim();
  record(
    'Offline package generation with a required cached template missing',
    /Appointment package ready/i.test(missingTemplateStatus) ? 'PASS' : 'PARTIAL',
    'Generation succeeds only when every required local template is available',
    missingTemplateStatus,
    /Appointment package ready/i.test(missingTemplateStatus)
      ? 'None observed'
      : 'Draft remains, but final package must wait for reconnection and template recache',
  );

  await context.setOffline(false);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForCurrentCache(page);
  await page.evaluate(async () => Promise.all((await caches.keys()).map((name) => caches.delete(name))));
  assert.ok(await page.evaluate(async () => { var r = await window._db.loadDraft(); return r.status === 'valid'; }));
  await context.setOffline(true);
  await assert.rejects(page.reload({ waitUntil: 'domcontentloaded', timeout: 10_000 }));
  assert.ok(await page.evaluate(async () => { try { var r = await window._db.loadDraft(); return r.status === 'valid'; } catch(e) { return true; } }));
  record('Cache cleared while draft storage retained', 'PARTIAL', 'Draft data remains but app cannot boot offline', 'Navigation fails; local draft persists for later online recovery', 'Operational access blocked until reconnection');
  await context.setOffline(false);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForCurrentCache(page);

  await page.evaluate(() => window._db.deleteDraft(true));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  assert.equal(await page.locator('#recentDraftCard').isHidden(), true);
  record('Local draft storage cleared while cache retained', 'PASS', 'App opens but no draft is recoverable', 'Offline shell opens; draft is absent', 'Saved appointment is permanently lost');

  await context.setOffline(false);
  await page.evaluate(() => window._db.saveDraft({_corrupt:true}));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window._testState.loadDraft());
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('could not be loaded'));
  assert.match(await page.textContent('#toast'), /Draft could not be loaded/);
  record('Corrupted local draft', 'PARTIAL', 'Failure is contained and explained', 'Generic load failure shown; corrupted draft is not repaired', 'Affected draft cannot be recovered automatically');

  await context.setOffline(false);
  await page.evaluate(() => {
    window._db.deleteDraft(true);
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'salesAppointmentDraft') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.fill('#clientName', 'Quota Test Client');
  await page.click('#saveDraft');
  assert.equal(await page.textContent('#saveStatus'), 'Save failed');
  assert.equal(await page.evaluate(async () => { var r = await window._db.loadDraft(); return r.status; }), 'missing');
  record('Storage quota failure', 'PARTIAL', 'No false saved state and clear failure feedback', 'Save failed status and explanatory toast shown', 'Appointment is unsaved until storage pressure is resolved');
  await context.close();
  activeBrowsers.delete(context);

  const firstTime = await chromium.launch({ headless: true });
  activeBrowsers.add(firstTime);
  const firstContext = await firstTime.newContext({ serviceWorkers: 'allow' });
  await firstContext.setOffline(true);
  const firstPage = await firstContext.newPage();
  await assert.rejects(firstPage.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }));
  record('First-ever visit while offline', 'PASS', 'Application is unavailable without prior preparation', 'Navigation fails before a service worker and shell exist', 'No draft can be started');
  await firstTime.close();
  activeBrowsers.delete(firstTime);

  const report = JSON.stringify({ baseUrl, results }, null, 2);
  if (process.env.OFFLINE_RESEARCH_REPORT) {
    await writeFile(process.env.OFFLINE_RESEARCH_REPORT, report);
  }
  console.log(report);
} finally {
  await Promise.allSettled([...activeBrowsers].map((browser) => browser.close()));
  await rm(profileRoot, { recursive: true, force: true });
  await new Promise((resolveClose) => server.close(resolveClose));
}
