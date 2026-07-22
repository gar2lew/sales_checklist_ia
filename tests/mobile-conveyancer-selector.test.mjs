import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
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
const context = await browser.newContext({ viewport:{ width:390, height:844 } });
const page = await context.newPage();

async function resolvedValue() {
  return page.evaluate(() => window._testState.resolveIaSolicitor());
}

async function restoreSolicitor(value, omit=false) {
  await page.evaluate(({ restored, omitValue }) => {
    const draft = JSON.parse(localStorage.getItem('salesAppointmentDraft'));
    if(omitValue) delete draft.iaSolicitor;
    else draft.iaSolicitor = restored;
    localStorage.setItem('salesAppointmentDraft', JSON.stringify(draft));
  }, { restored:value, omitValue:omit });
  await page.click('#loadDraft');
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.check('#includeIA');

  assert.equal(await page.locator('#iaSolicitorOption').count(), 1, 'native conveyancer select exists');
  assert.equal(await page.locator('#iaSolicitorOther').count(), 1, 'custom conveyancer input exists');
  assert.equal(await page.locator('#iaSolicitor').count(), 1, 'legacy resolved field remains present');
  assert.deepEqual(await page.locator('#iaSolicitorOption option').allTextContents(), [
    'B.O.S.S Conveyancing',
    'Natalie to Confirm',
    'Other'
  ]);
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'B.O.S.S Conveyancing');
  assert.equal(await resolvedValue(), 'B.O.S.S Conveyancing');
  assert.equal(await page.inputValue('#iaSolicitor'), 'B.O.S.S Conveyancing');
  assert.equal(await page.locator('label[for="iaSolicitorOption"]').textContent(), 'Solicitor / Conveyancer');
  assert.equal(await page.locator('label[for="iaSolicitorOther"]').textContent(), 'Other Solicitor / Conveyancer');
  assert.ok(await page.locator('#iaSolicitorOption').evaluate(el => el.getBoundingClientRect().height >= 44));
  assert.equal(await page.isHidden('#iaSolicitorOther'), true);
  assert.equal(await page.isDisabled('#iaSolicitorOther'), true, 'hidden custom input is excluded from focus order');

  await page.focus('#iaSolicitorOption');
  await page.selectOption('#iaSolicitorOption', 'Natalie to Confirm');
  assert.equal(await resolvedValue(), 'Natalie to Confirm');
  assert.equal(await page.isHidden('#iaSolicitorOther'), true);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'iaSolicitorOption');

  const scrollBeforeOther = await page.evaluate(() => scrollY);
  await page.selectOption('#iaSolicitorOption', 'Other');
  assert.equal(await page.isVisible('#iaSolicitorOther'), true);
  assert.equal(await page.isDisabled('#iaSolicitorOther'), false);
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'iaSolicitorOption', 'Other selection does not focus text input');
  assert.equal(await page.evaluate(() => scrollY), scrollBeforeOther, 'mode selection does not aggressively scroll');
  assert.equal(await resolvedValue(), '');
  assert.ok(await page.locator('#iaSolicitorOther').evaluate(el => el.getBoundingClientRect().height >= 44));

  await page.locator('#iaSolicitorOther').evaluate(el => { el.dataset.instanceMarker = 'stable'; });
  await page.fill('#iaSolicitorOther', '  Example Legal & Conveyancing  ');
  assert.equal(await page.getAttribute('#iaSolicitorOther', 'data-instance-marker'), 'stable', 'custom keystrokes do not rerender the control');
  assert.equal(await resolvedValue(), 'Example Legal & Conveyancing');
  assert.equal(await page.inputValue('#iaSolicitor'), 'Example Legal & Conveyancing');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'iaSolicitorOther', 'keyboard-capable field is focused only after deliberate interaction');
  assert.equal(await page.locator('#iaSolicitorOther').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
  }), true, 'deliberately focused custom input remains visible in the automated mobile viewport');

  await page.evaluate(() => document.querySelector('#solicitorMode').dispatchEvent(new Event('change', { bubbles:true })));
  await page.setViewportSize({ width:844, height:390 });
  await page.setViewportSize({ width:390, height:844 });
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'Other');
  assert.equal(await page.inputValue('#iaSolicitorOther'), 'Example Legal & Conveyancing');
  assert.equal(await resolvedValue(), 'Example Legal & Conveyancing');
  assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'iaSolicitorOther', 'rerender does not auto-focus custom input');

  await page.click('#saveDraft');
  let draft = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentDraft')));
  assert.equal(draft.iaSolicitor, 'Example Legal & Conveyancing');
  assert.equal(Object.hasOwn(draft, 'iaSolicitorOption'), false);
  assert.equal(Object.hasOwn(draft, 'iaSolicitorOther'), false);
  await page.selectOption('#iaSolicitorOption', 'B.O.S.S Conveyancing');
  await page.click('#loadDraft');
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'Other');
  assert.equal(await page.inputValue('#iaSolicitorOther'), 'Example Legal & Conveyancing');
  assert.equal(await resolvedValue(), 'Example Legal & Conveyancing');

  await restoreSolicitor('B.O.S.S Conveyancing');
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'B.O.S.S Conveyancing');
  assert.equal(await resolvedValue(), 'B.O.S.S Conveyancing');
  await page.click('#saveDraft');
  await restoreSolicitor('Natalie to Confirm');
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'Natalie to Confirm');
  assert.equal(await resolvedValue(), 'Natalie to Confirm');
  await page.click('#saveDraft');
  await restoreSolicitor('Legacy Custom Legal');
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'Other');
  assert.equal(await page.inputValue('#iaSolicitorOther'), 'Legacy Custom Legal');
  assert.equal(await resolvedValue(), 'Legacy Custom Legal');
  await page.click('#saveDraft');
  await restoreSolicitor('', true);
  assert.equal(await page.inputValue('#iaSolicitorOption'), 'B.O.S.S Conveyancing');
  assert.equal(await resolvedValue(), 'B.O.S.S Conveyancing');

  assert.equal(await page.locator('#contractDueDate').count(), 1);
  assert.equal(await page.locator('#contractDueDateTbc').count(), 1);
  assert.deepEqual(await page.evaluate(() => window._testState.resolveContractDueDate()), { valid:false, value:'' });
  assert.match(appSource, /const APP_VERSION = '2\.7\.0-alpha\.1';/);
  assert.match(swSource, /const CACHE_VERSION = 'v2\.7\.0-alpha\.13';/);
  assert.match(appSource, /overlayFitText\(fieldText\('iaSolicitor'\)/, 'IA PDF continues consuming the resolved field');

  console.log(JSON.stringify({
    options:['B.O.S.S Conveyancing','Natalie to Confirm','Other'],
    customDraftValue:'Example Legal & Conveyancing',
    customResolvedValue:'Example Legal & Conveyancing',
    automaticCustomFocus:false
  }, null, 2));
  console.log('PASS mobile conveyancer selector, focus, draft, compatibility, and PDF-value contracts');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
