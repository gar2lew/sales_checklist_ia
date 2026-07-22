import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ acceptDownloads:true, viewport:{ width:1366, height:768 } });
const page = await context.newPage();
const downloads = [];
page.on('download', download => downloads.push(download.suggestedFilename()));

async function setValue(selector, value) {
  const locator = page.locator(selector);
  const tagName = await locator.evaluate(element => element.tagName);
  if(tagName === 'SELECT') await locator.selectOption(value);
  else await locator.fill(value);
  await locator.dispatchEvent('change');
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  page.once('dialog', dialog => dialog.accept());
  await page.click('#loadTestData');
  await setValue('#date', '21/07/2026');
  await setValue('#teamMember', 'Garry Lewis');
  await setValue('#clientName', 'John Smith');
  await setValue('#client2Name', 'Jenny Smith');
  await setValue('#propertySaleAddress', 'Test Unit, Footscray VIC');

  const initial = await page.evaluate(async () => {
    const result = await window._testState.buildAppointmentPackage();
    const pdfHeader = Array.from(new Uint8Array(await result.combinedPdfBlob.slice(0, 5).arrayBuffer()));
    const zipHeader = Array.from(new Uint8Array(await result.zipBlob.slice(0, 4).arrayBuffer()));
    return {
      keys:Object.keys(result).sort(),
      pdfSize:result.combinedPdfBlob.size,
      pdfType:result.combinedPdfBlob.type,
      pdfFileSize:result.combinedPdfFile.size,
      pdfFileType:result.combinedPdfFile.type,
      pdfFileName:result.combinedPdfFile.name,
      pdfHeader,
      zipSize:result.zipBlob.size,
      zipType:result.zipBlob.type,
      zipFileSize:result.zipFile.size,
      zipFileType:result.zipFile.type,
      zipFileName:result.zipFile.name,
      zipHeader,
      generatedAt:result.generatedAt.toISOString(),
      filenames:result.filenames,
      revision:result.revision,
      counts:window._testState.getPackageGenerationCounts()
    };
  });

  assert.deepEqual(initial.keys, ['combinedPdfBlob','combinedPdfFile','filenames','generatedAt','individualPdfs','revision','zipBlob','zipFile']);
  assert.ok(initial.pdfSize > 0);
  assert.equal(initial.pdfSize, initial.pdfFileSize);
  assert.equal(initial.pdfType, 'application/pdf');
  assert.equal(initial.pdfFileType, 'application/pdf');
  assert.deepEqual(initial.pdfHeader, [37,80,68,70,45], 'combined PDF begins with %PDF-');
  assert.ok(initial.zipSize > 0);
  assert.equal(initial.zipSize, initial.zipFileSize);
  assert.equal(initial.zipType, 'application/zip');
  assert.equal(initial.zipFileType, 'application/zip');
  assert.deepEqual(initial.zipHeader, [80,75,3,4], 'ZIP begins with a local-file signature');
  assert.equal(initial.pdfFileName, 'Sales Appointment - 21-07-2026 - John Smith & Jenny Smith - Garry Lewis.pdf');
  assert.equal(initial.zipFileName, '21-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip');
  assert.equal(initial.filenames.combinedPdf, initial.pdfFileName);
  assert.equal(initial.filenames.zip, initial.zipFileName);
  assert.deepEqual(initial.filenames.entries, [
    'EOI - John Smith & Jenny Smith - Test Unit, Footscray VIC - Garry Lewis - 21-07-2026.pdf',
    'IA - John Smith & Jenny Smith - Garry Lewis - 21-07-2026.pdf'
  ]);
  assert.equal(new Set(initial.filenames.entries).size, initial.filenames.entries.length);
  assert.deepEqual(initial.counts, { combinedPdf:1, zip:1 });

  const reused = await page.evaluate(async () => {
    const first = await window._testState.buildAppointmentPackage();
    const second = await window._testState.buildAppointmentPackage();
    return {
      same:first === second,
      generatedAt:second.generatedAt.toISOString(),
      counts:window._testState.getPackageGenerationCounts()
    };
  });
  assert.equal(reused.same, true);
  assert.equal(reused.generatedAt, initial.generatedAt);
  assert.deepEqual(reused.counts, initial.counts, 'valid package reuse performs no duplicate PDF or ZIP generation');

  const validity = await page.evaluate(async () => {
    const valid = await window._testState.buildAppointmentPackage();
    const base = { ...valid };
    const zeroPdf = new Blob([], { type:'application/pdf' });
    const zeroZip = new Blob([], { type:'application/zip' });
    return {
      valid:await window._testState.isValidAppointmentPackage(valid),
      pdfOnly:await window._testState.isValidAppointmentPackage({ ...base, zipBlob:null, zipFile:null }),
      zipOnly:await window._testState.isValidAppointmentPackage({ ...base, combinedPdfBlob:null, combinedPdfFile:null }),
      emptyEntries:await window._testState.isValidAppointmentPackage({ ...base, individualPdfs:[], filenames:{ ...base.filenames, entries:[] } }),
      zeroPdf:await window._testState.isValidAppointmentPackage({ ...base, combinedPdfBlob:zeroPdf, combinedPdfFile:new File([zeroPdf], base.filenames.combinedPdf, { type:'application/pdf' }) }),
      zeroZip:await window._testState.isValidAppointmentPackage({ ...base, zipBlob:zeroZip, zipFile:new File([zeroZip], base.filenames.zip, { type:'application/zip' }) }),
      stale:await window._testState.isValidAppointmentPackage({ ...base, revision:base.revision - 1 }),
      duplicateEntries:await window._testState.isValidAppointmentPackage({ ...base, filenames:{ ...base.filenames, entries:[base.filenames.entries[0], base.filenames.entries[0]] } })
    };
  });
  assert.deepEqual(validity, { valid:true, pdfOnly:false, zipOnly:false, emptyEntries:false, zeroPdf:false, zeroZip:false, stale:false, duplicateEntries:false });

  const incompleteCacheRecovery = await page.evaluate(async () => {
    const complete = await window._testState.buildAppointmentPackage();
    const before = window._testState.getPackageGenerationCounts();
    window._testState.setAppointmentPackageForTest({
      ...complete,
      zipBlob:null,
      zipFile:null
    });
    const recoveredFromPdfOnly = await window._testState.buildAppointmentPackage();
    const afterPdfOnly = window._testState.getPackageGenerationCounts();
    window._testState.setAppointmentPackageForTest({
      ...recoveredFromPdfOnly,
      combinedPdfBlob:null,
      combinedPdfFile:null
    });
    const recoveredFromZipOnly = await window._testState.buildAppointmentPackage();
    const afterZipOnly = window._testState.getPackageGenerationCounts();
    return {
      pdfOnlyValid:await window._testState.isValidAppointmentPackage(recoveredFromPdfOnly),
      zipOnlyValid:await window._testState.isValidAppointmentPackage(recoveredFromZipOnly),
      before,
      afterPdfOnly,
      afterZipOnly
    };
  });
  assert.equal(incompleteCacheRecovery.pdfOnlyValid, true);
  assert.equal(incompleteCacheRecovery.zipOnlyValid, true);
  assert.equal(incompleteCacheRecovery.afterPdfOnly.combinedPdf, incompleteCacheRecovery.before.combinedPdf, 'PDF-only partial cache reuses its valid PDF');
  assert.equal(incompleteCacheRecovery.afterPdfOnly.zip, incompleteCacheRecovery.before.zip + 1, 'PDF-only partial cache rebuilds the missing ZIP');
  assert.equal(incompleteCacheRecovery.afterZipOnly.combinedPdf, incompleteCacheRecovery.afterPdfOnly.combinedPdf + 1, 'ZIP-only cache rebuilds the missing PDF');
  assert.equal(incompleteCacheRecovery.afterZipOnly.zip, incompleteCacheRecovery.afterPdfOnly.zip + 1, 'ZIP-only cache is never reported as complete');

  const sanitised = await page.evaluate(() => ({
    client:window._testState.safeFilenamePart('John / Jane : Smith', 'Client'),
    property:window._testState.safeFilenamePart('Unit 4\\Example? Street', 'Property'),
    traversal:window._testState.safeFilenamePart('../Unsafe', 'Safe'),
    hidden:window._testState.safeFilenamePart('...hidden...', 'Safe'),
    blank:window._testState.safeFilenamePart('... / \\ :', 'Client'),
    whitespace:window._testState.safeFilenamePart('  John    Smith  ', 'Client')
  }));
  assert.deepEqual(sanitised, {
    client:'John Jane Smith', property:'Unit 4 Example Street', traversal:'Unsafe',
    hidden:'hidden', blank:'Client', whitespace:'John Smith'
  });
  Object.values(sanitised).forEach(value => {
    assert.doesNotMatch(value, /[\\/:*?"<>|]/);
    assert.doesNotMatch(value, /\.\./);
    assert.doesNotMatch(value, /^\./);
  });
  const deduplicatedNames = await page.evaluate(async () => {
    const pdfBlob = new Blob(['%PDF-1.4\n%%EOF'], { type:'application/pdf' });
    return window._testState.uniquePackageEntryNames([
      { blob:pdfBlob, name:'Supporting Document.pdf' },
      { blob:pdfBlob, name:'Supporting Document.pdf' },
      { blob:pdfBlob, name:'supporting document.pdf' }
    ]).map(entry => entry.name);
  });
  assert.deepEqual(deduplicatedNames, ['Supporting Document.pdf','Supporting Document (2).pdf','supporting document (3).pdf']);

  await setValue('#propertySaleAddress', 'Changed Property, Perth WA');
  await page.evaluate(() => document.activeElement?.blur());
  const regenerated = await page.evaluate(async () => {
    const result = await window._testState.buildAppointmentPackage();
    return {
      generatedAt:result.generatedAt.toISOString(),
      entries:result.filenames.entries,
      counts:window._testState.getPackageGenerationCounts()
    };
  });
  assert.notEqual(regenerated.generatedAt, initial.generatedAt);
  assert.deepEqual(regenerated.counts, {
    combinedPdf:incompleteCacheRecovery.afterZipOnly.combinedPdf + 1,
    zip:incompleteCacheRecovery.afterZipOnly.zip + 1
  });
  assert.ok(regenerated.entries.some(name => name.includes('Changed Property, Perth WA')));

  await page.evaluate(() => {
    window.__sharedFiles = null;
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:({ files }) => files?.length === 2 });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async payload => { window.__sharedFiles = payload.files.map(file => ({ name:file.name, type:file.type, size:file.size })); } });
  });
  await page.click('#shareTop');
  await page.waitForFunction(() => Array.isArray(window.__sharedFiles));
  const shared = await page.evaluate(() => ({ files:window.__sharedFiles, counts:window._testState.getPackageGenerationCounts() }));
  assert.equal(shared.files.length, 2);
  assert.deepEqual(shared.files.map(file => file.type), ['application/pdf','application/zip']);
  assert.deepEqual(shared.counts, regenerated.counts, 'native Share reuses the complete package');

  const beforePackageDownloads = downloads.length;
  await page.click('#downloadPackageBottom');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Package downloaded'));
  const deadline = Date.now() + 10000;
  while(downloads.length < beforePackageDownloads + 2 && Date.now() < deadline) await page.waitForTimeout(50);
  assert.deepEqual(downloads.slice(beforePackageDownloads).sort(), [
    '21-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip',
    'Sales Appointment - 21-07-2026 - John Smith & Jenny Smith - Garry Lewis.pdf'
  ].sort());

  await page.click('#backToStart');
  await page.click('.mode-card[data-mode="zoom"]');
  await page.click('#landingContinue');
  assert.equal(await page.evaluate(() => window._testState.getAppointmentPackage()), null, 'changing appointment mode invalidates the previous package');
  const zoomPackage = await page.evaluate(async () => {
    const result = await window._testState.buildAppointmentPackage();
    return { pdf:result.filenames.combinedPdf, zip:result.filenames.zip, counts:window._testState.getPackageGenerationCounts() };
  });
  assert.equal(zoomPackage.pdf, 'Sales Appointment - Zoom - John Smith & Jenny Smith - Garry Lewis - 21-07-2026.pdf');
  assert.equal(zoomPackage.zip, '21-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip');
  assert.equal(zoomPackage.counts.combinedPdf, shared.counts.combinedPdf + 1);
  assert.equal(zoomPackage.counts.zip, shared.counts.zip + 1);

  const concurrent = await page.evaluate(async () => {
    window._testState.clearGenerated();
    const before = window._testState.getPackageGenerationCounts();
    const [first,second] = await Promise.all([
      window._testState.buildAppointmentPackage(),
      window._testState.buildAppointmentPackage()
    ]);
    return {
      same:first === second,
      sameTimestamp:first.generatedAt.getTime() === second.generatedAt.getTime(),
      counts:window._testState.getPackageGenerationCounts(),
      before
    };
  });
  assert.equal(concurrent.same, true, 'concurrent callers receive one authoritative package object');
  assert.equal(concurrent.sameTimestamp, true);
  assert.equal(concurrent.counts.combinedPdf, concurrent.before.combinedPdf + 1);
  assert.equal(concurrent.counts.zip, concurrent.before.zip + 1);

  const editDuringGeneration = await page.evaluate(async () => {
    window._testState.clearGenerated();
    const before = window._testState.getPackageGenerationCounts();
    const pending = window._testState.buildAppointmentPackage();
    while(!window._testState.isPackageBuildInFlight()){
      await new Promise(resolve => setTimeout(resolve,0));
    }
    const client = document.querySelector('#clientName');
    client.value = 'Race Safe Client';
    client.dispatchEvent(new Event('change', { bubbles:true }));
    let rejected = false;
    try { await pending; } catch { rejected = true; }
    const afterRejected = window._testState.getPackageGenerationCounts();
    const cachedAfterRejected = window._testState.getAppointmentPackage();
    const retried = await window._testState.buildAppointmentPackage();
    return {
      rejected,
      cacheEmpty:cachedAfterRejected === null,
      before,
      afterRejected,
      afterRetry:window._testState.getPackageGenerationCounts(),
      retryName:retried.filenames.combinedPdf
    };
  });
  assert.equal(editDuringGeneration.rejected, true, 'an edited snapshot cannot complete as successful');
  assert.equal(editDuringGeneration.cacheEmpty, true);
  assert.equal(editDuringGeneration.afterRetry.combinedPdf, editDuringGeneration.afterRejected.combinedPdf + 1, 'retry rebuilds the combined PDF instead of reusing stale rendered bytes');
  assert.equal(editDuringGeneration.afterRetry.zip, editDuringGeneration.afterRejected.zip + 1);
  assert.match(editDuringGeneration.retryName, /Race Safe Client/);

  const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
  assert.match(source, /const APP_VERSION = '2\.7\.0-alpha\.1';/);
  assert.match(worker, /const CACHE_VERSION = 'v2\.7\.0-alpha\.14';/);

  console.log(JSON.stringify({
    packageResult:{
      combinedPdf:{ name:initial.pdfFileName, type:initial.pdfType, size:initial.pdfSize },
      zip:{ name:initial.zipFileName, type:initial.zipType, size:initial.zipSize },
      generatedAt:initial.generatedAt,
      entries:initial.filenames.entries
    },
    cacheReuse:reused,
    cacheInvalidation:regenerated,
    nativeShare:shared.files,
    sanitised
  }, null, 2));
  console.log('PASS complete appointment package artifacts, cache, filenames, and entry points');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
