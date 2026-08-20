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

async function configure(context) {
  await context.addInitScript(() => localStorage.setItem('salesAppointmentAdminSettings',JSON.stringify({
    staff:{mode:'text',options:['Alex Morgan','Jordan Lee']},
    branch:{options:['Perth','Brisbane']}
  })));
}

async function openWorkspace(width,height) {
  const context = await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
  await configure(context);
  const page = await context.newPage();
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.selectOption('#landingStaff','Alex Morgan');
  await page.click('#landingContinue');
  return {context,page};
}

try {
  for (const [width,height] of [[430,932],[932,430]]) {
    const context = await browser.newContext({viewport:{width,height},colorScheme:'dark',serviceWorkers:'block'});
    await configure(context);
    const page = await context.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const colours = await page.evaluate(() => {
      const right = getComputedStyle(document.querySelector('.landing-right'));
      const select = getComputedStyle(document.querySelector('#landingStaff'));
      const label = getComputedStyle(document.querySelector('label[for="landingStaff"]'));
      const button = getComputedStyle(document.querySelector('#landingContinue'));
      return {
        scheme:getComputedStyle(document.querySelector('.landing-screen')).colorScheme,
        rightBackground:right.backgroundColor,
        rightText:right.color,
        selectBackground:select.backgroundColor,
        selectText:select.color,
        selectFill:select.webkitTextFillColor,
        labelText:label.color,
        buttonOpacity:Number(button.opacity),
        clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth
      };
    });
    assert.equal(colours.scheme,'light',`${width}x${height} landing explicitly opts into its light visual system`);
    assert.equal(colours.rightBackground,'rgb(251, 248, 241)',`${width}x${height} landing form has an opaque cream surface`);
    assert.equal(colours.selectBackground,'rgb(255, 255, 255)',`${width}x${height} staff select stays white in dark device appearance`);
    assert.equal(colours.selectText,'rgb(23, 32, 51)');
    assert.equal(colours.selectFill,'rgb(23, 32, 51)');
    assert.equal(colours.labelText,'rgb(14, 26, 46)');
    assert.ok(colours.buttonOpacity >= .55,'disabled primary action remains readable');
    assert.ok(colours.scrollWidth <= colours.clientWidth,'landing has no horizontal overflow');
    await context.close();
  }

  const targets = [[1920,1080,2],[1180,820,2],[1024,1366,1],[430,932,1],[932,430,1]];
  for (const [width,height,columns] of targets) {
    const {context,page} = await openWorkspace(width,height);
    const visual = await page.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector));
      const visible = element => element?.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
      const content = document.querySelector('.workspaceContent');
      const targets = [...document.querySelectorAll('button,input:not([type="checkbox"]):not([type="radio"]),select,textarea')]
        .filter(visible).map(element => ({id:element.id,height:element.getBoundingClientRect().height})).filter(item => item.height < 44);
      return {
        bodyBackground:css('body').backgroundColor,
        headerBackground:css('.stickyHeader').backgroundColor,
        headerText:css('.brandTitle').color,
        cardBackground:css('.workspaceContent .card').backgroundColor,
        cardRadius:css('.workspaceContent .card').borderRadius,
        summaryBackground:css('.appointment-summary-card').backgroundColor,
        summaryAccent:css('.appointment-summary-card').borderLeftColor,
        generateBackground:css('#generateTop').backgroundColor,
        footerBackground:css('.footerBar').backgroundColor,
        columns:content ? css('.workspaceContent').gridTemplateColumns.split(' ').length : 0,
        clientWidth:document.documentElement.clientWidth,
        scrollWidth:document.documentElement.scrollWidth,
        smallTargets:targets
      };
    });
    assert.equal(visual.bodyBackground,'rgb(243, 238, 229)','workspace uses the warm cream canvas');
    assert.equal(visual.headerBackground,'rgb(7, 26, 51)','workspace header uses premium navy');
    assert.equal(visual.headerText,'rgb(255, 255, 255)');
    assert.equal(visual.cardBackground,'rgb(255, 253, 248)','workspace cards use the ivory surface');
    assert.equal(visual.summaryBackground,'rgb(255, 253, 248)','summary uses the premium information surface');
    assert.equal(visual.summaryAccent,'rgb(201, 164, 92)','summary uses the restrained gold accent');
    assert.equal(visual.generateBackground,'rgb(201, 164, 92)','Generate PDF remains the gold primary action');
    assert.equal(visual.footerBackground,'rgb(255, 253, 248)','sticky footer belongs to the premium surface system');
    assert.equal(visual.columns,columns,`${width}x${height} retains the approved workspace composition`);
    assert.ok(parseFloat(visual.cardRadius) >= 14,'workspace cards use the premium radius');
    assert.ok(visual.scrollWidth <= visual.clientWidth,`${width}x${height} has no horizontal overflow`);
    assert.deepEqual(visual.smallTargets,[],`${width}x${height} visible targets remain at least 44px`);
    await context.close();
  }
  console.log('PASS premium workspace visual system and iOS colour stability');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
