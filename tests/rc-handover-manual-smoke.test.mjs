import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import JSZip from 'jszip';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const artifactRoot = resolve(root, 'tmp', 'rc-handover-manual-smoke');
rmSync(artifactRoot, { recursive:true, force:true });
mkdirSync(artifactRoot, { recursive:true });

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
const { port } = server.address();

const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ acceptDownloads:true, viewport:{ width:1366, height:768 } });
await context.addInitScript(() => {
  window.__renderedPdfText = [];
  const original = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
    window.__renderedPdfText.push(String(text));
    return original.call(this, text, ...args);
  };
});
const page = await context.newPage();
const downloads = [];
page.on('download', download => downloads.push(download));

async function setValue(selector, value) {
  const tagName = await page.locator(selector).evaluate(element => element.tagName);
  if(tagName === 'SELECT') await page.selectOption(selector, value);
  else await page.locator(selector).fill(value);
  await page.locator(selector).dispatchEvent('change');
}

async function setConveyancer(value) {
  const standard = ['B.O.S.S Conveyancing', 'Natalie to Confirm'];
  await page.selectOption('#iaSolicitorOption', standard.includes(value) ? value : 'Other');
  if(!standard.includes(value)) await page.fill('#iaSolicitorOther', value);
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  page.once('dialog', dialog => dialog.accept());
  await page.click('#loadTestData');

  await setValue('#date', '21/07/2026');
  await setValue('#clientName', 'John Smith');
  await setValue('#client2Name', 'Jenny Smith');
  await setValue('#propertySaleAddress', 'Test Unit, Footscray VIC');
  await setValue('#teamMember', 'Garry Lewis');
  await page.check('#includeIA');
  await setConveyancer('Example Legal & Conveyancing');

  await page.click('#saveDraft');
  await setConveyancer('Temporary Replacement');
  await page.click('#loadDraft');
  const conveyancerAfterDraftReload = await page.inputValue('#iaSolicitor');
  assert.equal(conveyancerAfterDraftReload, 'Example Legal & Conveyancing');

  const imagePath = join(root, 'icons', 'icon-192.png');
  for(let index = 0; index < 4; index += 1) {
    await page.locator(`#photoInput${index}`).setInputFiles(imagePath);
    await page.waitForFunction(photoIndex => Boolean(window._testState.getPhotos()[photoIndex].img), index);
  }

  await setConveyancer('Natalie to Confirm');
  await page.click('#generateBottom');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('PDF ready'), null, { timeout:30000 });
  const standardRenderedText = await page.evaluate(() => window.__renderedPdfText);
  assert.ok(standardRenderedText.includes('Natalie to Confirm'), 'standard conveyancer option must be rendered into the generated IA PDF canvas');

  await page.evaluate(() => { window.__renderedPdfText = []; });
  await setConveyancer('Example Legal & Conveyancing');
  await page.click('#generateBottom');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('PDF ready'), null, { timeout:30000 });
  const renderedText = await page.evaluate(() => window.__renderedPdfText);
  assert.ok(renderedText.includes('Example Legal & Conveyancing'), 'custom conveyancer must be rendered into the generated IA PDF canvas');

  const beforePackage = downloads.length;
  await page.click('#downloadPackageBottom');
  await page.waitForFunction(expected => window.document.readyState === 'complete' && expected >= 0, beforePackage);
  const packageDeadline = Date.now() + 30000;
  while(downloads.length < beforePackage + 2 && Date.now() < packageDeadline) await page.waitForTimeout(100);
  const packageDownloads = downloads.slice(beforePackage);
  const zipDownload = packageDownloads.find(download => download.suggestedFilename().endsWith('.zip'));
  assert.ok(zipDownload, 'package ZIP download must be produced');
  const zipPackageFilename = zipDownload.suggestedFilename();
  assert.equal(zipPackageFilename, '21-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip');
  const zipPath = join(artifactRoot, 'package.zip');
  await zipDownload.saveAs(zipPath);
  const zip = await JSZip.loadAsync(readFileSync(zipPath));
  const zipInternalListing = Object.values(zip.files).filter(entry => !entry.dir).map(entry => entry.name).sort();
  for(const expected of [
    'John Smith - ID Front.pdf', 'John Smith - ID Back.pdf',
    'Jenny Smith - ID Front.pdf', 'Jenny Smith - ID Back.pdf'
  ]) assert.ok(zipInternalListing.includes(expected), `${expected} must be present in the ZIP`);

  const beforeShare = downloads.length;
  await page.click('#shareTop');
  await page.locator('#shareEmailFallback:not(.hidden)').waitFor({ timeout:30000 });
  const shareDeadline = Date.now() + 30000;
  while(downloads.length < beforeShare + 2 && Date.now() < shareDeadline) await page.waitForTimeout(100);
  const mailto = await page.getAttribute('#openPreparedEmail', 'href');
  const url = new URL(mailto);
  const primaryRecipient = decodeURIComponent(url.pathname);
  const ccRecipient = url.searchParams.get('cc');
  const generatedEmailSubject = url.searchParams.get('subject');
  const generatedEmailBody = url.searchParams.get('body');

  assert.equal(primaryRecipient, 'Natalie@sjssolutionscorp.com.au');
  assert.equal(ccRecipient, 'Garry@sjssolutionscorp.com.au');
  assert.notEqual(primaryRecipient.toLowerCase(), ccRecipient.toLowerCase());
  assert.equal(generatedEmailSubject, 'Sales Appointment Documents | John Smith & Jenny Smith | 21/07/2026');
  assert.match(generatedEmailBody, /^Hi Natalie,\n\nPlease find the completed sales appointment documents/);
  assert.doesNotMatch(generatedEmailBody, /already attached|files are attached|attachments? (?:is|are) included/i);

  console.log(JSON.stringify({
    generatedEmailSubject, generatedEmailBody, primaryRecipient, ccRecipient,
    zipPackageFilename, zipInternalListing, conveyancerAfterDraftReload,
    customConveyancerRenderedInPdf:renderedText.includes('Example Legal & Conveyancing')
  }, null, 2));
  console.log('PASS exact-data RC handover manual smoke');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
  rmSync(artifactRoot, { recursive:true, force:true });
}
