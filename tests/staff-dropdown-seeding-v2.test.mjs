import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless:true });
const seededNames = ['Blake Duffield', 'Joe Villiers-Dunn', 'Josh Robinson', 'Mike Enderby', 'Garry Lewis', 'Natalie Simmich', 'Sam Roberts'];
const seededRecords = [
  { id:'blake-duffield', name:'Blake Duffield', email:'Blake@amplifysolutionsgroup.com.au', office:'Both', role:'SMSF & Property Liaison', active:true },
  { id:'joe-villiers-dunn', name:'Joe Villiers-Dunn', email:'Joe@amplifysolutionsgroup.com.au', office:'Both', role:'SMSF & Property Liaison', active:true },
  { id:'josh-robinson', name:'Josh Robinson', email:'Josh@amplifysolutionsgroup.com.au', office:'Both', role:'Business Development Manager', active:true },
  { id:'mike-enderby', name:'Mike Enderby', email:'Mike@amplifysolutionsgroup.com.au', office:'Both', role:'SMSF & Property Liaison', active:true },
  { id:'garry-lewis', name:'Garry Lewis', email:'Garry@sjssolutionscorp.com.au', office:'Both', role:'Super Admin', active:true },
  { id:'nat-simmich', name:'Natalie Simmich', email:'Natalie@sjssolutionscorp.com.au', office:'Both', role:'Admin', active:true },
  { id:'sam-roberts', name:'Sam Roberts', email:'Sam@amplifysolutionsgroup.com.au', office:'Both', role:'Owner/CEO', active:true }
];
assert.equal(new Set(seededRecords.map(record => record.id.toLowerCase())).size, seededRecords.length, 'seed IDs are unique case-insensitively');
assert.equal(new Set(seededRecords.map(record => record.name.toLowerCase())).size, seededRecords.length, 'seed names are unique case-insensitively');
assert.ok(seededRecords.every(record => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)), 'seed emails are valid');
assert.ok(seededRecords.every(record => ['Perth','Brisbane','Both'].includes(record.office)), 'seed office assignments are approved');
assert.ok(seededRecords.every(record => typeof record.active === 'boolean'), 'seed active states are explicit booleans');

async function openApp({ settings, draft, lastStaff } = {}) {
  const context = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block' });
  await context.addInitScript(state => {
    if (state.settings !== undefined) localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify(state.settings));
    if (state.draft !== undefined) localStorage.setItem('salesAppointmentDraft', JSON.stringify(state.draft));
    if (state.lastStaff !== undefined) localStorage.setItem('salesAppointmentLastStaff', state.lastStaff);
  }, { settings, draft, lastStaff });
  const page = await context.newPage();
  await page.goto(url, { waitUntil:'networkidle' });
  return { context, page };
}

const metadataSettings = options => ({
  staff:{ mode:'select', options },
  branch:{ options:['Perth','Brisbane'] }
});

try {
  {
    const { context, page } = await openApp();
    assert.equal(await page.locator('#landingStaff').evaluate(element => element.tagName), 'SELECT');
    assert.equal(await page.locator('#teamMember').evaluate(element => element.tagName), 'SELECT');
    assert.deepEqual(await page.locator('#landingStaff option').allTextContents(), ['Choose your name', ...seededNames], 'fresh profiles expose the approved seed in exact order');
    assert.equal(await page.locator('#landingStaff option').first().getAttribute('disabled'), '', 'placeholder must be disabled');
    assert.equal(await page.locator('#landingStaff').isDisabled(), false, 'approved seed enables staff selection');
    assert.equal(await page.locator('#landingContinue').isDisabled(), true, 'empty staff configuration blocks Continue');
    assert.equal(await page.locator('#landingStaffConfiguration').isVisible(), false, 'valid seed hides configuration guidance');
    assert.equal(await page.locator('#configureStaffFromLanding').getAttribute('aria-controls'), 'settingsOverlay');
    assert.ok(await page.locator('#landingStaff').evaluate(element => element.getBoundingClientRect().height >= 44));
    await context.close();
  }

  {
    const { context, page } = await openApp({ settings:{ staff:{ mode:'text', options:['', 'Legacy Staff', 'legacy staff', 'Second Staff'] } } });
    assert.deepEqual(await page.locator('#landingStaff option').allTextContents(), ['Choose your name','Legacy Staff','Second Staff', ...seededNames], 'legacy strings migrate and retain seeded defaults');
    assert.equal(await page.locator('#teamMember').evaluate(element => element.tagName), 'SELECT', 'legacy text mode cannot create free-text appointment fields');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentAdminSettings')));
    assert.deepEqual(stored.staff.options, ['', 'Legacy Staff', 'legacy staff', 'Second Staff'], 'migration is not persisted merely by loading');
    await context.close();
  }

  {
    const options = [
      { id:'alex-morgan', name:'Alex Morgan', email:'alex@example.com', office:'Perth', active:true },
      { id:'inactive-user', name:'Inactive User', email:'inactive@example.com', office:'Brisbane', active:false },
      { name:'Partial User', email:'', office:'', active:true },
      'Legacy User',
      { id:'duplicate-alex', name:'alex morgan', email:'other@example.com', office:'Perth', active:true }
    ];
    const { context, page } = await openApp({ settings:metadataSettings(options) });
    assert.deepEqual(await page.locator('#landingStaff option').allTextContents(), ['Choose your name','Alex Morgan','Partial User','Legacy User', ...seededNames]);
    await page.selectOption('#landingStaff', 'Alex Morgan');
    await page.click('#landingContinue');
    assert.equal(await page.inputValue('#teamMember'), 'Alex Morgan', 'landing selection synchronises to workspace');
    assert.equal(await page.locator('#teamMember').evaluate(element => element.tagName), 'SELECT');
    assert.ok(!(await page.locator('#teamMember option').allTextContents()).includes('Inactive User'));
    await context.close();
  }

  {
    const inactive = { id:'inactive-user', name:'Inactive User', email:'inactive@example.com', office:'Brisbane', active:false };
    const draft = { appointmentMode:'inPerson', teamMember:'Inactive User', clientName:'Legacy Draft Client', date:'20/07/2026' };
    const { context, page } = await openApp({ settings:metadataSettings([inactive]), draft });
    await page.click('#resumeDraftBtn');
    assert.equal(await page.locator('#teamMember').evaluate(element => element.tagName), 'SELECT');
    assert.equal(await page.inputValue('#teamMember'), 'Inactive User', 'inactive staff referenced by a draft remains recoverable');
    assert.ok((await page.locator('#teamMember option').allTextContents()).includes('Inactive User'));
    await context.close();
  }

  {
    const { context, page } = await openApp();
    await page.evaluate(() => document.querySelector('#configureStaffFromLanding').click());
    await page.fill('#settingsPin', '1234');
    await page.click('#unlockSettings');
    await page.click('#addStaffOption');
    const row = page.locator('#staffOptionsList .adminOption');
    assert.equal(await row.count(), 8);
    const configuredRow = row.last();
    await configuredRow.locator('.staff-option-name').fill('Configured User');
    await configuredRow.locator('.staff-option-email').fill('configured@example.com');
    await configuredRow.locator('.staff-option-office').fill('Perth');
    await configuredRow.locator('.staff-option-role').fill('');
    await configuredRow.locator('.staff-option-active').uncheck();
    let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentAdminSettings')));
    assert.deepEqual(stored.staff.options[0], seededRecords[0]);
    assert.deepEqual(stored.staff.options[7], {
      id:'configured-user', name:'Configured User', email:'configured@example.com', office:'Perth', role:'', active:false
    });
    await configuredRow.locator('.staff-option-active').check();
    await page.click('#closeSettings');
    assert.deepEqual(await page.locator('#landingStaff option').allTextContents(), ['Choose your name', ...seededNames, 'Configured User'], 'settings changes repopulate landing select');
    await context.close();
  }

  {
    const { context, page } = await openApp();
    await page.evaluate(() => document.querySelector('#configureStaffFromLanding').click());
    await page.fill('#settingsPin', '1234');
    await page.click('#unlockSettings');
    const rows = page.locator('#staffOptionsList .adminOption');
    assert.equal(await rows.count(), seededRecords.length, 'Global Settings renders each seeded record once');
    for(let index=0; index<seededRecords.length; index += 1){
      const row = rows.nth(index);
      const expected = seededRecords[index];
      assert.equal(await row.locator('.staff-option-name').inputValue(), expected.name);
      assert.equal(await row.locator('.staff-option-email').inputValue(), expected.email);
      assert.equal(await row.locator('.staff-option-office').inputValue(), expected.office);
      assert.equal(await row.locator('.staff-option-role').inputValue(), expected.role);
      assert.equal(await row.locator('.staff-option-active').isChecked(), expected.active);
    }
    await rows.nth(5).locator('.staff-option-role').fill('Updated Role');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('salesAppointmentAdminSettings')));
    assert.equal(stored.staff.options[5].role, 'Updated Role', 'role edits persist without affecting behavior');
    await context.close();
  }

  async function preparedEmailFor(staff) {
    const { context, page } = await openApp({ settings:metadataSettings([staff]) });
    await page.selectOption('#landingStaff', staff.name);
    await page.click('#landingContinue');
    page.once('dialog', dialog => dialog.accept());
    await page.evaluate(() => document.querySelector('#loadTestData').click());
    await page.selectOption('#teamMember', staff.name);
    await page.click('#generateTop');
    await page.waitForFunction(() => document.querySelector('#status')?.textContent.includes('Appointment package ready'), null, { timeout:30000 });
    await page.evaluate(() => document.querySelector('#openPreparedEmail').addEventListener('click', event => event.preventDefault(), { once:true, capture:true }));
    await page.click('#preparePackageEmail');
    await page.waitForFunction(() => document.querySelector('#openPreparedEmail').getAttribute('href').startsWith('mailto:'));
    const href = await page.getAttribute('#openPreparedEmail', 'href');
    await context.close();
    return href;
  }

  assert.match(
    await preparedEmailFor({ id:'email-staff', name:'Email Staff', email:'email.staff@example.com', office:'Perth', active:true }),
    /^mailto:Natalie%40sjssolutionscorp\.com\.au\?cc=email\.staff%40example\.com&/,
    'selected active staff email becomes CC'
  );
  assert.match(
    await preparedEmailFor({ id:'fallback-staff', name:'Fallback Staff', email:'', office:'Perth', active:true }),
    /^mailto:Natalie%40sjssolutionscorp\.com\.au\?cc=Garry%40sjssolutionscorp\.com\.au&/,
    'configured fallback CC is used when selected staff has no email'
  );
  assert.doesNotMatch(
    await preparedEmailFor({ id:'duplicate-recipient', name:'Duplicate Recipient', email:'Natalie@sjssolutionscorp.com.au', office:'Perth', active:true }),
    /[?&]cc=/,
    'primary recipient is never duplicated as CC'
  );

  assert.match(
    await preparedEmailFor(seededRecords.find(record => record.id === 'garry-lewis')),
    /^mailto:Natalie%40sjssolutionscorp\.com\.au\?cc=Garry%40sjssolutionscorp\.com\.au&/,
    'Garry selection uses the approved staff email as CC'
  );
  assert.doesNotMatch(
    await preparedEmailFor(seededRecords.find(record => record.id === 'nat-simmich')),
    /[?&]cc=/,
    'Natalie selection does not duplicate the primary recipient as CC'
  );

  console.log('PASS staff dropdown metadata migration and selection contracts');
} finally {
  await browser.close();
  server.close();
}
