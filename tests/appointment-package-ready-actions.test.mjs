import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
const worker = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

assert.match(html, />Generate Appointment Package</);
assert.match(html, /id="appointmentPackageReady"/);
assert.match(html, />Appointment Package Ready</);
assert.match(html, />Your combined PDF and document ZIP are ready\.</);
assert.match(html, /id="sharePackage"[\s\S]*>Share Package</);
assert.match(html, /id="saveCombinedPdf"[\s\S]*>Save Combined PDF</);
assert.match(html, /id="savePackageZip"[\s\S]*>Save ZIP</);
assert.match(html, /id="preparePackageEmail"[\s\S]*>Prepare Email</);
assert.ok(html.indexOf('id="sharePackage"') < html.indexOf('id="saveCombinedPdf"'));
assert.ok(html.indexOf('id="saveCombinedPdf"') < html.indexOf('id="savePackageZip"'));
assert.ok(html.indexOf('id="savePackageZip"') < html.indexOf('id="preparePackageEmail"'));
assert.match(styles, /\.package-ready-actions[\s\S]*grid/);
assert.match(styles, /min-height:\s*44px/);
assert.match(styles, /overflow-wrap:\s*anywhere/);
assert.match(worker, /const CACHE_VERSION = 'v2\.7\.0-alpha\.15';/);
assert.match(source, /const APP_VERSION = '2\.7\.0-alpha\.1';/);

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
const browser = await chromium.launch({ headless:true });
const context = await browser.newContext({ acceptDownloads:true, viewport:{ width:390, height:844 } });
const page = await context.newPage();
const downloads = [];
page.on('download', download => downloads.push(download.suggestedFilename()));

async function installPackage() {
  await page.evaluate(() => {
    const pdf = new Blob(['%PDF-1.4\n%%EOF'], { type:'application/pdf' });
    const zip = new Blob(['PK\u0003\u0004data'], { type:'application/zip' });
    const generatedAt = new Date('2026-07-22T09:00:00+08:00');
    window._testState.setAppointmentPackageForTest({
      combinedPdfBlob:pdf,
      combinedPdfFile:new File([pdf], 'Sales Appointment - John Smith.pdf', { type:'application/pdf' }),
      zipBlob:zip,
      zipFile:new File([zip], '22-07-2026 - John Smith - Sales Appointment Documents.zip', { type:'application/zip' }),
      individualPdfs:[{ blob:pdf, name:'EOI - John Smith.pdf' }],
      generatedAt,
      filenames:{
        combinedPdf:'Sales Appointment - John Smith.pdf',
        zip:'22-07-2026 - John Smith - Sales Appointment Documents.zip',
        entries:['EOI - John Smith.pdf']
      },
      revision:window._testState.getDocumentRevision()
    });
    window._testState.renderPackageReady('ready');
  });
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => document.querySelector('#loadTestData').click());

  assert.equal(await page.locator('#appointmentPackageReady').isHidden(), true);
  await page.evaluate(() => {
    window.__shareCalls=[];
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => true });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async payload => window.__shareCalls.push(payload) });
  });
  const beforeGenerationDownloads=downloads.length;
  await page.click('#generateTop');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Appointment package ready.');
  assert.equal(downloads.length,beforeGenerationDownloads,'generation does not download files');
  assert.equal(await page.evaluate(() => window.__shareCalls.length),0,'generation does not invoke native sharing');
  await page.evaluate(() => { window._testState.clearGenerated(); window._testState.renderPackageReady('idle'); });
  await installPackage();
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(), true);
  assert.equal(await page.textContent('#packageReadyPdfName'), 'Sales Appointment - John Smith.pdf');
  assert.equal(await page.textContent('#packageReadyZipName'), '22-07-2026 - John Smith - Sales Appointment Documents.zip');
  for(const id of ['sharePackage','saveCombinedPdf','savePackageZip','preparePackageEmail']) {
    assert.equal(await page.locator(`#${id}`).isEnabled(), true);
    assert.ok((await page.locator(`#${id}`).boundingBox()).height >= 44);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await page.locator('#sharePackage').focus();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id),'saveCombinedPdf','ready actions follow their visual keyboard order');

  const beforePdf = downloads.length;
  await page.click('#saveCombinedPdf');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Combined PDF save started.');
  while(downloads.length < beforePdf + 1) await page.waitForTimeout(20);
  assert.deepEqual(downloads.slice(beforePdf), ['Sales Appointment - John Smith.pdf']);

  const beforeZip = downloads.length;
  await page.click('#savePackageZip');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'ZIP save started.');
  while(downloads.length < beforeZip + 1) await page.waitForTimeout(20);
  assert.deepEqual(downloads.slice(beforeZip), ['22-07-2026 - John Smith - Sales Appointment Documents.zip']);

  const countsBeforeEmail=await page.evaluate(() => window._testState.getPackageGenerationCounts());
  const downloadsBeforeEmail=downloads.length;
  await page.evaluate(() => document.querySelector('#openPreparedEmail').addEventListener('click',event=>event.preventDefault(),{once:true,capture:true}));
  await page.click('#preparePackageEmail');
  await page.waitForFunction(() => document.querySelector('#openPreparedEmail').getAttribute('href').startsWith('mailto:'));
  assert.match(await page.getAttribute('#openPreparedEmail','href'),/^mailto:Natalie%40sjssolutionscorp\.com\.au\?/);
  assert.equal(downloads.length,downloadsBeforeEmail,'Prepare Email does not download files');
  assert.deepEqual(await page.evaluate(() => window._testState.getPackageGenerationCounts()),countsBeforeEmail,'Prepare Email does not regenerate the package');

  await page.evaluate(() => {
    window.__shareCalls=[];
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:({files}) => files.length === 2 });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async payload => window.__shareCalls.push(payload.files.map(file => file.name)) });
  });
  await page.click('#sharePackage');
  await page.waitForFunction(() => window.__shareCalls.length === 1);
  assert.deepEqual(await page.evaluate(() => window.__shareCalls[0]), ['Sales Appointment - John Smith.pdf','22-07-2026 - John Smith - Sales Appointment Documents.zip']);

  await page.evaluate(() => {
    window.__shareCalls=[];
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:({files}) => files.length === 1 && files[0].type === 'application/pdf' });
  });
  await page.click('#sharePackage');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ZIP remains'));
  assert.deepEqual(await page.evaluate(() => window.__shareCalls[0]), ['Sales Appointment - John Smith.pdf']);

  const downloadCount = downloads.length;
  await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => false }));
  await page.click('#sharePackage');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('File sharing is not available'));
  assert.equal(await page.textContent('#status'), 'File sharing is not available in this browser. You can save the PDF and ZIP separately.');
  assert.equal(downloads.length, downloadCount, 'unavailable sharing triggers no downloads');

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => true });
    Object.defineProperty(navigator, 'share', { configurable:true, value:async () => { throw new DOMException('cancelled','AbortError'); } });
  });
  await page.click('#sharePackage');
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(), true, 'cancel retains ready state');

  await page.setViewportSize({width:1366,height:768});
  const wideActionTops=await page.locator('.package-ready-actions button').evaluateAll(buttons=>buttons.map(button=>Math.round(button.getBoundingClientRect().top)));
  assert.ok(Math.max(...wideActionTops)-Math.min(...wideActionTops) <= 1,'wide ready actions use one aligned row');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,'wide layout has no horizontal overflow');

  await page.fill('#clientName', 'Changed Client');
  await page.locator('#clientName').blur();
  assert.equal(await page.locator('#sharePackage').isDisabled(), true);
  assert.match(await page.textContent('#packageReadyNotice'), /changed|regenerate/i);

  console.log('PASS appointment package ready actions, sharing hierarchy, independent saves, stale state, mobile layout, and cache');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
