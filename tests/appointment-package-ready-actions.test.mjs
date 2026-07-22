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
assert.match(html, /id="status"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
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
assert.match(worker, /const CACHE_VERSION = 'v2\.7\.0-alpha\.17';/);
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
  const legacyDownloads=downloads.length;
  const legacyShares=await page.evaluate(async () => {
    window.__shareCalls=[];
    for(const id of ['downloadTop','downloadBottom','downloadPackageTop','downloadPackageBottom','shareTop','shareBottom']){
      document.querySelector(`#${id}`).click();
    }
    await new Promise(resolve=>setTimeout(resolve,100));
    return window.__shareCalls.length;
  });
  assert.equal(downloads.length,legacyDownloads,'hidden legacy controls cannot trigger downloads');
  assert.equal(legacyShares,0,'hidden legacy controls cannot trigger native sharing');
  for(const id of ['downloadTop','downloadBottom','downloadPackageTop','downloadPackageBottom','shareTop','shareBottom']){
    assert.equal(await page.locator(`#${id}`).isDisabled(),true,`${id} remains permanently disabled`);
  }
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
    window.__originalAnchorClick=HTMLAnchorElement.prototype.click;
    window.__originalRevokeObjectURL=URL.revokeObjectURL;
    window.__revokedObjectUrls=[];
    window.__anchorsBeforeFailure=document.querySelectorAll('body > a[download]').length;
    URL.revokeObjectURL=url=>window.__revokedObjectUrls.push(url);
    HTMLAnchorElement.prototype.click=function(){throw new Error('simulated save failure');};
  });
  await page.click('#saveCombinedPdf');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not be saved'));
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(),true,'save failure retains ready state');
  assert.equal(await page.locator('#saveCombinedPdf').isEnabled(),true,'save failure remains retryable');
  assert.equal(await page.evaluate(() => window.__revokedObjectUrls.length),1,'failed save revokes its object URL');
  assert.equal(await page.locator('body > a[download]').count(),await page.evaluate(()=>window.__anchorsBeforeFailure),'failed save removes its temporary anchor');
  await page.evaluate(() => {
    HTMLAnchorElement.prototype.click=window.__originalAnchorClick;
    URL.revokeObjectURL=window.__originalRevokeObjectURL;
  });

  await page.evaluate(() => { document.querySelector('#openPreparedEmail').click=()=>{throw new Error('simulated mailto failure');}; });
  await page.click('#preparePackageEmail');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('email could not be opened'));
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(),true,'mailto failure retains ready state');
  assert.equal(await page.locator('#preparePackageEmail').isEnabled(),true,'mailto failure remains retryable');

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

  await page.evaluate(() => Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new Error('simulated share failure');}}));
  await page.click('#sharePackage');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not be shared'));
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(),true,'share failure retains ready state');
  assert.equal(await page.locator('#sharePackage').isEnabled(),true,'share failure remains retryable');

  await page.setViewportSize({width:1366,height:768});
  const wideActionTops=await page.locator('.package-ready-actions button').evaluateAll(buttons=>buttons.map(button=>Math.round(button.getBoundingClientRect().top)));
  assert.ok(Math.max(...wideActionTops)-Math.min(...wideActionTops) <= 1,'wide ready actions use one aligned row');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,'wide layout has no horizontal overflow');

  const viewports=[[320,568],[375,667],[390,844],[393,852],[414,896],[844,390],[412,915],[1024,768],[1280,800],[1440,900],[1920,1080]];
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,`${width}x${height} has no horizontal overflow`);
    for(const id of ['sharePackage','saveCombinedPdf','savePackageZip','preparePackageEmail']) assert.ok((await page.locator(`#${id}`).boundingBox()).height >= 44,`${id} retains 44px at ${width}x${height}`);
  }
  await page.setViewportSize({width:1280,height:800});
  await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(),true,'critical ready content remains at 200% text size');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,'200% text size has no horizontal overflow');
  await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
  assert.equal(await page.locator('#appointmentPackageReady').isVisible(),true,'ready state remains under reduced motion');

  async function assertInvalidates(label,action){
    await installPackage();
    await action();
    await page.waitForFunction(()=>window._testState.getAppointmentPackage() === null);
    assert.equal(await page.locator('#sharePackage').isDisabled(),true,`${label} disables stale actions`);
    assert.match(await page.textContent('#packageReadyNotice'),/changed|regenerate/i,`${label} shows stale guidance`);
  }
  await page.setViewportSize({width:390,height:844});
  await installPackage();
  await page.click('#summaryDisclosure');
  assert.notEqual(await page.evaluate(()=>window._testState.getAppointmentPackage()),null,'presentation-only summary disclosure preserves the package');
  await assertInvalidates('client name',async()=>{await page.fill('#clientName','Changed Client'); await page.locator('#clientName').blur();});
  await assertInvalidates('client contact',async()=>{await page.fill('#clientPhone','0412345678'); await page.locator('#clientPhone').blur();});
  await assertInvalidates('property',async()=>{await page.fill('#propertySaleAddress','Changed Property, Perth WA'); await page.locator('#propertySaleAddress').blur();});
  await assertInvalidates('appointment date',async()=>{await page.fill('#date','22/07/2026'); await page.locator('#date').blur();});
  await assertInvalidates('appointment time',async()=>{await page.selectOption('#eoiNextApptTime','11:30 AM');});
  await assertInvalidates('Contract Due Date',async()=>{await page.uncheck('#contractDueDateTbc');});
  await assertInvalidates('EOI value',async()=>{await page.fill('#eoiPriceLand','$410,000'); await page.locator('#eoiPriceLand').blur();});
  await assertInvalidates('IA value',async()=>{await page.fill('#iaAmount','$12,000'); await page.locator('#iaAmount').blur();});
  await page.click('#saveDraft');
  await page.click('#loadDraft');
  await assertInvalidates('staff after draft rerender',async()=>{await page.selectOption('#teamMember','Blake Duffield');});
  await assertInvalidates('conveyancer after draft rerender',async()=>{await page.selectOption('#iaSolicitorOption','Natalie to Confirm');});
  await assertInvalidates('document inclusion',async()=>{await page.uncheck('#includeIA');});
  await assertInvalidates('signature',async()=>{
    await page.locator('#signature').dispatchEvent('pointerdown',{pointerId:1,clientX:20,clientY:20});
    await page.locator('#signature').dispatchEvent('pointerup',{pointerId:1,clientX:24,clientY:24});
  });
  await assertInvalidates('supporting upload',async()=>{await page.locator('#photoInput0').setInputFiles(resolve(root,'icons','icon-192.png'));});
  await assertInvalidates('appointment mode',async()=>{await page.click('#backToStart'); await page.click('.mode-card[data-mode="zoom"]'); await page.click('#landingContinue');});

  console.log('PASS appointment package ready actions, sharing hierarchy, independent saves, stale state, mobile layout, and cache');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
