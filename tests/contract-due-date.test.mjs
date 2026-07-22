import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const emailBefore = source.slice(source.indexOf('function buildShareEmailContent'), source.indexOf('async function currentReadyPackage'));
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

async function setTbc(checked) {
  await page.evaluate(value => {
    const input = document.querySelector('#contractDueDateTbc');
    input.checked = value;
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }, checked);
}

try {
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');

  assert.equal(await page.locator('#contractDueDateField').count(), 1);
  assert.equal(await page.locator('#contractDueDate').count(), 1);
  assert.equal(await page.locator('#contractDueDateTbc').count(), 1);
  assert.equal(await page.locator('#contractDueDate').getAttribute('type'), 'date');
  assert.equal(await page.inputValue('#contractDueDate'), '', 'date must not default to today');
  assert.equal(await page.isChecked('#contractDueDateTbc'), false);
  assert.deepEqual(await page.evaluate(() => window._testState.resolveContractDueDate()), { valid:false, value:'' });
  assert.equal(await page.locator('label[for="contractDueDate"]').textContent(), 'Contract Due Date');
  assert.equal((await page.locator('label[for="contractDueDateTbc"]').textContent()).trim(), 'To Be Confirmed');
  assert.equal(await page.locator('#appointmentInfoSection #contractDueDateField').count(),0,'due-date field no longer appears at the beginning of the form');
  assert.equal(await page.locator('#contractDueDateField').isVisible(),true,'due-date field remains visible when optional EOI details are hidden');
  assert.ok(await page.locator('#contractDueDateTbc').evaluate(el => el.getBoundingClientRect().height >= 44 || el.closest('label').getBoundingClientRect().height >= 44));

  await page.fill('#contractDueDate', '2026-08-15');
  await page.dispatchEvent('#contractDueDate', 'change');
  assert.equal(await page.isChecked('#contractDueDateTbc'), false);
  assert.deepEqual(await page.evaluate(() => window._testState.resolveContractDueDate()), { valid:true, value:'15/08/2026' });
  await page.check('#contractDueDateTbc');
  assert.equal(await page.inputValue('#contractDueDate'), '');
  assert.equal(await page.isDisabled('#contractDueDate'), true);
  assert.deepEqual(await page.evaluate(() => window._testState.resolveContractDueDate()), { valid:true, value:'To Be Confirmed' });
  await page.uncheck('#contractDueDateTbc');
  assert.equal(await page.isDisabled('#contractDueDate'), false);
  assert.equal(await page.inputValue('#contractDueDate'), '', 'cleared date is not restored');

  await page.fill('#contractDueDate', '2026-09-20');
  await page.dispatchEvent('#contractDueDate', 'change');
  await page.setViewportSize({ width:844, height:390 });
  await page.setViewportSize({ width:390, height:844 });
  assert.equal(await page.inputValue('#contractDueDate'), '2026-09-20', 'viewport/orientation changes preserve state');
  await page.click('#backToStart');
  await page.click('[data-mode="zoom"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  assert.equal(await page.inputValue('#contractDueDate'), '2026-09-20', 'mode presentation rerender preserves shared state');

  await page.click('#saveDraft');
  let draft = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentDraft')));
  assert.equal(draft.contractDueDate, '2026-09-20');
  assert.equal(draft.contractDueDateTbc, false);
  await page.fill('#contractDueDate', '2026-10-01');
  await page.click('#loadDraft');
  assert.equal(await page.inputValue('#contractDueDate'), '2026-09-20');

  await setTbc(true);
  await page.click('#saveDraft');
  draft = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentDraft')));
  assert.equal(draft.contractDueDate, '');
  assert.equal(draft.contractDueDateTbc, true);
  await setTbc(false);
  await page.click('#loadDraft');
  assert.equal(await page.isChecked('#contractDueDateTbc'), true);
  assert.equal(await page.isDisabled('#contractDueDate'), true);

  await page.evaluate(() => {
    const legacy = JSON.parse(localStorage.getItem('salesAppointmentDraft'));
    delete legacy.contractDueDate;
    delete legacy.contractDueDateTbc;
    localStorage.setItem('salesAppointmentDraft', JSON.stringify(legacy));
  });
  await page.click('#loadDraft');
  assert.equal(await page.inputValue('#contractDueDate'), '');
  assert.equal(await page.isChecked('#contractDueDateTbc'), false);
  assert.equal(await page.isDisabled('#contractDueDate'), false);

  page.once('dialog', dialog => dialog.accept());
  await page.evaluate(() => document.querySelector('#loadTestData').click());
  await setTbc(false);
  await page.fill('#contractDueDate', '');
  await page.click('#saveDraft');
  assert.ok(await page.evaluate(() => localStorage.getItem('salesAppointmentDraft')), 'blank state remains draftable');
  await page.click('#generateTop');
  await page.locator('#contractDueDateField .fieldError').waitFor({ timeout:10000 });
  assert.equal(await page.getAttribute('#contractDueDate', 'aria-invalid'), 'true');
  assert.equal(await page.getAttribute('#contractDueDateField .fieldError','id'),'err-contractDueDate');
  assert.match(await page.getAttribute('#contractDueDate','aria-describedby'),/err-contractDueDate/);
  assert.match(await page.getAttribute('#contractDueDateTbc','aria-describedby'),/err-contractDueDate/);
  assert.equal(await page.getAttribute('#contractDueDateField .fieldError','role'),'alert');
  assert.match(await page.textContent('#contractDueDateField .fieldError'), /Select a Contract Due Date or choose To Be Confirmed/);
  assert.doesNotMatch(await page.textContent('#status'), /PDF ready/);

  await setTbc(true);
  await page.click('#generateTop');
  await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Appointment package ready'), null, { timeout:30000 });

  assert.match(emailBefore, /Contract Due Date:/, 'Prompt 3 integrates the resolved due date into the email');
  assert.doesNotMatch(emailBefore, /Contract Issued:|downloaded to this device|attach both files/i);

  console.log('PASS Contract Due Date UI, exclusivity, drafts, validation, and mode contracts');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
