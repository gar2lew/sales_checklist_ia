import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = 'http://127.0.0.1:8766/';
const out = resolve(root, 'screenshots');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
let failures = 0;
const pass = (label) => console.log('  ok:', label);
const fail = (label) => { failures += 1; console.log('  FAIL:', label); };
const check = (label, cond) => (cond ? pass(label) : fail(label));

async function enterMode(mode, viewport) {
  const context = await browser.newContext({ acceptDownloads: true, viewport });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.setDefaultTimeout(60000);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.click(`.mode-card[data-mode="${mode}"]`);
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  const cls = mode === 'waiverOnly' ? 'show-waiver' : mode === 'inPerson' ? 'show-in-person' : 'show-zoom';
  await page.waitForSelector(`.app.${cls}`, { timeout: 10000 });
  await page.waitForTimeout(500);
  const mirrored = await page.evaluate((c) => document.body.classList.contains(c), cls);
  check(`body mirrors ${cls}`, mirrored);
  return { context, page, errors };
}

async function draw(page, selector) {
  const loc = page.locator(selector);
  await loc.scrollIntoViewIfNeeded();
  const box = await loc.boundingBox();
  if (!box) throw new Error(`${selector} has no bounding box`);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.55, { steps: 10 });
  await page.mouse.up();
}

const forbiddenSelectors = [
  '#appointmentSummaryCard', '#eoiDetailsCard', '#iaDetailsCard',
  '#clientIdSection', '#idPhotoUpload', '#checklistCard',
  '#saveCombinedPdf', '#savePackageZip', '#packageReadyZipRow'
];

async function assertWaiverForm(page, label) {
  console.log(`--- waiver-only form checks (${label}) ---`);
  check('heading is Waiver & Disclosure', (await page.textContent('#brandTitle')) === 'Waiver & Disclosure');
  check('timeline has 3 waiver steps', await page.locator('#timelineWaiver .timeline-step').count() === 3);
  check('appointment timeline hidden', await page.locator('#timelineInPerson').isHidden() && await page.locator('#timelineZoom').isHidden());
  for (const sel of forbiddenSelectors) {
    const count = await page.locator(sel).count();
    const hidden = count === 0 || await page.locator(sel).isHidden();
    check(`no visible ${sel}`, hidden);
  }
  check('no ZIP/Combined PDF actions', await page.locator('#saveCombinedPdf').isHidden() && await page.locator('#savePackageZip').isHidden());
}

async function fillWaiverAndGenerate(page, withClient2, shotPrefix) {
  await page.fill('#clientName', 'John Smith');
  await page.locator('#clientName').blur();
  check('clientName entered', (await page.inputValue('#clientName')) === 'John Smith');
  if (withClient2) {
    const toggle = page.locator('#waiverClient2Toggle');
    await toggle.scrollIntoViewIfNeeded();
    await page.check('#waiverClient2Toggle');
    check('toggle checked', await page.locator('#waiverClient2Toggle').isChecked());
    const c2 = page.locator('#client2Name');
    await c2.scrollIntoViewIfNeeded();
    await page.fill('#client2Name', 'Jane Smith');
    await page.locator('#client2Name').blur();
    await page.waitForSelector('#waiverClient2Block:not(.hidden)', { timeout: 10000 });
    check('Client 2 block visible', await page.locator('#waiverClient2Block').isVisible());
  }
  const sig = page.locator('#waiverSignatureSection');
  await sig.scrollIntoViewIfNeeded();
  await page.waitForSelector('#waiverSignatureSection:not([hidden])');
  if (shotPrefix) await page.screenshot({ path: resolve(out, `${shotPrefix}-form.png`), fullPage: true });
  await draw(page, '#signature');
  check('client1 date autofilled', /^\d{2}\/\d{2}\/\d{4}$/.test(await page.inputValue('#waiverClient1Date')));
  if (withClient2) {
    await draw(page, '#signature2');
    check('client2 date autofilled', /^\d{2}\/\d{2}\/\d{4}$/.test(await page.inputValue('#waiverClient2Date')));
  }
  console.log('--- generating waiver PDF ---');
  await page.click('#generateTop');
  await page.waitForFunction(() => new Set(['Waiver & Disclosure PDF ready.', 'Waiver & Disclosure Ready.']).has(
    (document.querySelector('#status') || {}).textContent), null, { timeout: 120000 });
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
  check('ready title is Waiver & Disclosure Ready', (await page.textContent('#appointmentPackageReadyTitle')) === 'Waiver & Disclosure Ready');
  check('downloadPackage visible', await page.locator('#downloadPackage').isVisible());
  check('preparePackageEmail visible', await page.locator('#preparePackageEmail').isVisible());
  check('saveCombinedPdf hidden', await page.locator('#saveCombinedPdf').isHidden());
  check('savePackageZip hidden', await page.locator('#savePackageZip').isHidden());
  check('zip row hidden', await page.locator('#packageReadyZipRow').isHidden());
  let downloadPath = null;
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      page.click('#downloadPackage')
    ]);
    downloadPath = resolve(out, `${shotPrefix}-waiver.pdf`);
    await download.saveAs(downloadPath);
    check(`downloaded ${shotPrefix}-waiver.pdf`, true);
  } catch (e) {
    fail(`download failed: ${e.message.split('\n')[0]}`);
  }
  if (shotPrefix) await page.screenshot({ path: resolve(out, `${shotPrefix}-ready.png`), fullPage: true });
  return downloadPath;
}

// 1. Waiver Only desktop
{
  const { context, page, errors } = await enterMode('waiverOnly', { width: 1440, height: 900 });
  await assertWaiverForm(page, 'desktop');
  const pdf = await fillWaiverAndGenerate(page, false, 'waiver-desktop');
  check('desktop no pageerrors', errors.length === 0, );
  if (errors.length) console.log('    pageerrors:', errors);
  await context.close();
}

// 2. Waiver Only mobile
{
  const { context, page, errors } = await enterMode('waiverOnly', { width: 390, height: 844 });
  await assertWaiverForm(page, 'mobile');
  check('mobile no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  const pdf = await fillWaiverAndGenerate(page, false, 'waiver-mobile');
  check('mobile ready no overflow', await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check('mobile no pageerrors', errors.length === 0);
  await context.close();
}

// 3. Client 1 only (desktop, just record)
{
  const { context, page } = await enterMode('waiverOnly', { width: 1440, height: 900 });
  await page.fill('#clientName', 'John Smith');
  await page.locator('#clientName').blur();
  const sig = page.locator('#waiverSignatureSection');
  await sig.scrollIntoViewIfNeeded();
  await page.waitForSelector('#waiverSignatureSection:not([hidden])');
  await draw(page, '#signature');
  check('client1-only valid (no client2 block)', (await page.locator('#waiverClient2Block').count()) === 0 || await page.locator('#waiverClient2Block').isHidden());
  await context.close();
}

// 4. Client 1 + Client 2 (desktop)
{
  const { context, page, errors } = await enterMode('waiverOnly', { width: 1440, height: 900 });
  const pdf = await fillWaiverAndGenerate(page, true, 'waiver-client2');
  check('client2 no pageerrors', errors.length === 0);
  await context.close();
}

// 5. In-Person without waiver
{
  const { context, page, errors } = await enterMode('inPerson', { width: 1440, height: 900 });
  await page.screenshot({ path: resolve(out, 'inperson-no-waiver.png'), fullPage: true });
  check('in-person show-in-person active', await page.locator('.app.show-in-person').count() === 1);
  await page.waitForSelector('#timelineInPerson:not([hidden])');
  const sigHidden = await page.locator('#waiverSignatureSection').isHidden();
  check('in-person without waiver hides waiver section', sigHidden);
  await context.close();
}

// 6. In-Person with waiver
{
  const { context, page, errors } = await enterMode('inPerson', { width: 1440, height: 900 });
  await page.locator('#includeWaiver').scrollIntoViewIfNeeded();
  await page.check('#includeWaiver');
  await page.waitForSelector('#waiverSignatureSection:not([hidden])');
  await page.screenshot({ path: resolve(out, 'inperson-with-waiver.png'), fullPage: true });
  check('in-person + waiver shows waiver section', await page.locator('#waiverSignatureSection').isVisible());
  await context.close();
}

// 7. Zoom without waiver
{
  const { context, page, errors } = await enterMode('zoom', { width: 1440, height: 900 });
  await page.screenshot({ path: resolve(out, 'zoom-no-waiver.png'), fullPage: true });
  await page.waitForSelector('#timelineZoom:not([hidden])');
  check('zoom without waiver hides waiver section', await page.locator('#waiverSignatureSection').isHidden());
  await context.close();
}

// 8. Zoom with waiver
{
  const { context, page, errors } = await enterMode('zoom', { width: 1440, height: 900 });
  await page.locator('#zoomIncludeWaiver').scrollIntoViewIfNeeded();
  await page.check('#zoomIncludeWaiver');
  await page.waitForSelector('#waiverSignatureSection:not([hidden])');
  await page.screenshot({ path: resolve(out, 'zoom-with-waiver.png'), fullPage: true });
  check('zoom + waiver shows waiver section', await page.locator('#waiverSignatureSection').isVisible());
  await context.close();
}

await browser.close();
console.log('');
console.log(failures === 0 ? 'GUISMOKE PASS' : `GUISMOKE FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);