import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.webmanifest':'application/manifest+json' };
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
  const context = await browser.newContext({serviceWorkers:'block'});
  await context.addInitScript(() => {
    localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
      staff:{ mode:'text', options:['Alex Morgan'] }, branch:{ options:['Perth'] }
    }));
  });
  const page = await context.newPage();
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.goto(`http://127.0.0.1:${server.address().port}`,{waitUntil:'domcontentloaded'});
  await page.evaluate(() => window._db.saveDraft({
    clientName:'Saved Client', teamMember:'Alex Morgan', date:'23/09/2026', appointmentMode:'inPerson', draftSavedAt:'2026-09-23T09:00:00.000Z'
  }));
  await page.reload({waitUntil:'domcontentloaded'});
  await page.selectOption('#landingStaff','Alex Morgan');
  await page.click('#landingContinue');
  await page.waitForTimeout(100);

  assert.deepEqual(dialogs,[],'starting a new appointment must not open draft-choice dialogs');
  assert.equal(await page.locator('#landingScreen').evaluate(element => element.classList.contains('hidden')),true,'new appointment opens the checklist');
  assert.equal(await page.locator('#clientName').inputValue(),'','new appointment does not restore saved client details');
  assert.equal(await page.locator('#teamMember').inputValue(),'Alex Morgan','new appointment keeps the selected staff member');
  await context.close();
  console.log('PASS new appointment starts clean while an existing draft remains resumable');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
