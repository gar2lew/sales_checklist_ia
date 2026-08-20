import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/app.css', import.meta.url), 'utf8');
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

assert.match(html, /id="client1FinancePercentage"/);
assert.match(html, /id="client2FinancePercentage"/);
assert.match(html, /id="inPersonNextAppointmentGroup"/);
assert.match(html, /class="[^"]*sale-schedule-grid/);
assert.match(css, /\.sale-finance-grid/);
assert.match(css, /\.sale-schedule-grid/);
assert.match(source, /fieldText\('client1FinancePercentage'\)/, 'standard output reads Client 1 finance');
assert.doesNotMatch(source.slice(source.indexOf('function buildShareEmailContent'), source.indexOf('async function currentReadyPackage')), /client[12]FinancePercentage/, 'email remains unchanged');

const browser = await chromium.launch({ headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1280,height:800} });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="inPerson"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  await page.check('#includeEOI');

  const options = ['', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%'];
  assert.deepEqual(await page.locator('#client1FinancePercentage option').evaluateAll(items => items.map(item => item.value)), options);
  assert.deepEqual(await page.locator('#client2FinancePercentage option').evaluateAll(items => items.map(item => item.value)), options);
  assert.equal(await page.locator('label[for="client1FinancePercentage"]').textContent(), 'Client 1 Percentage of Finance');
  assert.equal(await page.locator('label[for="client2FinancePercentage"]').textContent(), 'Client 2 Percentage of Finance');
  assert.equal(await page.locator('#client2FinancePercentage').isVisible(), false, 'Client 2 finance is hidden while Client 2 is absent');
  assert.equal(await page.locator('#client2FinancePercentage').isDisabled(), true);

  await page.fill('#client2Name','Jenny Smith');
  await page.dispatchEvent('#client2Name','input');
  assert.equal(await page.locator('#client2FinancePercentage').isVisible(), true);
  assert.equal(await page.locator('#client2FinancePercentage').isEnabled(), true);
  assert.deepEqual(await page.evaluate(() => {
    const ids = ['client1FinancePercentage','client2FinancePercentage','eoiNextApptDate','eoiNextApptTime','contractDueDate','contractDueDateTbc'];
    return ids.map(id => document.getElementById(id)).map(el => ({ id:el.id, position:el.compareDocumentPosition(document.body) }));
  }).then(() => page.evaluate(() => Array.from(document.querySelectorAll('#client1FinancePercentage,#client2FinancePercentage,#eoiNextApptDate,#eoiNextApptTime,#contractDueDate,#contractDueDateTbc')).map(el => el.id))), ['client1FinancePercentage','client2FinancePercentage','eoiNextApptDate','eoiNextApptTime','contractDueDate','contractDueDateTbc']);
  assert.equal(await page.locator('#contractDueDateField').count(), 1);
  assert.equal(await page.locator('#saleDetailsSchedule #contractDueDateField').count(), 1);

  const wideBoxes = await page.evaluate(() => ({
    next:document.querySelector('#inPersonNextAppointmentGroup').getBoundingClientRect(),
    due:document.querySelector('#contractDueDateField').getBoundingClientRect()
  }));
  assert.ok(wideBoxes.next.left < wideBoxes.due.left, 'Contract Due Date is beside the appointment group on wide screens');

  let revision = await page.evaluate(() => window._testState.getDocumentRevision());
  await page.selectOption('#client1FinancePercentage','50%');
  assert.ok(await page.evaluate(() => window._testState.getDocumentRevision()) > revision, 'Client 1 finance changes invalidate generated output');
  revision = await page.evaluate(() => window._testState.getDocumentRevision());
  await page.selectOption('#client2FinancePercentage','30%');
  assert.ok(await page.evaluate(() => window._testState.getDocumentRevision()) > revision, 'Client 2 finance changes invalidate generated output');

  await page.selectOption('#client1FinancePercentage','70%');
  await page.selectOption('#client2FinancePercentage','40%');
  await page.click('#saveDraft');
  let draft = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentDraft')));
  assert.equal(draft.client1FinancePercentage,'70%');
  assert.equal(draft.client2FinancePercentage,'40%');
  assert.equal(draft.eoiFinancePercent,'70%', 'legacy compatibility projection follows Client 1');
  await page.selectOption('#client1FinancePercentage','10%');
  await page.selectOption('#client2FinancePercentage','20%');
  await page.click('#loadDraft');
  assert.equal(await page.inputValue('#client1FinancePercentage'),'70%');
  assert.equal(await page.inputValue('#client2FinancePercentage'),'40%');

  await page.evaluate(async () => window._testState.setDraft({ eoiFinancePercent:'80%', clientName:'John Smith', client2Name:'Jenny Smith' }));
  assert.equal(await page.inputValue('#client1FinancePercentage'),'80%', 'legacy value maps to Client 1');
  assert.equal(await page.inputValue('#client2FinancePercentage'),'', 'legacy value is not copied to Client 2');
  await page.evaluate(async () => window._testState.setDraft({ eoiFinancePercent:'105%', clientName:'John Smith' }));
  assert.equal(await page.inputValue('#client1FinancePercentage'),'', 'unsupported legacy values fail safely');

  await page.selectOption('#client1FinancePercentage','60%');
  await page.fill('#client2Name','Jenny Smith');
  await page.dispatchEvent('#client2Name','input');
  await page.selectOption('#client2FinancePercentage','30%');
  await page.fill('#client2Name','');
  await page.dispatchEvent('#client2Name','input');
  assert.equal(await page.inputValue('#client1FinancePercentage'),'60%', 'removing Client 2 does not affect Client 1');
  assert.equal(await page.locator('#client2FinancePercentage').isDisabled(),true);

  await page.setViewportSize({width:390,height:844});
  const mobileBoxes = await page.evaluate(() => ({
    next:document.querySelector('#inPersonNextAppointmentGroup').getBoundingClientRect(),
    due:document.querySelector('#contractDueDateField').getBoundingClientRect(),
    overflow:document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
  assert.ok(mobileBoxes.due.top >= mobileBoxes.next.bottom, 'Contract Due Date follows the complete appointment group on mobile');
  assert.equal(mobileBoxes.overflow,false);

  await page.click('#backToStart');
  await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  assert.equal(await page.locator('#client1FinancePercentage').isVisible(),false,'Zoom does not expose EOI finance controls');
  assert.equal(await page.locator('#client2FinancePercentage').isVisible(),false);
  assert.equal(await page.locator('#eoiNextApptTime').isVisible(),false,'Zoom does not expose an EOI time field');
  assert.equal(await page.locator('#contractDueDateField').evaluate(group => group.previousElementSibling?.id),'crNextAppointmentDate','Zoom keeps Contract Due Date beside Client Review date');
  await page.close();

  console.log('PASS Sale Details finance split, draft compatibility, responsive layout, and Zoom boundary');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
