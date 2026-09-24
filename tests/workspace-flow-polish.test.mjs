import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };
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
const browser = await chromium.launch({headless:true});

try {
  const context = await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await context.addInitScript(() => localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
    staff:{ mode:'text', options:['Alex Morgan'] }, branch:{ options:['Perth'] }
  })));
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
  await page.selectOption('#landingStaff','Alex Morgan');
  await page.click('#landingContinue');
  await page.waitForTimeout(100);

  assert.equal(await page.locator('#startFreshAppointment').isVisible(),true,'workspace exposes a compact fresh-start action');
  assert.equal(await page.locator('#eoiDetailsCard .collapse-toggle').getAttribute('aria-expanded'),'false','optional EOI section starts collapsed');
  assert.equal(await page.locator('#iaDetailsCard .collapse-toggle').getAttribute('aria-expanded'),'false','optional IA section starts collapsed');
  assert.equal(await page.locator('#nextRequiredItem').isVisible(),true,'summary shows the next required item');
  assert.match(await page.locator('#nextRequiredItem').textContent(),/Next:.*Client 1 Name/i,'summary identifies the first missing required item');
  assert.equal(await page.locator('#previewTop').evaluate(element => getComputedStyle(element.closest('.previewWrap')).position),'sticky','desktop output preview stays sticky');
  assert.equal(await page.locator('#importSettingsButton').count(),1,'settings import control remains available');
  await page.fill('#clientName','Temporary Client');
  await page.click('#startFreshAppointment');
  assert.equal(await page.locator('#clientName').inputValue(),'','fresh-start action clears the active client form');
  await context.close();

  const mobile = await browser.newContext({viewport:{width:430,height:932},serviceWorkers:'block'});
  await mobile.addInitScript(() => localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
    staff:{ mode:'text', options:['Alex Morgan'] }, branch:{ options:['Perth'] }
  })));
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
  await mobilePage.selectOption('#landingStaff','Alex Morgan');
  await mobilePage.click('#landingContinue');
  assert.equal(await mobilePage.locator('#previewTop').evaluate(element => getComputedStyle(element.closest('.previewWrap')).position),'relative','mobile output preview stays in normal flow');
  await mobile.close();
  console.log('PASS workspace flow polish keeps optional work compact and preserves import controls');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
