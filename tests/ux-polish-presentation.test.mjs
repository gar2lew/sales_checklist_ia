import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.jpg':'image/jpeg', '.png':'image/png', '.webmanifest':'application/manifest+json' };
const server = http.createServer(async (request, response) => {
  try {
    const urlPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let filePath = path.join(root, urlPath === '/' ? 'index.html' : urlPath.slice(1));
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, 'index.html');
    response.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream' });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404).end('Not found');
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless:true });
const testStaff = ['Responsive Test User','Keyboard User'];

async function seedStaff(context) {
  await context.addInitScript(options => localStorage.setItem('salesAppointmentAdminSettings',JSON.stringify({
    staff:{mode:'text',options},branch:{options:['Perth','Brisbane']}
  })),testStaff);
}

async function openWorkspace(width, height) {
  const context = await browser.newContext({ viewport:{ width, height }, serviceWorkers:'block' });
  await seedStaff(context);
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil:'domcontentloaded' });
  await page.selectOption('#landingStaff', 'Responsive Test User');
  await page.click('#landingContinue');
  return { context, page };
}

try {
  const landingContext = await browser.newContext({ viewport:{ width:1366, height:768 }, serviceWorkers:'block' });
  await seedStaff(landingContext);
  const landing = await landingContext.newPage();
  await landing.goto(baseUrl, { waitUntil:'domcontentloaded' });
  assert.equal(await landing.locator('#landingContinue').isDisabled(), true, 'Continue starts disabled');
  await landing.selectOption('#landingStaff', 'Keyboard User');
  assert.equal(await landing.locator('#landingContinue').isEnabled(), true, 'staff selection enables Continue');
  await landing.locator('#landingContinue').focus();
  assert.equal(await landing.evaluate(() => document.activeElement?.id), 'landingContinue', 'landing Continue remains keyboard focusable');
  await landing.click('#landingContinue');
  assert.equal(await landing.locator('#mainApp').isVisible(), true, 'Continue opens the target workspace');
  await landingContext.close();

  const targets = [
    [1920,1080,'split'], [1366,768,'split'], [1024,1366,'stacked'],
    [440,956,'compact'], [956,440,'compact'], [390,844,'compact'], [320,568,'compact']
  ];
  for (const [width,height,layout] of targets) {
    const { context, page } = await openWorkspace(width,height);
    const metrics = await page.evaluate(() => {
      const content = document.querySelector('.workspaceContent');
      const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
      return {
        clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        columns:content ? getComputedStyle(content).gridTemplateColumns.split(' ').length : 0,
        contentCount:document.querySelectorAll('.workspaceContent').length,
        summaryBeforeContent:document.querySelector('#appointmentSummaryCard')?.nextElementSibling === content,
        smallTargets:[...document.querySelectorAll('button,input:not([type=checkbox]):not([type=radio]),select,textarea')]
          .filter(visible).map(el => ({ id:el.id, height:el.getBoundingClientRect().height })).filter(item => item.height < 44),
        disclosureVisible:visible(document.querySelector('#summaryDisclosure')),
        detailsVisible:visible(document.querySelector('#summaryDetails')),
        moreVisible:visible(document.querySelector('#secondaryActionsTrigger')),
        secondaryInline:['loadTestData','openSettings'].every(id => visible(document.querySelector(`#${id}`))),
        disabledOutputs:['downloadTop','downloadPackageTop','shareTop'].map(id => visible(document.querySelector(`#${id}`))),
        footerActions:[...document.querySelectorAll('.footerButtons .btn')].filter(visible).map(el => el.id)
      };
    });
    assert.ok(metrics.scrollWidth <= metrics.clientWidth, `${width}x${height} has no horizontal overflow`);
    assert.equal(metrics.contentCount, 1, `${width}x${height} has one workspace grid`);
    assert.equal(metrics.summaryBeforeContent, true, `${width}x${height} summary spans above workspace`);
    assert.deepEqual(metrics.smallTargets, [], `${width}x${height} visible form and button targets are at least 44px`);
    if (layout === 'split') {
      assert.equal(metrics.columns, 2);
      assert.equal(metrics.moreVisible, false);
      assert.equal(metrics.secondaryInline, true);
    } else if (layout === 'stacked') {
      assert.equal(metrics.columns, 1);
    } else {
      assert.equal(metrics.columns, 1);
      assert.equal(metrics.disclosureVisible, true);
      assert.equal(metrics.detailsVisible, false);
      assert.equal(metrics.moreVisible, true);
      assert.ok(metrics.disabledOutputs.every(value => !value), `${width}x${height} disabled compact output actions stay hidden: ${metrics.disabledOutputs}`);
      assert.deepEqual(metrics.footerActions, ['resetForm','saveDraftBottom','generateBottom']);
    }
    await context.close();
  }

  const { context, page } = await openWorkspace(440,956);
  const requiredIds = [
    'landingScreen','landingStaff','landingContinue','mainApp','progressTimeline','timelineZoom','timelineInPerson',
    'appointmentSummaryCard','appointmentInfoSection','firstConsultSection','zoomOutputsSection','zoomWorkspaceSection',
    'clientName','client2Name','includeEOI','includeIA','backToStart','saveDraft','loadDraft','loadTestData',
    'generateTop','downloadTop','downloadPackageTop','shareTop','previewTop','openSettings','resetForm',
    'saveDraftBottom','generateBottom','downloadBottom','downloadPackageBottom','shareBottom'
  ];
  for (const id of requiredIds) assert.equal(await page.locator(`#${id}`).count(), 1, `${id} remains present exactly once`);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('[id]')].map(el => el.id).filter((id,index,all) => all.indexOf(id) !== index)), [], 'no duplicate IDs');

  const trigger = page.locator('#secondaryActionsTrigger');
  const menu = page.locator('#secondaryActionMenu');
  assert.equal(await trigger.getAttribute('aria-haspopup'), 'true');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(await trigger.getAttribute('aria-controls'), 'secondaryActionMenu');
  await trigger.click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await menu.isVisible(), true);
  await trigger.click();
  await trigger.focus();
  await page.keyboard.press('Enter');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true', 'Enter opens More actions');
  await page.keyboard.press('Escape');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'secondaryActionsTrigger', 'Escape restores focus');
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'loadTestData', 'Tab enters menu normally');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'secondaryActionsTrigger', 'Shift+Tab returns normally');
  await page.locator('#appointmentSummaryCard').click();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'outside pointer closes menu');

  const disclosure = page.locator('#summaryDisclosure');
  assert.equal(await disclosure.getAttribute('aria-controls'), 'summaryDetails');
  await disclosure.focus();
  assert.notEqual(await disclosure.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  await page.keyboard.press('Enter');
  assert.equal(await disclosure.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('#summaryDetails').isVisible(), true);
  await page.keyboard.press('Space');
  assert.equal(await disclosure.getAttribute('aria-expanded'), 'false');

  await page.fill('#date','17/07/2026');
  await page.fill('#clientName','Taylor Morgan');
  const footer = page.locator('#fileNamePreview');
  assert.match(await footer.innerText(), /\.pdf$/i, 'actual PDF filename remains unchanged');
  assert.match(await footer.getAttribute('data-compact-label'), /Taylor Morgan.+17\/07\/2026/);
  assert.match(await footer.getAttribute('title'), /\.pdf$/i);

  await trigger.click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.click('#loadTestData');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false', 'selecting a secondary action closes the menu');

  await page.click('#backToStart');
  assert.equal(await page.locator('#landingScreen').isVisible(), true, 'Back to Start retains target behavior');
  await context.close();
  console.log('PASS responsive presentation, accessibility, and target ID contracts');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
