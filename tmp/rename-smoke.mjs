import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
const server = http.createServer(async (request,response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url,'http://127.0.0.1').pathname);
    let file = path.resolve(root,pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!file.startsWith(root)) throw new Error('Forbidden');
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    response.writeHead(200,{'Content-Type':mime[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store'});
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});
await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
await context.addInitScript(() => {
  localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
    staff:{ mode:'text', options:['Smoke Test User'] },
    branch:{ options:['Perth','Brisbane'] }
  }));
});
const page = await context.newPage();
await page.goto(url,{waitUntil:'domcontentloaded'});

assert.equal(await page.title(),'Client Appointment Checklist','document title is renamed');
assert.match((await page.locator('#landingHeading').textContent()).replace(/\s+/g,' ').trim(),/Client Appointment\s*Checklist/i);
assert.equal((await page.locator('#landingFormTitle').textContent()).trim(),'Start New Appointment','landing form title unchanged product-independent');
assert.equal(await page.locator('.mode-card').count(),3,'three mode cards');

for (const mode of ['inPerson','zoom','waiverOnly']) {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.selectOption('#landingStaff','Smoke Test User');
  await page.click(`.mode-card[data-mode="${mode}"]`);
  assert.equal(await page.locator('#landingContinue').isEnabled(),true,`${mode}: continue enabled after mode`);
  await page.click('#landingContinue');
  const expectedClass = mode === 'inPerson' ? 'show-in-person' : mode === 'zoom' ? 'show-zoom' : 'show-waiver';
  await page.waitForSelector(`#mainApp.${expectedClass}`,{state:'attached',timeout:3000});
  assert.equal(await page.locator('#mainApp').isVisible(),true,`${mode}: main app visible after Continue`);
  const expectedBrand = mode === 'waiverOnly' ? 'Waiver & Disclosure' : 'Client Appointment Checklist';
  assert.equal((await page.locator('#brandTitle').textContent()).trim(),expectedBrand,`${mode}: header brand is corrected for the workflow`);
  const waiver = await page.locator('#waiverSignatureSection').isVisible();
  assert.equal(waiver, mode === 'waiverOnly',`${mode}: waiver stage visibility matches expected`);
  if (mode === 'zoom') {
    assert.equal(await page.locator('#zoomIncludeWaiver').isVisible(),true,'zoom: waiver opt-in toggle is present');
  }
}

assert.equal(await page.title(),'Client Appointment Checklist','title stable after mode traversal');
console.log('PASS GUI smoke: rename branding + mode entry across inPerson / zoom / waiverOnly');
await browser.close();
await new Promise(resolve => server.close(resolve));