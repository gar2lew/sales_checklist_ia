import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
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
const observations = [];
try {
  for(const mode of ['inPerson','zoom']){
    for(const viewport of [
      {width:320,height:568},
      {width:375,height:667},
      {width:390,height:844},
      {width:393,height:852},
      {width:414,height:896},
      {width:844,height:390},
      {width:1024,height:768},
      {width:1280,height:800},
      {width:1440,height:900},
      {width:1920,height:1080}
    ]){
      const page = await browser.newPage({ viewport });
      await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
      await page.click(`.mode-card[data-mode="${mode}"]`);
      await page.selectOption('#landingStaff','Garry Lewis');
      await page.click('#landingContinue');
      if(mode === 'inPerson') await page.check('#includeEOI');

      const field = page.locator('#contractDueDateField');
      const date = page.locator('#contractDueDate');
      const tbc = page.locator('label[for="contractDueDateTbc"]');
      const nextAppointmentId = mode === 'zoom' ? 'crNextAppointmentDate' : 'eoiNextApptDate';
      assert.equal(await field.count(),1,`${mode} has one due-date section at ${viewport.width}px`);
      assert.equal(await field.isVisible(),true,`${mode} due-date section is visible at ${viewport.width}px`);
      assert.equal(await date.isVisible(),true,`${mode} date input is visible at ${viewport.width}px`);
      assert.equal(await tbc.isVisible(),true,`${mode} TBC label is visible at ${viewport.width}px`);
      assert.ok((await date.boundingBox()).height >= 44,`date input retains 44px at ${viewport.width}px`);
      assert.ok((await tbc.boundingBox()).height >= 44,`TBC label retains 44px at ${viewport.width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),true,`${viewport.width}px has no horizontal overflow`);
      assert.equal(await page.locator('#contractDueDateField').evaluate((group,{id,mode}) => {
        const target=document.getElementById(mode === 'zoom' ? id : 'inPersonNextAppointmentGroup');
        return group.parentElement === target?.parentElement && group.previousElementSibling === target;
      },{id:nextAppointmentId,mode}),true,`${mode} due-date group follows its complete Next Appointment group at ${viewport.width}px`);
      assert.equal(await page.locator('#appointmentInfoSection #contractDueDateField').count(),0,'due-date group is absent from the beginning of the form');
      assert.deepEqual(await page.evaluate(({id,mode}) => {
        const focusable=Array.from(document.querySelectorAll('input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),a[href]'));
        const start=focusable.indexOf(document.getElementById(id));
        return focusable.slice(start,start+(mode === 'zoom' ? 3 : 4)).map(el=>el.id);
      },{id:nextAppointmentId,mode}),mode === 'zoom'
        ? [nextAppointmentId,'contractDueDate','contractDueDateTbc']
        : [nextAppointmentId,'eoiNextApptTime','contractDueDate','contractDueDateTbc'],`${mode} keyboard order follows the requested placement`);
      observations.push({ mode, viewport, field:await field.boundingBox(), date:await date.boundingBox(), tbc:await tbc.boundingBox() });
      await page.close();
    }
  }

  const page = await browser.newPage({ viewport:{width:390,height:844} });
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="inPerson"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  assert.equal(await page.locator('#contractDueDateField').isVisible(),true,'due-date group remains visible when optional EOI details are hidden');
  assert.equal(await page.locator('#contractDueDateField').evaluate(group => group.previousElementSibling?.id),'eoiFormContent','hidden EOI content leaves due-date group in a visible fallback position');
  assert.equal(await page.locator('#contractDueDateField').getAttribute('role'),'group','due-date controls require an explicit accessible group');
  assert.equal(await page.locator('#contractDueDateField').getAttribute('aria-labelledby'),'contractDueDateLabel');
  assert.equal(await page.locator('#contractDueDateLabel').textContent(),'Contract Due Date');
  await page.close();

  console.log(JSON.stringify(observations,null,2));
  console.log('PASS Contract Due Date active-form visibility across modes and RC viewports');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
