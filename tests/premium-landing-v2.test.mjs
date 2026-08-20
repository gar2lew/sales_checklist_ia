import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const baseCommit = '3cb751f5de3b15701ccce869ab8d7f1df4ae13a9';
const baseHtml = execFileSync('git',['show',`${baseCommit}:index.html`],{cwd:root,encoding:'utf8'});
const idsFrom = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const targetIds = [...new Set(idsFrom(baseHtml))];
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
const configuredStaff = ['Alex Morgan','Jordan Lee'];

async function seedConfiguredStaff(context) {
  await context.addInitScript(options => {
    localStorage.setItem('salesAppointmentAdminSettings', JSON.stringify({
      staff:{ mode:'text', options },
      branch:{ options:['Perth','Brisbane'] }
    }));
  }, configuredStaff);
}

async function inspectViewport(width,height,expectedLayout) {
  const context = await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  const page = await context.newPage();
  await page.goto(`${url}/?premium=${width}x${height}`,{waitUntil:'domcontentloaded'});
  const result = await page.evaluate(() => {
    const container = document.querySelector('.landing-container');
    const visible = element => element?.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
    const controls = [...document.querySelectorAll('#landingScreen button,#landingScreen input,#landingScreen select')].filter(visible);
    return {
      premiumStructure:['landing-outer','landing-container','landing-left','landing-right'].every(name => document.querySelector(`.${name}`)),
      columns:container ? getComputedStyle(container).gridTemplateColumns.split(' ').length : 0,
      clientWidth:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
      smallTargets:controls.map(element => ({id:element.id,height:element.getBoundingClientRect().height,width:element.getBoundingClientRect().width})).filter(target => target.height < 44 || target.width < 44),
      heading:document.querySelector('.landing-heading')?.textContent.replace(/\s+/g,' ').trim(),
      formTitle:document.querySelector('.landing-form-title')?.textContent.trim(),
      landingVisible:visible(document.querySelector('#landingScreen'))
    };
  });
  assert.equal(result.premiumStructure,true,`${width}x${height} has premium split-panel structure`);
  assert.ok(result.scrollWidth <= result.clientWidth,`${width}x${height} has no horizontal overflow`);
  assert.deepEqual(result.smallTargets,[],`${width}x${height} landing targets are at least 44px`);
  assert.match(result.heading,/Sales Appointment\s*Capture/i);
  assert.equal(result.formTitle,'Start New Appointment');
  assert.equal(result.columns,expectedLayout === 'split' ? 2 : 1,`${width}x${height} uses ${expectedLayout} landing composition`);
  assert.equal(result.landingVisible,true,'landing remains the active entry surface before Continue');
  await context.close();
}

try {
  const currentHtml = await readFile(path.join(root,'index.html'),'utf8');
  const currentIds = idsFrom(currentHtml);
  const uniqueCurrentIds = [...new Set(currentIds)];
  assert.ok(targetIds.length >= 301,'v2 base retains the original 301-ID contract plus presentation IDs');
  assert.deepEqual(targetIds.filter(id => !uniqueCurrentIds.includes(id)),[],'zero target IDs removed');
  assert.deepEqual(currentIds.filter((id,index) => currentIds.indexOf(id) !== index),[],'zero duplicate IDs');

  await inspectViewport(1920,1080,'split');
  await inspectViewport(1366,768,'split');
  await inspectViewport(1180,820,'split');
  await inspectViewport(1024,1366,'stacked');
  await inspectViewport(430,932,'stacked');
  await inspectViewport(932,430,'stacked');

  for (const mode of ['inPerson','zoom']) {
    const context = await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
    await seedConfiguredStaff(context);
    const page = await context.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.equal(await page.locator('#landingStaff').evaluate(element => element.tagName),'SELECT','configured staff is presented as a native select');
    assert.deepEqual(await page.locator('#landingStaff option').allTextContents(),['Choose your name',...configuredStaff,'Blake Duffield','Joe Villiers-Dunn','Josh Robinson','Mike Enderby','Garry Lewis','Natalie Simmich','Sam Roberts'],'landing options include saved staff followed by authoritative defaults');
    await page.selectOption('#landingStaff','Alex Morgan');
    await page.click(`.mode-card[data-mode="${mode}"]`);
    assert.equal(await page.locator('#landingContinue').isEnabled(),true,'staff entry enables current v2 Continue control');
    await page.click('#landingContinue');
    assert.equal(await page.locator('#landingScreen').evaluate(element => element.classList.contains('hidden')),true);
    assert.equal(await page.locator('#mainApp').isVisible(),true);
    assert.equal(await page.locator('#mainApp').evaluate((element,currentMode) => element.classList.contains(currentMode === 'zoom' ? 'show-zoom' : 'show-in-person'),mode),true,`${mode} enters the correct v2 workflow`);
    await page.fill('#clientName','Landing Contract Client');
    assert.equal(await page.locator('#clientName').inputValue(),'Landing Contract Client','v2 client workflow remains available after entry');
    await context.close();
  }
  console.log('PASS premium v2 landing presentation and workflow contract');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
