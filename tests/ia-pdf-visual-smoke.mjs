import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifactRoot = resolve(root, 'tmp', 'pdfs', 'ia-verification');
mkdirSync(artifactRoot, { recursive: true });

const mimeTypes = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const filePath = resolve(root, normalize(relative));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = readFileSync(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
await context.addInitScript(() => localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
  staff:{mode:'text',options:['Test User']},branch:{options:['Perth','Brisbane']}
})));
await context.route('https://fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const page = await context.newPage();
const browserErrors = [];
const failedRequests = [];
page.on('pageerror', error => browserErrors.push(error.message));
page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

const cases = [
  { amount: '$1,000', slug: '1-thousand' },
  { amount: '$10,000', slug: '10-thousand' },
  { amount: '$100,000', slug: '100-thousand' },
  { amount: '$1,000,000', slug: '1-million' }
];
const results = [];

async function waitForDownloadCount(downloads, count) {
  const deadline = Date.now() + 15000;
  while (downloads.length < count && Date.now() < deadline) await page.waitForTimeout(100);
  assert.equal(downloads.length, count, `expected ${count} package downloads`);
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  await page.selectOption('#landingStaff', 'Test User');
  await page.click('#landingContinue');

  await page.fill('#date', '16/07/2026');
  await page.fill('#clientName', 'Alexandria Catherine Montgomery-Wellington');
  await page.fill('#client2Name', 'Benjamin Theodore Fitzwilliam-Smythe');
  await page.fill('#clientAddress', 'Apartment 1204, 987 Extremely Long Residential Boulevard, North Fremantle WA 6159');
  await page.fill('#propertySaleAddress', 'Lot 1234, 456 Very Long Proposed Property Address, South Guildford WA 6055');
  await page.check('#includeIA');
  await page.selectOption('#iaForm', 'perth');
  await page.fill('#iaSolicitor', 'The Very Long Named Solicitor and Conveyancing Partnership Pty Ltd');

  for (const testCase of cases) {
    const caseDir = join(artifactRoot, testCase.slug);
    mkdirSync(caseDir, { recursive: true });
    await page.fill('#iaAmount', testCase.amount);
    await page.click('#generateBottom');
    await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('PDF ready'), null, { timeout: 20000 });

    assert.equal(await page.textContent('#previewPageLabel'), 'Page 1 of 1');
    await page.locator('#previewPaper canvas:not(#previewOverlay)').screenshot({ path: join(caseDir, 'ia-preview.png') });

    const compiledDownloadPromise = page.waitForEvent('download');
    await page.click('#downloadBottom');
    const compiledDownload = await compiledDownloadPromise;
    const compiledPath = join(caseDir, 'compiled.pdf');
    await compiledDownload.saveAs(compiledPath);

    const packageDownloads = [];
    const capturePackage = download => packageDownloads.push(download);
    page.on('download', capturePackage);
    await page.click('#downloadPackageBottom');
    await waitForDownloadCount(packageDownloads, 2);
    page.off('download', capturePackage);
    const zipDownload = packageDownloads.find(download => download.suggestedFilename().toLowerCase().endsWith('.zip'));
    assert.ok(zipDownload, 'package must include a ZIP download');
    const zipPath = join(caseDir, 'package.zip');
    await zipDownload.saveAs(zipPath);

    const zip = await JSZip.loadAsync(readFileSync(zipPath));
    const iaEntry = Object.values(zip.files).find(entry => !entry.dir && /^IA\b.*\.pdf$/i.test(entry.name));
    assert.ok(iaEntry, 'package ZIP must contain a standalone IA PDF');
    const standalonePath = join(caseDir, 'standalone-ia.pdf');
    writeFileSync(standalonePath, await iaEntry.async('nodebuffer'));

    const compiledBytes = readFileSync(compiledPath);
    const standaloneBytes = readFileSync(standalonePath);
    assert.equal(compiledBytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(standaloneBytes.subarray(0, 5).toString(), '%PDF-');
    results.push({
      amount: testCase.amount,
      compiledBytes: compiledBytes.length,
      standaloneBytes: standaloneBytes.length,
      iaEntry: iaEntry.name,
      caseDir
    });
  }

  assert.deepEqual(browserErrors, [], `browser console errors: ${browserErrors.join('; ')}; failed requests: ${JSON.stringify(failedRequests)}`);
  console.log(JSON.stringify({ artifactRoot, results, failedRequests }, null, 2));
  console.log('IA compiled/package visual smoke generation passed.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
