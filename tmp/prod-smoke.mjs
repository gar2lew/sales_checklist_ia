import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const BASE = 'https://saleschecklistia.vercel.app/';
const OUT = resolve('tmp/pdfs/prod-smoke');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
context.addInitScript(() => { window.confirm = () => true; });
const pageErrors = [];
const consoleErrors = [];
context.on('page', p => {
  p.on('pageerror', e => pageErrors.push(String(e.message || e)));
  p.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
});
const page = await context.newPage();

function pageCount(buf){
  const m = String(buf.toString('latin1')).match(/\/Type \/Pages \/Count (\d+)/);
  return m ? Number(m[1]) : -1;
}

async function draw(sel){
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
}

async function pickStaff(){
  const values = await page.locator('#landingStaff option').evaluateAll(o => o.map(x => x.value).filter(v => v));
  assert.ok(values.length > 0, 'staff options available');
  const val = values.includes('Garry Lewis') ? 'Garry Lewis' : values[0];
  await page.selectOption('#landingStaff', val);
  return val;
}

async function decide(startLabel){
  await page.click('.mode-card[data-mode="' + (startLabel === 'zoom' ? 'zoom' : 'waiverOnly') + '"]');
  await pickStaff();
  await page.click('#landingContinue');
}

async function waitReady(){
  await page.click('#generateBottom');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
}

async function downloadAll(label){
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 1 && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 100));
  const saved = [];
  for(const d of downloads){
    const path = resolve(OUT, label + '-' + d.suggestedFilename());
    writeFileSync(path, readFileSync(await d.path()));
    saved.push({ name: d.suggestedFilename(), path });
  }
  return saved;
}

/* 1) Landing + fresh service worker is the deployed build */
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
const swInfo = await page.evaluate(async () => {
  const t0 = Date.now();
  let reg = null;
  while(Date.now() - t0 < 60000){
    reg = await navigator.serviceWorker.getRegistration();
    if(reg && reg.active && reg.active.state === 'activated') break;
    await new Promise(r => setTimeout(r, 500));
  }
  if(!reg || !reg.active || reg.active.state !== 'activated') return { timeout: true };
  return await new Promise(resolve => {
    const mc = new MessageChannel();
    mc.port1.onmessage = e => resolve(e.data);
    reg.active.postMessage({ type: 'GET_OFFLINE_READINESS' }, [mc.port2]);
    setTimeout(() => resolve({ timeout: true }), 15000);
  });
});
assert.equal(swInfo.cacheVersion, 'v2.7.0-alpha.28', 'deployed SW cache version');
assert.equal(swInfo.ready, true, 'deployed SW ready');
assert.deepEqual(swInfo.missingAssets, [], 'no missing cached assets');

const cards = await page.locator('.mode-card').evaluateAll(es => es.map(e => e.dataset.mode));
assert.deepEqual(cards, ['inPerson', 'zoom', 'waiverOnly'], 'three landing modes');
assert.equal(await page.locator('.mode-card[data-mode="waiverOnly"] .mode-card-title').textContent(), 'Waiver & Disclosure');

/* 2) Waiver & Disclosure (waiverOnly) mode structure */
await page.click('.mode-card[data-mode="waiverOnly"]');
assert.equal(await page.locator('#continueButtonText').textContent(), 'Start Waiver & Disclosure');
assert.equal(await page.locator('#modeCardHint').textContent(), 'Waiver & Disclosure only');
await pickStaff();
await page.click('#landingContinue');
await page.waitForSelector('.app.show-waiver', { timeout: 15000 });

{
  const s = await page.evaluate(() => {
    const vis = id => { const el = document.getElementById(id); return el ? getComputedStyle(el).display : 'MISSING'; };
    const btnText = id => { const el = document.getElementById(id); const t = el && el.querySelector('.btn-text'); return t ? t.textContent : (el ? el.textContent : 'MISSING'); };
    return {
      appClasses: document.querySelector('.app').className,
      bodyClasses: document.body.className,
      brandTitle: document.getElementById('brandTitle').textContent,
      infoH2: document.querySelector('#appointmentInfoSection h2').textContent,
      genTop: document.getElementById('generateTop').textContent,
      genBottom: btnText('generateBottom'),
      downloadLabel: document.getElementById('downloadPackage').textContent,
      timelineWaiver: vis('timelineWaiver'),
      timelineZoom: vis('timelineZoom'),
      timelineInPerson: vis('timelineInPerson'),
      summaryCard: vis('appointmentSummaryCard'),
      eoi: vis('eoiDetailsCard'),
      ia: vis('iaDetailsCard'),
      idDocs: vis('clientIdSection'),
      checklist: vis('checklistCard'),
      signatures: vis('signaturesSection'),
      zipBtn: vis('savePackageZip'),
      bodyHasEOI: document.body.innerText.includes('Expression of Interest'),
      bodyHasIA: document.body.innerText.includes('Investor Authority'),
      bodyHasIdDocs: document.body.innerText.includes('ID Documents')
    };
  });
  assert.ok(s.appClasses.includes('show-waiver'), 'app has show-waiver class');
  assert.ok(s.bodyClasses.includes('show-waiver'), 'body has show-waiver class');
  assert.equal(s.brandTitle, 'Waiver & Disclosure', 'brand title');
  assert.equal(s.infoH2, '1. Client Details', 'client details heading');
  assert.equal(s.genTop, 'Create Waiver PDF', 'generateTop label');
  assert.equal(s.genBottom, 'Create Waiver PDF', 'generateBottom label');
  assert.equal(s.downloadLabel, 'Download PDF', 'download label');
  assert.notEqual(s.timelineWaiver, 'none', 'waiver timeline visible');
  assert.equal(s.timelineZoom, 'none', 'zoom timeline hidden');
  assert.equal(s.timelineInPerson, 'none', 'in-person timeline hidden');
  assert.equal(s.summaryCard, 'none', 'summary card hidden');
  assert.equal(s.eoi, 'none', 'EOI section hidden');
  assert.equal(s.ia, 'none', 'IA section hidden');
  assert.equal(s.idDocs, 'none', 'ID docs hidden');
  assert.equal(s.checklist, 'none', 'checklist hidden');
  assert.equal(s.signatures, 'none', 'signatures section hidden');
  assert.equal(s.zipBtn, 'none', 'ZIP button hidden');
  assert.equal(s.bodyHasEOI, false, 'no EOI language');
  assert.equal(s.bodyHasIA, false, 'no IA language');
  assert.equal(s.bodyHasIdDocs, false, 'no ID documents language');
}
const waiverSteps = await page.locator('#timelineWaiver .timeline-step').evaluateAll(es =>
  es.map(e => e.textContent.trim().replace(/\s+/g, ' ')));
assert.equal(waiverSteps.length, 3, '3-step waiver timeline');
assert.ok(waiverSteps[0].includes('Client Details'), 'step 1');
assert.ok(waiverSteps[1].includes('Waiver & Disclosure'), 'step 2');
assert.ok(waiverSteps[2].includes('Ready'), 'step 3');
console.log('PASS waiver mode structure: Waiver & Disclosure heading, 3-step, no EOI/IA/ID/checklist/summary/package language');

/* 3) Waiver-only signing + 6-page PDF generation (single PDF, no ZIP) */
await page.fill('#clientName', 'John Smith');
await page.fill('#waiverClient1Name', 'John Smith');
await page.waitForFunction(() => document.getElementById('waiverPadsHost').childElementCount === 2);
assert.equal(await page.evaluate(() => document.getElementById('sigPadsHost').childElementCount), 0, 'pads relocated out of sig host');
await draw('#signature');
await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient1Date').value), { timeout: 15000 });
assert.equal(await page.evaluate(() => window._testState.structuredReadinessCheck().ready), true, 'generation-ready after signing');
await waitReady();
assert.equal(await page.locator('#appointmentPackageReadyTitle').textContent(), 'Waiver & Disclosure Ready', 'ready title');
assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('packageReadyZipRow')).display), 'none', 'no zip row');
const saved = await downloadAll('waiveronly');
assert.equal(saved.length, 1, 'exactly one PDF download');
assert.ok(/Waiver and Disclosure\.pdf$/.test(saved[0].name), 'waiver PDF filename');
const pdfBuf = readFileSync(saved[0].path);
assert.equal(pageCount(pdfBuf), 6, 'waiver PDF has 6 pages');
assert.ok(pdfBuf.length > 50000, 'waiver PDF is a real page set');
console.log('PASS waiver-only flow: signed, ready, single 6-page PDF downloaded, no ZIP');

/* 4) Zoom + waiver pad relocation + whiteboard unaffected */
await page.click('#backToStart');
await page.evaluate(() => window._db.deleteDraft(true).then(() => true));
await page.click('.mode-card[data-mode="zoom"]');
assert.equal(await page.locator('#continueButtonText').textContent(), 'Start Zoom Appointment', 'zoom continue text');
assert.equal(await page.locator('#modeCardHint').textContent(), 'Online / video consultation', 'zoom hint');
await pickStaff();
await page.click('#landingContinue');
await page.waitForSelector('.app.show-zoom', { timeout: 15000 });

await page.fill('#date', '25/08/2026');
await page.fill('#clientName', 'John Smith');
await page.evaluate(() => { const el = document.getElementById('contractDueDateTbc'); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); });
{
  await page.waitForFunction(() => { const c = document.getElementById('whiteboardCanvas'); return c && c.width > 0; });
  await page.locator('#whiteboardCanvas').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const before = await page.locator('#whiteboardCanvas').evaluate(c => c.toDataURL());
  const wb = await page.locator('#whiteboardCanvas').boundingBox();
  await page.mouse.move(wb.x + 40, wb.y + 40); await page.mouse.down();
  await page.mouse.move(wb.x + 160, wb.y + 100, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(300);
  assert.notEqual(await page.locator('#whiteboardCanvas').evaluate(c => c.toDataURL()), before, 'whiteboard interactive in zoom');
}
await page.check('#zoomIncludeWaiver');
await page.waitForSelector('#waiverSignatureSection', { state: 'visible', timeout: 15000 });
await page.waitForFunction(() => document.getElementById('waiverPadsHost').childElementCount === 2, null, { timeout: 15000 });
assert.equal(await page.evaluate(() => document.getElementById('sigPadsHost').childElementCount), 0, 'zoom+waiver: pads relocated');
await draw('#signature');
await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient1Date').value), { timeout: 15000 });
assert.equal(await page.evaluate(() => window._testState.structuredReadinessCheck().ready), true, 'zoom+waiver generation-ready');
assert.equal(await page.locator('#downloadPackage').textContent(), 'Download Package', 'zoom download label (package)');
await waitReady();
const saved2 = await downloadAll('zoom-waiver');
assert.equal(saved2.length, 2, 'zoom: combined PDF + ZIP downloaded');
const pdf2 = saved2.find(x => x.name.toLowerCase().endsWith('.pdf'));
const zip2 = saved2.find(x => x.name.toLowerCase().endsWith('.zip'));
assert.ok(pdf2, 'combined PDF downloaded');
assert.ok(zip2, 'ZIP downloaded');
assert.equal(pageCount(readFileSync(pdf2.path)), 17, 'zoom combined PDF has 17 pages (cover+FC+CR+6-page waiver)');
assert.ok(/\.zip$/i.test(zip2.name), 'zip filename');

assert.deepEqual(pageErrors, [], 'no uncaught page errors: ' + JSON.stringify(pageErrors.slice(0, 5)));
console.log('pageErrors: 0 | consoleErrors: ' + consoleErrors.length + (consoleErrors.length ? ' -- ' + consoleErrors.slice(0, 5).join(' | ') : ''));
console.log('ALL PASS: PRODUCTION SMOKE complete');
await browser.close();