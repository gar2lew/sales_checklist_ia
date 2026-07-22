import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const evidenceRoot = resolve(root, 'tmp', 'mobile-rc-defects-v2');
mkdirSync(evidenceRoot, { recursive:true });
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const { port } = server.address();
const browser = await chromium.launch({ headless: true });

async function openApp(settings) {
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  const configuredSettings = settings || { staff:{ mode:'select', options:[{ id:'test-user', name:'Test User', email:'', office:'Perth', active:true }] } };
  await context.addInitScript(value => localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify(value)), configuredSettings);
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
  const staff = await page.locator('#landingStaff option').evaluateAll(options => options.map(option => option.value).find(Boolean));
  if (staff) await page.selectOption('#landingStaff', staff);
  else throw new Error('Test fixture requires an explicitly configured staff member.');
  await page.click('#landingContinue');
  return { context, page };
}

async function setValue(page, selector, value) {
  const tagName = await page.locator(selector).evaluate(element => element.tagName);
  if (tagName === 'SELECT') await page.selectOption(selector, value);
  else await page.locator(selector).fill(value);
  await page.locator(selector).dispatchEvent('change');
}

try {
  const { context, page } = await openApp({ staff:{ mode:'select', options:['Test User'] }, branch:{ options:['Perth','Brisbane'] } });
  await setValue(page, '#date', '20/07/2026');
  await setValue(page, '#teamMember', 'Test User');
  await setValue(page, '#clientName', 'Test Client');
  await setValue(page, '#propertySaleAddress', '1 Test Street, Perth WA 6000');
  await page.check('#contractDueDateTbc');

  assert.ok(await page.locator('#timelineInPerson [data-tl-target="eoiDetailsCard"]').evaluate(el => el.closest('.timeline-step').classList.contains('tl-not-required')), 'EOI disabled must be not required');

  await page.check('#includeEOI');
  await page.selectOption('#eoiTemplate', 'standard');
  assert.equal(await page.textContent('#eoiBadge'), '✓ Complete', 'Standard EOI with applicable inherited fields must be complete');

  await page.check('input[name="eoiOwnership"][value="sole"]');
  assert.equal(await page.textContent('#eoiBadge'), '✓ Complete', 'Sole Owner must not require percentage shares');
  await page.check('input[name="eoiOwnership"][value="joint"]');
  assert.equal(await page.textContent('#eoiBadge'), '✓ Complete', 'Joint Tenants must not require percentage shares');
  await page.check('input[name="eoiOwnership"][value="common"]');
  assert.equal(await page.textContent('#eoiBadge'), '⚠ Incomplete', 'Tenants in Common must require shares');
  assert.match(await page.textContent('#sumEOI'), /Incomplete EOI details/, 'Appointment Summary must agree with incomplete EOI state');
  await setValue(page, '#eoiCommonShares', 'Client 1 60%, Client 2 40%');
  assert.equal(await page.textContent('#eoiBadge'), '✓ Complete', 'Tenants in Common with valid shares must be complete');
  assert.doesNotMatch(await page.textContent('#sumEOI'), /Incomplete/, 'Appointment Summary must agree with complete EOI state');

  await page.check('#showEoiOverrides');
  assert.equal(await page.textContent('#eoiBadge'), '⚠ Incomplete', 'manual entry must require its applicable fields');
  await setValue(page, '#eoiClient1Name', 'Manual Client');
  await setValue(page, '#eoiSaleAddress', '2 Manual Street, Perth WA 6000');
  await setValue(page, '#eoiDate', '20/07/2026');
  await setValue(page, '#eoiStaffMember', 'Test User');
  assert.equal(await page.textContent('#eoiBadge'), '✓ Complete', 'complete manual entry must be complete');
  assert.ok(await page.locator('#timelineInPerson [data-tl-target="eoiDetailsCard"]').evaluate(el => el.closest('.timeline-step').classList.contains('tl-complete')), 'step indicator and summary badge must agree');
  await page.evaluate(() => document.querySelector('#generateTop').click());
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Appointment package ready'), null, { timeout:30000 });
  assert.ok(await page.locator('#timelineInPerson .timeline-step:last-child').evaluate(element => element.classList.contains('tl-complete')), 'PDF readiness must agree with the EOI step and summary');
  await page.screenshot({ path:resolve(evidenceRoot, 'eoi-section-complete-390x844.png'), fullPage:true });
  await context.close();

  const defaults = await openApp();
  assert.equal(await defaults.page.locator('#iaSolicitorOption').evaluate(el => el.tagName), 'SELECT', 'IA solicitor must use a native dropdown');
  assert.equal(await defaults.page.inputValue('#iaSolicitor'), 'B.O.S.S Conveyancing', 'B.O.S.S Conveyancing must be the initial selection');
  assert.deepEqual(await defaults.page.locator('#iaSolicitorOption option').allTextContents(), ['B.O.S.S Conveyancing','Natalie to Confirm','Other']);
  await defaults.context.close();

  const configured = await openApp({
    staff:{ mode:'select', options:['Test User'] }, branch:{ options:['Perth','Brisbane'] },
    solicitor:{ mode:'select', options:['Example Legal', 'B.O.S.S Conveyancing'] }
  });
  await configured.page.check('#includeIA');
  assert.ok(await configured.page.locator('#iaSolicitorOption').evaluate(element => element.getBoundingClientRect().height >= 44), 'solicitor dropdown must retain a 44px touch target');
  await configured.page.selectOption('#iaSolicitorOption', 'Other');
  await configured.page.fill('#iaSolicitorOther', 'Custom & Co Conveyancing');
  await configured.page.click('#saveDraft');
  await configured.page.selectOption('#iaSolicitorOption', 'B.O.S.S Conveyancing');
  await configured.page.click('#loadDraft');
  assert.equal(await configured.page.inputValue('#iaSolicitor'), 'Custom & Co Conveyancing', 'draft load must restore custom solicitor text');
  assert.equal(await configured.page.inputValue('#iaSolicitorOption'), 'Other');
  assert.equal(await configured.page.inputValue('#iaSolicitorOther'), 'Custom & Co Conveyancing');
  await configured.context.close();

  const legacy = await openApp({ staff:{ mode:'text', options:['Legacy Staff'] }, solicitor:{ mode:'text', value:'Legacy Conveyancing', options:[] } });
  assert.equal(await legacy.page.locator('#iaSolicitorOption').evaluate(el => el.tagName), 'SELECT');
  assert.equal(await legacy.page.inputValue('#iaSolicitorOption'), 'B.O.S.S Conveyancing', 'legacy admin settings do not replace the approved fresh default');
  await legacy.context.close();

  assert.match(html, /id="appointmentPackageReady"/);
  assert.match(html, /id="preparePackageEmail"/);
  assert.match(source, /CONFIG\.share\.to/);
  assert.match(source, /CONFIG\.share\.cc/);
  assert.doesNotMatch(source.slice(source.indexOf('async function shareAppointmentPackage'), source.indexOf('async function saveReadyPdf')), /window\.open\(mailto/);
  assert.match(source, /completed sales appointment documents for the following appointment/);
  assert.match(source, /Contract Due Date:/);
  assert.doesNotMatch(source, /supporting ZIP package have been downloaded to this device/i, 'retired download copy must remain absent');
  assert.doesNotMatch(source, /Please attach both files to this email before sending/i, 'retired attachment copy must remain absent');

  const fallback = await openApp({ staff:{ mode:'select', options:['Test User'] }, branch:{ options:['Perth','Brisbane'] } });
  fallback.page.once('dialog', dialog => dialog.accept());
  await fallback.page.evaluate(() => document.querySelector('#loadTestData').click());
  const downloads = [];
  fallback.page.on('download', download => downloads.push(download.suggestedFilename()));
  await fallback.page.click('#generateTop');
  await fallback.page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Appointment package ready'), null, { timeout:30000 });
  await fallback.page.screenshot({ path:resolve(evidenceRoot, 'appointment-package-ready-390x844.png') });
  const fallbackLayout = await fallback.page.evaluate(() => {
    const panel = document.querySelector('#appointmentPackageReady').getBoundingClientRect();
    const actions = Array.from(document.querySelectorAll('.package-ready-actions button'));
    return {
      allTouchTargets:actions.every(button => button.getBoundingClientRect().height >= 44),
      panelWidth:panel.width,
      noOverflow:document.documentElement.scrollWidth <= window.innerWidth
    };
  });
  assert.ok(fallbackLayout.allTouchTargets, 'ready actions must retain 44px touch targets');
  assert.ok(fallbackLayout.noOverflow, 'ready panel must not create horizontal overflow');
  await fallback.page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable:true, value:() => false }));
  await fallback.page.click('#sharePackage');
  await fallback.page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('File sharing is not available'));
  assert.equal(downloads.length, 0, 'unavailable file sharing must not download files');
  await fallback.page.evaluate(() => document.querySelector('#openPreparedEmail').addEventListener('click', event => event.preventDefault(), { once:true, capture:true }));
  await fallback.page.click('#preparePackageEmail');
  await fallback.page.waitForFunction(() => document.querySelector('#openPreparedEmail').getAttribute('href').startsWith('mailto:'));
  const mailto = await fallback.page.getAttribute('#openPreparedEmail', 'href');
  assert.ok(mailto.startsWith('mailto:Natalie%40sjssolutionscorp.com.au?cc=Garry%40sjssolutionscorp.com.au'), 'prepared email must resolve configured recipient and CC');
  assert.match(decodeURIComponent(mailto), /Sales Appointment Documents \| John Smith \| \d{2}\/\d{2}\/\d{4}/);
  assert.match(decodeURIComponent(mailto), /Contract Due Date:\nTo Be Confirmed/);
  assert.doesNotMatch(decodeURIComponent(mailto), /Contract Issued:|downloaded|attach/i);
  assert.match(await fallback.page.textContent('#status'), /Prepared email opened/);

  await fallback.page.evaluate(() => {
    window.__nativeShareCalls = [];
    Object.defineProperty(navigator, 'canShare', { configurable:true, value:payload => Array.isArray(payload.files) && payload.files.length > 0 });
    Object.defineProperty(navigator, 'share', { configurable:true, value:payload => { window.__nativeShareCalls.push(payload); return Promise.resolve(); } });
  });
  const downloadsBeforeNative = downloads.length;
  await fallback.page.click('#sharePackage');
  await fallback.page.waitForFunction(() => window.__nativeShareCalls.length === 1, null, { timeout:30000 });
  assert.equal(await fallback.page.evaluate(() => window.__nativeShareCalls[0].files.length), 2, 'native multi-file share must receive PDF and ZIP');
  assert.equal(downloads.length, downloadsBeforeNative, 'successful native share must not duplicate downloads');
  assert.ok(await fallback.page.locator('#appointmentPackageReady').isVisible());

  await fallback.page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable:true, value:() => Promise.reject(new DOMException('cancelled', 'AbortError')) });
  });
  await fallback.page.click('#sharePackage');
  await fallback.page.waitForTimeout(500);
  assert.equal(downloads.length, downloadsBeforeNative, 'cancelled native share must not trigger fallback downloads');

  await fallback.page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable:true, value:() => Promise.reject(new Error('native share rejected')) });
  });
  await fallback.page.click('#sharePackage');
  await fallback.page.waitForFunction(() => document.querySelector('#status').textContent.includes('could not be shared'));
  assert.equal(downloads.length, downloadsBeforeNative, 'rejected native share must not trigger unrelated downloads');
  assert.ok(await fallback.page.locator('#appointmentPackageReady').isVisible(), 'share failure retains ready state');
  await fallback.context.close();

  console.log('PASS mobile RC defect regression contracts');
} finally {
  await browser.close();
  server.close();
}
