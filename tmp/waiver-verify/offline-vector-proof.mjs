/**
 * Offline vector waiver generation proof:
 * 1. Install SW v2.7.0-alpha.32 (caches pdf-lib + source PDF).
 * 2. Go fully offline, reload (SW serves the app shell).
 * 3. Run the full waiverOnly flow, generate, download the PDF.
 * 4. Verify: 6 pages, text extractable, draft absent, client name present,
 *    optional signing timestamp (Digitally signed / date / zone) + Client 2 offline.
 *
 * Run: node tmp/waiver-verify/offline-vector-proof.js
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.pdf':'application/pdf' };
const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const baseUrl = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless: true });

async function extractText(buf){
  const standardFonts = pathToFileURL(resolve(root, 'node_modules/pdfjs-dist/standard_fonts/')).href.replace(/\/?$/, '/');
  const doc = await getDocument({ data: new Uint8Array(buf), standardFontDataUrl: standardFonts }).promise;
  const out = [];
  for(let i = 1; i <= doc.numPages; i++){
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out.push({ page: i, text: tc.items.map((it) => it.str).join(' ') });
  }
  await doc.destroy();
  return out;
}

function norm(s){ return s.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase(); }

try {
  const context = await browser.newContext({ serviceWorkers: 'allow', acceptDownloads: true, viewport:{ width:1440, height:900 } });
  const pageErrors = [];
  context.on('page', (p) => p.on('pageerror', (e) => pageErrors.push('pageerror: ' + e.message)));
  context.on('page', (p) => p.on('console', (m) => { if(m.type() === 'error') pageErrors.push('console.error: ' + m.text()); }));
  const page = await context.newPage();

  /* 1. First load online so the SW installs and caches the shell + assets. */
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    return keys.some((k) => k.includes('sales-capture-v2.7.0-alpha.32'));
  }, null, { timeout: 20000 });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const out = {};
    for (const key of keys) {
      const cache = await caches.open(key);
      const reqs = await cache.keys();
      out[key] = reqs.map((r) => new URL(r.url).pathname);
    }
    return out;
  });
  const assets = Object.values(cached).flat();
  assert.ok(assets.includes('/lib/pdf-lib.min.js'), 'SW cache must include /lib/pdf-lib.min.js');
  assert.ok(assets.includes('/templates/ASG-Disclosure-Waiver-2026.pdf'), 'SW cache must include the waiver source PDF');
  console.log('SW cached assets OK:', assets.filter((a) => a.includes('pdf-lib') || a.includes('ASG')).join(', '));

  /* 2. Offline reload (fresh page sharing the same SW scope). */
  await context.setOffline(true);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#landingScreen', { state: 'visible', timeout: 15000 });
  assert.equal(await page.locator('#landingScreen').isVisible(), true, 'app shell must render offline');
  if(pageErrors.length) console.log('NOTICE errors before flow:', pageErrors.join(' | '));

  /* 3. Full waiverOnly flow, generate, download. */
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-waiver', { timeout: 10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout: 10000 });
  await page.fill('#clientName', 'John Smith');
  await page.waitForSelector('#waiverSignatureSection', { state: 'visible', timeout: 15000 });
  await page.fill('#waiverClient1Date', '25/08/2026');

  const signature = page.locator('#signature');
  await signature.scrollIntoViewIfNeeded();
  const box = await signature.boundingBox();
  assert.ok(box && box.width > 10 && box.height > 10, 'signature pad visible');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();

  await page.click('#generateTop');
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const statusEl = document.getElementById('statusLine') || document.querySelector('[id*=status]');
    const readyEl = document.getElementById('appointmentPackageReady');
    const toast = document.querySelector('#toast, .toast, [id*=toast]');
    const genBtn = document.getElementById('generateTop');
    const invalid = [...document.querySelectorAll('.invalidField')].map((el) => el.id);
    const errors = [...document.querySelectorAll('.fieldError')].map((el) => el.textContent);
    return {
      status: statusEl ? statusEl.textContent : null,
      readyHidden: readyEl ? readyEl.classList.contains('hidden') : 'n/a',
      toast: toast ? toast.textContent : null,
      genDisabled: genBtn ? genBtn.disabled : null,
      genText: genBtn ? genBtn.textContent : null,
      invalidFields: invalid,
      fieldErrors: errors
    };
  });
  console.log('app state after generate:', JSON.stringify(state));
  const sigState = await page.evaluate(() => {
    const sig = document.getElementById('signature');
    const canvas = sig && (sig.tagName === 'CANVAS' ? sig : sig.querySelector('canvas, a, img, div'));
    return { signatureTag: sig ? sig.tagName : null, hasEmpty: sig ? (sig.getAttribute('data-empty') ?? sig.getAttribute('aria-invalid')) : null };
  });
  console.log('signature element state:', JSON.stringify(sigState));
  const readiness = await page.evaluate(() => {
    if (window._testState && window._testState.structuredReadinessCheck) {
      const check = window._testState.structuredReadinessCheck();
      return { ready: check.ready, missingCount: check.missingCount, items: check.items };
    }
    return 'no debug hook';
  });
  console.log('readiness:', JSON.stringify(readiness));
  console.log('errors:', JSON.stringify(pageErrors));
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });

  const downloads = [];
  page.on('download', (d) => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 1 && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 100));
  assert.equal(downloads.length, 1, 'offline generation must produce one download');
  const stream = await downloads[0].createReadStream();
  const chunks = [];
  await new Promise((res, rej) => { stream.on('data', (c) => chunks.push(c)).on('end', res).on('error', rej); });
  const pdf = Buffer.concat(chunks);

  /* 4. Verify the offline-generated PDF. */
  assert.equal(pdf[0], 0x25, 'starts with %PDF');
  const pages = await extractText(pdf);
  assert.equal(pages.length, 6, 'must be 6 pages');
  const hasDraft = pages.some((p) => /Updated draft/i.test(p.text));
  assert.equal(hasDraft, false, 'no page may contain "Updated draft"');
  assert.ok(pages[0].text.includes('WAIVER AND DISCLOSURE'), 'page 1 legal header present');
  assert.ok(pages[5].text.includes('John Smith'), 'page 6 contains client name');
  assert.ok(pages[5].text.includes('25/08/2026'), 'page 6 contains signing date');
  assert.ok(/Digitally\s+signed/i.test(pages[5].text), 'page 6 contains timestamp marker');
  assert.match(pages[5].text, /\((?:[A-Z]{3,5}|UTC[+-]?\d{2}:\d{2})\)/, 'page 6 contains a time zone');
  const signedAt1 = await page.evaluate(() => window._testState.getSignedAt1());
  assert.ok(signedAt1, 'captured signedAt1 offline');
  const latin = pdf.toString('latin1');
  const imageWidths = [...latin.matchAll(/\/Subtype \/Image \/Width (\d+)/g)].map((m) => Number(m[1]));
  assert.ok(imageWidths.every((w) => w < 500), 'no full-page rasterised images');

  console.log('PASS offline vector waiver generation: 6 pages, draft absent, John Smith + date + timestamp on page 6, vector only');

  /* 5. Client 2 offline, generate again, verify a second independent timestamp. */
  await page.check('#waiverClient2Toggle');
  await page.fill('#client2Name', 'Jane Smith');
  await page.fill('#waiverClient2Date', '25/08/2026');
  const sig2 = page.locator('#signature2');
  await sig2.scrollIntoViewIfNeeded();
  const b2 = await sig2.boundingBox();
  assert.ok(b2 && b2.width > 10 && b2.height > 10, 'signature2 pad visible');
  await page.mouse.move(b2.x + b2.width * 0.25, b2.y + b2.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(b2.x + b2.width * 0.75, b2.y + b2.height * 0.55, { steps: 8 });
  await page.mouse.up();
  const signedAt2 = await page.evaluate(() => window._testState.getSignedAt2());
  assert.ok(signedAt2, 'captured signedAt2 offline');
  assert.notEqual(signedAt1, signedAt2, 'client timestamps are independent');
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
  const downloads2 = [];
  page.on('download', (d) => downloads2.push(d));
  await page.click('#downloadPackage');
  const t1 = Date.now();
  while(downloads2.length < 1 && Date.now() - t1 < 20000) await new Promise((r) => setTimeout(r, 100));
  const stream2 = await downloads2[0].createReadStream();
  const chunks2 = [];
  await new Promise((res, rej) => { stream2.on('data', (c) => chunks2.push(c)).on('end', res).on('error', rej); });
  const pdf2 = Buffer.concat(chunks2);
  assert.equal(pdf2[0], 0x25, 'starts with %PDF');
  const pages2 = await extractText(pdf2);
  assert.equal(pages2.length, 6, 'must be 6 pages');
  assert.ok(pages2[5].text.includes('Jane Smith'), 'page 6 contains client 2 name');
  const stamps2 = (pages2[5].text.match(/Digitally\s+signed/gi) || []).length;
  assert.equal(stamps2, 2, 'page 6 contains two independent timestamps');
  console.log('PASS offline client 2: second timestamp + Jane Smith on page 6');

  assert.deepEqual(pageErrors, [], 'no page errors during offline flow');
  await context.close();
} finally {
  await browser.close();
  server.close();
}