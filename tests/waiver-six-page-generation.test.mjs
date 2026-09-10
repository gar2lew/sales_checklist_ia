/**
 * Complete six-page Waiver & Disclosure generation tests.
 *
 * Verifies the vector source-PDF waiver generation path: the downloaded waiver
 * is the authoritative six-page legal document produced directly from the source
 * PDF (no canvas rasterisation for standalone or ZIP entries). Combined booklet
 * PDFs (in-person / zoom) still use canvas rendering; only page counts are
 * asserted for those.
 *
 * Run: npx vitest run tests/waiver-six-page-generation.test.mjs
 */

import assert from 'node:assert/strict';
import { test, afterAll } from 'vitest';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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

/* pdf.js needs the standard-14 font data to extract text drawn with the
   Helvetica fonts pdf-lib embeds for the signing overlays. */
function pdfjsParams(){
  const sfDir = fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url));
  return { standardFontDataUrl: pathToFileURL(sfDir).href };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Collapse apostrophe variants and non-alphanumeric to a lowercase comparison string. */
function normText(s){
  return s.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
}

/** Extract per-page text from a pdfjs document. Returns array of {page, raw, normalized}. */
async function extractPageText(buf){
  const doc = await getDocument({ data: new Uint8Array(buf), ...pdfjsParams() }).promise;
  const out = [];
  for(let i = 1; i <= doc.numPages; i++){
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const raw = tc.items.map(it => it.str).join(' ');
    out.push({ page:i, raw, normalized: normText(raw) });
  }
  doc.destroy();
  return out;
}

async function pdfjsPageCount(buf){
  const doc = await getDocument({ data: new Uint8Array(buf), ...pdfjsParams() }).promise;
  const n = doc.numPages;
  doc.destroy();
  return n;
}

/**
 * Assert the vector waiver structure: 6 pages, text content checks, draft
 * absent, no full-page DCTDecode images (not canvas-rasterised), and at least
 * one small image XObject (the signature PNG).
 */
async function assertVectorWaiver(buf, { label, client1Name, client2Name, client2Present, dateStr }){
  const numPages = await pdfjsPageCount(buf);
  assert.equal(numPages, 6, `${label}: must have exactly 6 pages`);

  const pages = await extractPageText(buf);
  assert.equal(pages.length, 6, `${label}: page text extraction must return 6 entries`);

  /* Draft date must be absent from every page. */
  for(const { page, raw } of pages){
    assert.ok(!/Updated draft/i.test(raw), `${label}: page ${page} must not contain "Updated draft"`);
  }

  /* Page 1: legal header + "This document contains a waiver and disclosure." */
  assert.ok(pages[0].normalized.includes('waiveranddisclosure'),
    `${label}: page 1 must contain "WAIVER AND DISCLOSURE" header`);
  assert.ok(pages[0].normalized.includes('thisdocumentcontainsawaiveranddisclosure'),
    `${label}: page 1 must contain "This document contains a waiver and disclosure."`);

  /* Page 3: CLIENT'S WARRANTIES, ACKNOWLEDGMENTS, AND AGREEMENTS */
  assert.ok(pages[2].normalized.includes('clientswarrantiesacknowledgmentsandagreements'),
    `${label}: page 3 must contain "CLIENT'S WARRANTIES, ACKNOWLEDGMENTS, AND AGREEMENTS"`);

  /* Page 6: signing block labels + client values */
  assert.ok(pages[5].normalized.includes('acknowledgementofthiswaiveranddisclosure'),
    `${label}: page 6 must contain "ACKNOWLEDGEMENT OF THIS WAIVER AND DISCLOSURE"`);
  assert.ok(pages[5].normalized.includes('clientsname'),
    `${label}: page 6 must contain "CLIENT'S NAME"`);
  assert.ok(pages[5].normalized.includes('clientssignature'),
    `${label}: page 6 must contain "CLIENT'S SIGNATURE"`);
  assert.ok(pages[5].normalized.includes('date'),
    `${label}: page 6 must contain "DATE"`);

  if(client1Name){
    assert.ok(pages[5].normalized.includes(normText(client1Name)),
      `${label}: page 6 must contain client 1 name "${client1Name}"`);
  }
  if(dateStr){
    const normDate = normText(dateStr);
    assert.ok(pages[5].normalized.includes(normDate),
      `${label}: page 6 must contain date "${dateStr}"`);
    assert.ok(!pages[5].normalized.includes('02092026'),
      `${label}: page 6 must not contain the draft date "02/09/2026"`);
  }

  if(client2Present){
    assert.ok(pages[5].normalized.includes('client2'),
      `${label}: page 6 must contain "CLIENT 2" when second client is enabled`);
    assert.ok(pages[5].normalized.includes(normText(client2Name)),
      `${label}: page 6 must contain client 2 name "${client2Name}"`);
  }

  /* Structural image check: no full-page DCTDecode images (not canvas). */
  const latin = buf.toString('latin1');
  const imageMatches = [...latin.matchAll(/\/Subtype \/Image \/Width (\d+)/g)];
  assert.ok(imageMatches.every(m => Number(m[1]) < 500),
    `${label}: no image XObject may be full-page (all must be < 500px wide)`);
}

/** Parse page-image digests from a canvas-generated (JPEG-embedded) PDF. */
function parseCanvasDigests(buf){
  const latin = buf.toString('latin1');
  const pages = [];
  const pageRe = /\/Type \/Page .*?\/XObject << \/Im\d+ (\d+) 0 R >> >> \/Contents (\d+) 0 R >>/g;
  let p;
  while((p = pageRe.exec(latin)) !== null) pages.push(Number(p[1]));

  const imgRe = /(\d+) 0 obj\n<< .*?\/Width (\d+) \/Height (\d+) .*?\/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g;
  const images = new Map();
  let m;
  while((m = imgRe.exec(latin)) !== null){
    const objNum = Number(m[1]);
    const width = Number(m[2]);
    const height = Number(m[3]);
    const len = Number(m[4]);
    const start = imgRe.lastIndex;
    images.set(objNum, { width, height, jpg: Buffer.from(buf.buffer, buf.byteOffset + start, len) });
  }

  return pages.map(imgObj => {
    const img = images.get(imgObj);
    return img || null;
  }).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* E2E helpers                                                         */
/* ------------------------------------------------------------------ */

function installSafeHooks(context, errors){
  errors.length = 0;
  context.addInitScript(() => { window.confirm = () => true; });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
}

async function enterMode(page, mode){
  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click(`.mode-card[data-mode="${mode}"]`);
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  const cls = mode === 'waiverOnly' ? 'show-waiver' : mode === 'inPerson' ? 'show-in-person' : 'show-zoom';
  await page.waitForSelector(`.app.${cls}`, { timeout:10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:10000 });
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

async function waitWaiverVisible(page){
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:15000 });
}

async function signClient1(page){
  await waitWaiverVisible(page);
  await drawOnPad(page, '#signature');
  await page.fill('#waiverClient1Date', DATE);
  await page.waitForFunction((d) => {
    const el = document.getElementById('waiverClient1Date');
    return el && el.value === d;
  }, DATE, { timeout:5000 });
}

async function signClient2(page){
  await page.check('#waiverClient2Toggle');
  await page.fill('#client2Name', CLIENT_2);
  await drawOnPad(page, '#signature2');
  await page.fill('#waiverClient2Date', DATE);
  await page.waitForFunction((d) => {
    const el = document.getElementById('waiverClient2Date');
    return el && el.value === d;
  }, DATE, { timeout:5000 });
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

async function generateAndWaitReady(page){
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:120000 });
}

async function captureDownloads(page, expected, trigger){
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await trigger();
  const t0 = Date.now();
  while(downloads.length < expected && Date.now() - t0 < 20000){
    await new Promise(r => setTimeout(r, 100));
  }
  assert.equal(downloads.length, expected, `expected ${expected} download${expected === 1 ? '' : 's'}, got ${downloads.length}`);
  const buffers = [];
  for(const d of downloads){
    const chunks = [];
    const stream = await d.createReadStream();
    await new Promise((resolveSaved, rejectSaved) => {
      stream.on('data', chunk => chunks.push(chunk)).on('end', resolveSaved).on('error', rejectSaved);
    });
    buffers.push({ name:d.suggestedFilename(), data:Buffer.concat(chunks) });
  }
  return buffers;
}

function identifyPdfAndZip(buffers){
  const pdf = buffers.filter(b => b.data[0] === 0x25 && b.data[1] === 0x50 && b.data[2] === 0x44 && b.data[3] === 0x46);
  const zip = buffers.filter(b => b.data[0] === 0x50 && b.data[1] === 0x4b && b.data[2] === 0x03 && b.data[3] === 0x04);
  return { pdf, zip };
}

const CLIENT_1 = 'John Smith';
const CLIENT_2 = 'Jane Smith';
const DATE = '25/08/2026';

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

test('standalone Client 1: vector 6-page waiver, text extractable, draft absent', async () => {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterMode(page, 'waiverOnly');
  await page.fill('#clientName', CLIENT_1);
  await signClient1(page);
  await generateAndWaitReady(page);

  const downloads = await captureDownloads(page, 1, () => page.click('#downloadPackage'));
  assert.match(downloads[0].name, /\.pdf$/i, 'waiver-only download must be a PDF');
  const pdf = downloads[0].data;
  assert.equal(pdf[0], 0x25, 'downloaded file starts with %PDF');
  assert.ok(pdf[1] === 0x50 && pdf[2] === 0x44 && pdf[3] === 0x46, 'downloaded file is a PDF');

  await assertVectorWaiver(pdf, {
    label: 'standalone Client 1',
    client1Name: CLIENT_1,
    client2Present: false,
    dateStr: DATE,
  });

  assert.deepEqual(errors, [], 'no page errors in standalone client-1 flow');
  await context.close();
  console.log('PASS standalone Client 1 vector 6-page waiver');
});

test('standalone Client 1 + Client 2: vector waiver, Jane Smith + CLIENT 2 on page 6', async () => {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterMode(page, 'waiverOnly');
  await page.fill('#clientName', CLIENT_1);
  await signClient1(page);
  await signClient2(page);
  await generateAndWaitReady(page);

  const downloads = await captureDownloads(page, 1, () => page.click('#downloadPackage'));
  const pdf = downloads[0].data;

  await assertVectorWaiver(pdf, {
    label: 'standalone Client 1 + Client 2',
    client1Name: CLIENT_1,
    client2Name: CLIENT_2,
    client2Present: true,
    dateStr: DATE,
  });

  /* Pages 1-5 must contain identical legal text to a Client 1-only run. */
  const c1context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const c1errors = [];
  installSafeHooks(c1context, c1errors);
  const c1page = await c1context.newPage();
  await enterMode(c1page, 'waiverOnly');
  await c1page.fill('#clientName', CLIENT_1);
  await signClient1(c1page);
  await generateAndWaitReady(c1page);
  const c1downloads = await captureDownloads(c1page, 1, () => c1page.click('#downloadPackage'));
  const c1pdf = c1downloads[0].data;
  await c1context.close();

  const c1pages = await extractPageText(c1pdf);
  const c2pages = await extractPageText(pdf);
  for(let i = 0; i < 5; i++){
    assert.equal(c1pages[i].normalized, c2pages[i].normalized,
      `pages 1-5 text must be identical with and without Client 2 (page ${i + 1})`);
  }

  assert.notEqual(c1pages[5].normalized, c2pages[5].normalized,
    'page 6 must differ when Client 2 is enabled');

  assert.deepEqual(errors, [], 'no page errors in standalone client-2 flow');
  await context.close();
  console.log('PASS standalone Client 1+2 vector waiver with CLIENT 2 block');
});

test('In-Person + waiver: combined canvas PDF + vector ZIP waiver entry', async () => {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterMode(page, 'inPerson');
  await fillSharedAppointment(page);
  await page.check('#includeWaiver');
  await signClient1(page);
  await generateAndWaitReady(page);

  const downloads = await captureDownloads(page, 2, () => page.click('#downloadPackage'));
  const { pdf, zip } = identifyPdfAndZip(downloads);
  assert.equal(pdf.length, 1, 'exactly one combined PDF download');
  assert.equal(zip.length, 1, 'exactly one ZIP download');

  /* Combined PDF: canvas-based 6 waiver pages. Verify page count. */
  const combinedNumPages = await pdfjsPageCount(pdf[0].data);
  assert.equal(combinedNumPages, 6, 'in-person combined PDF must have 6 pages (waiver only)');

  /* Combined has JPEG page images (canvas rasterised). */
  const canvasDigests = parseCanvasDigests(pdf[0].data);
  assert.equal(canvasDigests.length, 6, 'combined must contain 6 JPEG page images');
  for(const d of canvasDigests){
    assert.ok(d.width >= 1190 && d.height >= 1683,
      `combined page images must be canvas-scale JPEG (got ${d.width}x${d.height})`);
  }

  /* ZIP waiver entry: vector PDF with correct text. */
  const zipContent = await JSZip.loadAsync(zip[0].data);
  const names = Object.keys(zipContent.files).filter(name => !zipContent.files[name].dir);
  const waiverEntries = names.filter(name => /Waiver and Disclosure.*\.pdf$/i.test(name));
  assert.equal(waiverEntries.length, 1, `ZIP must contain the standalone waiver exactly once (got ${JSON.stringify(names)})`);
  const waiverBuf = Buffer.from(await zipContent.files[waiverEntries[0]].async('nodebuffer'));

  await assertVectorWaiver(waiverBuf, {
    label: 'in-person ZIP waiver entry',
    client1Name: CLIENT_1,
    client2Present: false,
    dateStr: DATE,
  });

  assert.deepEqual(errors, [], 'no page errors in in-person + waiver flow');
  await context.close();
  console.log('PASS In-Person combined: 6-page waiver in combined PDF and vector ZIP entry');
});

test('Zoom + waiver: combined canvas PDF + vector ZIP waiver entry', async () => {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterMode(page, 'zoom');
  await fillSharedAppointment(page);
  await page.check('#zoomIncludeWaiver');
  await waitWaiverVisible(page);
  await page.evaluate(() => {
    const sigHost = document.getElementById('sigPadsHost');
    const waiverHost = document.getElementById('waiverPadsHost');
    if(waiverHost.childElementCount === 0 && sigHost.childElementCount > 0){
      while(sigHost.firstChild){ waiverHost.appendChild(sigHost.firstChild); }
    }
  });
  await signClient1(page);
  await generateAndWaitReady(page);

  const downloads = await captureDownloads(page, 2, () => page.click('#downloadPackage'));
  const { pdf, zip } = identifyPdfAndZip(downloads);
  assert.equal(pdf.length, 1, 'exactly one combined PDF download');
  assert.equal(zip.length, 1, 'exactly one ZIP download');

  /* cover(1) + firstConsult(6) + clientReview(4) + waiver(6) = 17 */
  const combinedNumPages = await pdfjsPageCount(pdf[0].data);
  assert.equal(combinedNumPages, 17, 'zoom combined must be cover + firstConsult + clientReview + 6-page waiver');

  const canvasDigests = parseCanvasDigests(pdf[0].data);
  assert.equal(canvasDigests.length, 17, 'combined must contain 17 JPEG page images');

  /* Waiver pages at positions 12-17 (0-indexed: 11-16) must be canvas A4 pages. */
  const waiverDigests = canvasDigests.slice(11);
  assert.equal(waiverDigests.length, 6, 'zoom combined must have 6 waiver pages');
  for(const d of waiverDigests){
    const ratio = d.width / d.height;
    assert.ok(Math.abs(ratio - 595 / 842) < 0.001,
      `waiver page must keep A4 ratio (got ${d.width}x${d.height})`);
  }
  /* Each of the 6 waiver pages must be distinct. */
  const uniqueWaiver = new Set(waiverDigests.map(d => d.jpg.toString('hex')));
  assert.equal(uniqueWaiver.size, 6, 'zoom waiver pages must be six distinct pages');

  /* ZIP waiver entry: vector PDF. */
  const zipContent = await JSZip.loadAsync(zip[0].data);
  const names = Object.keys(zipContent.files).filter(name => !zipContent.files[name].dir);
  assert.equal(names.length, 4, `zoom ZIP must contain cover, firstConsult, clientReview, waiver (got ${JSON.stringify(names)})`);
  const waiverEntries = names.filter(name => /Waiver and Disclosure.*\.pdf$/i.test(name));
  assert.equal(waiverEntries.length, 1, 'zoom ZIP must contain the waiver exactly once');
  const waiverBuf = Buffer.from(await zipContent.files[waiverEntries[0]].async('nodebuffer'));

  await assertVectorWaiver(waiverBuf, {
    label: 'zoom ZIP waiver entry',
    client1Name: CLIENT_1,
    client2Present: false,
    dateStr: DATE,
  });

  assert.deepEqual(errors, [], 'no page errors in zoom + waiver flow');
  await context.close();
  console.log('PASS Zoom combined: 6-page waiver in combined PDF and vector ZIP entry');
});

test('regression: Zoom without waiver stays 11 pages with no waiver entry', async () => {
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  installSafeHooks(context, errors);
  const page = await context.newPage();
  await enterMode(page, 'zoom');
  await fillSharedAppointment(page);
  await generateAndWaitReady(page);

  const downloads = await captureDownloads(page, 2, () => page.click('#downloadPackage'));
  const { pdf, zip } = identifyPdfAndZip(downloads);

  /* cover(1) + firstConsult(6) + clientReview(4) = 11 */
  const parsedNumPages = await pdfjsPageCount(pdf[0].data);
  assert.equal(parsedNumPages, 11, 'zoom without waiver must remain 11 pages');

  const zipContent = await JSZip.loadAsync(zip[0].data);
  const names = Object.keys(zipContent.files).filter(name => !zipContent.files[name].dir);
  assert.equal(names.length, 3, `zoom ZIP without waiver must have cover, firstConsult, clientReview only (got ${JSON.stringify(names)})`);
  assert.equal(names.some(name => /Waiver and Disclosure/i.test(name)), false, 'no waiver entry when toggle is off');

  assert.deepEqual(errors, [], 'no page errors in zoom without waiver flow');
  await context.close();
  console.log('PASS Zoom without waiver unchanged (11 pages, 3 ZIP entries)');
});

test('regression: In-Person without waiver unchanged (single-page delta with IA on)', async () => {
  const run = async (withWaiver) => {
    const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
    const errors = [];
    installSafeHooks(context, errors);
    const page = await context.newPage();
    await enterMode(page, 'inPerson');
    await fillSharedAppointment(page);
    await page.check('#includeIA');
    await page.waitForSelector('#iaForm', { state:'visible', timeout:15000 });
    await page.selectOption('#iaForm', 'perth');
    const iaDateValue = await page.$eval('#iaDate', el => el.value).catch(() => '');
    assert.match(iaDateValue, /^\d{2}\/\d{2}\/\d{4}$/, 'IA date auto-fills from the appointment date');
    await page.fill('#clientAddress', '1 Test Street, Perth WA');
    await page.fill('#propertySaleAddress', '2 Test Street, Perth WA');
    if(withWaiver){
      await page.check('#includeWaiver');
      await signClient1(page);
    }
    await generateAndWaitReady(page);
    const downloads = await captureDownloads(page, 2, () => page.click('#downloadPackage'));
    const { pdf } = identifyPdfAndZip(downloads);
    const out = { pdf: pdf[0].data, errors };
    await context.close();
    return out;
  };

  const withWaiver = await run(true);
  const withoutWaiver = await run(false);

  /* IA(1) + waiver(6) = 7 with waiver; IA(1) = 1 without. */
  const onPages = await pdfjsPageCount(withWaiver.pdf);
  const offPages = await pdfjsPageCount(withoutWaiver.pdf);
  assert.equal(onPages, 7, 'in-person IA + waiver must be 7 pages total');
  assert.equal(offPages, 1, 'in-person IA without waiver must remain exactly 1 page');
  assert.equal(onPages - offPages, 6, 'waiver toggle adds exactly the 6 waiver pages');

  assert.deepEqual(withWaiver.errors, [], 'no page errors in in-person IA + waiver flow');
  assert.deepEqual(withoutWaiver.errors, [], 'no page errors in in-person IA flow');
  console.log('PASS In-Person without waiver unchanged; waiver adds exactly 6 pages');
});

afterAll(async () => {
  await browser.close();
  server.close();
});

console.log('\nAll six-page waiver generation tests PASSED');
