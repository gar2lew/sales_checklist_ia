/*
 * Headless GUI smoke for the Zoom + waiver signing exposure fix,
 * run against the live RC server http://127.0.0.1:8766/ (serves files live).
 *   npm run ...       npx vitest run tests/zoom-waiver-signing.test.mjs covers equivalent flows
 *   this script  ->   node tmp/smoke-zoom-waiver-8766.mjs
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const BASE = 'http://127.0.0.1:8766/';
const OUT = resolve('tmp/pdfs/smoke-8766');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
context.addInitScript(() => { window.confirm = () => true; });
const errors = [];
context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
const page = await context.newPage();

async function enterZoom(){
  await page.goto(BASE, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-zoom', { timeout:10000 });
}

async function draw(sel){
  const loc = page.locator(sel);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width*0.8, box.y + box.height*0.5, { steps:8 });
  await page.mouse.up();
}

function pageCount(buf){
  const m = String(buf.toString('latin1')).match(/\/Type \/Pages \/Count (\d+)/);
  return m ? Number(m[1]) : -1;
}

async function generateAndDownload(label){
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:120000 });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 2 && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100));
  assert.equal(downloads.length, 2, 'combined PDF + ZIP downloaded');
  const saved = [];
  for(const d of downloads){
    const path = resolve(OUT, `${label}-${d.suggestedFilename()}`);
    const stream = await d.path();
    if(typeof stream === 'string') writeFileSync(path, readFileSync(stream));
    else { const fs = await import('node:fs'); const { pipeline } = await import('node:stream/promises'); await pipeline(createReadStream(stream), fs.createWriteStream(path)); }
    saved.push({ name:d.suggestedFilename(), path });
  }
  const pdf = saved.find(s => s.name.toLowerCase().endsWith('.pdf'));
  const zip = saved.find(s => s.name.toLowerCase().endsWith('.zip'));
  return { pdf, zip };
}

/* ── Scenario A: Zoom + waiver OFF ── */
await enterZoom();
{
  const layout = await page.evaluate(() => ({
    sigChildren: document.getElementById('sigPadsHost').childElementCount,
    waiverChildren: document.getElementById('waiverPadsHost').childElementCount,
    waiverDisplay: getComputedStyle(document.getElementById('waiverSignatureSection')).display,
    notRequired: document.querySelector('#timelineZoom [data-tl-target="waiverSignatureSection"]')?.closest('.timeline-step')?.classList.contains('tl-not-required'),
    steps: document.querySelectorAll('#timelineZoom li.timeline-step').length
  }));
  assert.equal(layout.sigChildren, 2, 'A: pads stay in sigPadsHost');
  assert.equal(layout.waiverChildren, 0, 'A: waiverHost empty');
  assert.equal(layout.waiverDisplay, 'none', 'A: waiver stage hidden');
  assert.equal(layout.notRequired, true, 'A: waiver step greyed');
  assert.equal(layout.steps, 9, 'A: zoom timeline intact');
  assert.equal(await page.locator('#signature').isVisible(), false, 'A: no signature UI');
  const before = await page.locator('#whiteboardCanvas').evaluate(c => c.toDataURL());
  await page.locator('#whiteboardCanvas').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#whiteboardCanvas').width > 0);
  await page.waitForTimeout(300);
  const wb = await page.locator('#whiteboardCanvas').boundingBox();
  const beforeReveal = await page.locator('#whiteboardCanvas').evaluate(c => c.toDataURL());
  await page.mouse.move(wb.x+30, wb.y+30); await page.mouse.down();
  await page.mouse.move(wb.x+120, wb.y+90, { steps:6 }); await page.mouse.up();
  assert.notEqual(await page.locator('#whiteboardCanvas').evaluate(c => c.toDataURL()), beforeReveal, 'D: whiteboard interactive');
  console.log('PASS Scenario A (zoom, no waiver): layout unchanged, whiteboard interactive');
}

/* ── Scenario B: Zoom + waiver, Client 1 ── */
{
  await page.fill('#date', '25/08/2026');
  await page.selectOption('#teamMember', { label:'Garry Lewis' });
  await page.fill('#clientName', 'John Smith');
  await page.evaluate(() => { const el = document.getElementById('contractDueDateTbc'); el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true })); });
  await page.check('#zoomIncludeWaiver');
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:10000 });
  const box = await page.locator('#signature').boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100, 'B: pad visible & sized');
  assert.equal(await page.evaluate(() => document.getElementById('waiverPadsHost').childElementCount), 2, 'B: pads relocated');
  await page.fill('#waiverClient1Name', 'John Smith');
  await draw('#signature');
  await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient1Date').value));
  const ready = await page.evaluate(() => window._testState.structuredReadinessCheck().ready);
  assert.equal(ready, true, 'B: generation-ready after signing');
  const { pdf } = await generateAndDownload('zoom-c1');
  assert.equal(pageCount(readFileSync(pdf.path)), 17, 'B: 17-page zoom combined (cover+FC+CR+6-page waiver)');
  console.log('PASS Scenario B (zoom + waiver c1): signed, ready, 17-page PDF');
}

/* ── Scenario C: Zoom + waiver, Client 1 + Client 2 ── */
{
  await page.fill('#client2Name', 'Jane Smith');
  await page.evaluate(() => document.getElementById('client2Name').dispatchEvent(new Event('change', { bubbles:true })));
  await page.waitForFunction(() => !document.getElementById('waiverClient2Block').classList.contains('hidden'));
  await page.fill('#waiverClient2Name', 'Jane Smith');
  await draw('#signature2');
  await page.waitForFunction(() => /^\d{2}\/\d{2}\/\d{4}$/.test(document.getElementById('waiverClient2Date').value));
  assert.equal(await page.evaluate(() => window._testState.structuredReadinessCheck().ready), true, 'C: ready with both clients');
  const { pdf, zip } = await generateAndDownload('zoom-c1-c2');
  assert.equal(pageCount(readFileSync(pdf.path)), 17, 'C: 17-page zoom combined');
  const zipData = await new JSZip().loadAsync(readFileSync(zip.path));
  const names = Object.keys(zipData.files);
  assert.ok(names.length >= 4 && names.some(n => /disclosure/i.test(n)), `C: ZIP has waiver entry (got ${JSON.stringify(names)})`);
  console.log('PASS Scenario C (zoom + waiver c1+c2): signed both, 17-page PDF + ZIP waiver entry');
}

assert.deepEqual(errors, [], `no page errors during GUI smoke: ${JSON.stringify(errors)}`);
await context.close();
await browser.close();
console.log(`\nAll GUI smoke scenarios PASSED (artifacts in ${OUT})`);