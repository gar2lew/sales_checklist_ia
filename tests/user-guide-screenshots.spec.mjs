import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { chromium } from 'playwright';

import { SCREENSHOT_MANIFEST } from '../scripts/docs/config.mjs';
import { assertCaptureReady } from '../scripts/docs/screenshots.mjs';

const root=resolve(import.meta.dirname,'..');
const temporaryRoot=resolve(root,'.tmp/docs-user-guide/screenshots');
const output=resolve(process.env.DOCS_SCREENSHOT_OUTPUT??temporaryRoot);
const outputRelative=relative(temporaryRoot,output);
assert.ok(!outputRelative.startsWith('..')&&!resolve(temporaryRoot,outputRelative).localeCompare(output),'capture output must remain under .tmp/docs-user-guide/screenshots');
const baseUrl=process.env.DOCS_BASE_URL;
assert.ok(baseUrl,'DOCS_BASE_URL is required');
mkdirSync(output,{recursive:true});
assert.deepEqual(SCREENSHOT_MANIFEST.map(({filename})=>filename),[
  '01-appointment-type-selection.png','02-in-person-workspace.png','03-sale-details-mobile.png',
  '04-zoom-workspace.png','05-zoom-whiteboard.png','06-draft-controls.png',
  '07-id-signatures.png','08-package-ready.png','09-downloads-started.png'
]);

const browser=await chromium.launch({headless:true});
const settings={staff:{mode:'select',options:[{id:'test-user',name:'Test User',email:'',office:'Perth',role:'Demonstration',active:true}]},branch:{options:['Perth','Brisbane']},solicitor:{mode:'select',options:['B.O.S.S Conveyancing','Example Legal']}};
const fixedInstant='2026-07-22T10:00:00+08:00';
const captureCss='*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important;caret-color:transparent!important}';

async function createPage(viewport){
  const context=await browser.newContext({viewport,locale:'en-AU',timezoneId:'Australia/Perth',colorScheme:'light',reducedMotion:'reduce',deviceScaleFactor:2,serviceWorkers:'block',permissions:[]});
  await context.addInitScript(({value,frozenInstant})=>{
    const NativeDate=Date;
    const frozenTime=new NativeDate(frozenInstant).getTime();
    class FrozenDate extends NativeDate{
      constructor(...args){super(...(args.length?args:[frozenTime]));}
      static now(){return frozenTime;}
    }
    Object.setPrototypeOf(FrozenDate,NativeDate);
    globalThis.Date=FrozenDate;
    localStorage.clear();
    localStorage.setItem('salesAppointmentAdminSettings',JSON.stringify(value));
  },{value:settings,frozenInstant:fixedInstant});
  const page=await context.newPage();
  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.addStyleTag({content:captureCss});
  await page.waitForFunction(async()=>{await document.fonts.ready;return document.fonts.status==='loaded';});
  await page.waitForFunction(()=>document.readyState==='complete');
  return {context,page};
}

async function enter(page,mode){
  await page.click(`.mode-card[data-mode="${mode}"]`);
  await page.selectOption('#landingStaff','Test User');
  await page.click('#landingContinue');
  await page.waitForFunction(expected=>document.querySelector('.app').classList.contains(`show-${expected}`),mode==='zoom'?'zoom':'in-person');
}

async function fillCommon(page){
  const values={
    '#date':'22/07/2026','#clientAddress':'10 Example Street, Perth WA 6000',
    '#propertySaleAddress':'Test Property, Perth WA 6000','#clientName':'John Smith',
    '#clientPhone':'0400 000 001','#clientEmail':'john.smith@example.test',
    '#client2Name':'Jenny Smith','#client2Phone':'0400 000 002','#client2Email':'jenny.smith@example.test'
  };
  for(const [selector,value] of Object.entries(values)) await page.locator(selector).fill(value);
  await page.locator('#client2Name').dispatchEvent('change');
}

async function captureLocator(page,selector,name){
  const locator=page.locator(selector);
  await assertCaptureReady({page,locator,filename:name,selector});
  await locator.screenshot({path:resolve(output,name),animations:'disabled'});
}

async function capturePage(page,name){
  const body=page.locator('body');
  await assertCaptureReady({page,locator:body,filename:name,selector:'body'});
  await page.screenshot({path:resolve(output,name),animations:'disabled'});
}

try{
  const desktop=await createPage({width:1440,height:900});
  await capturePage(desktop.page,'01-appointment-type-selection.png');
  await enter(desktop.page,'inPerson');
  await fillCommon(desktop.page);
  await desktop.page.check('#includeEOI');
  await desktop.page.check('#includeIA');
  await desktop.page.selectOption('#eoiSaleType','House and Land');
  await desktop.page.fill('#eoiPriceLand','$320,000');
  await desktop.page.fill('#eoiPriceHouse','$480,000');
  await desktop.page.fill('#eoiPriceTotal','$800,000');
  await desktop.page.selectOption('#client1FinancePercentage','80%');
  await desktop.page.selectOption('#client2FinancePercentage','70%');
  await desktop.page.fill('#eoiNextApptDate','2026-08-05');
  await desktop.page.selectOption('#eoiNextApptTime','2:30 PM');
  await desktop.page.check('#contractDueDateTbc');
  await desktop.page.selectOption('#eoiBranch','Perth');
  await desktop.page.evaluate(()=>scrollTo(0,0));
  await capturePage(desktop.page,'02-in-person-workspace.png');
  await captureLocator(desktop.page,'#clientIdSection','07-id-signatures.png');
  await desktop.context.close();

  const mobile=await createPage({width:390,height:844});
  await enter(mobile.page,'inPerson');
  await fillCommon(mobile.page);
  await mobile.page.check('#includeEOI');
  await mobile.page.selectOption('#eoiSaleType','House and Land');
  await mobile.page.selectOption('#client1FinancePercentage','80%');
  await mobile.page.selectOption('#client2FinancePercentage','70%');
  await mobile.page.fill('#eoiNextApptDate','2026-08-05');
  await mobile.page.selectOption('#eoiNextApptTime','2:30 PM');
  await mobile.page.check('#contractDueDateTbc');
  await captureLocator(mobile.page,'#eoiDetailsCard','03-sale-details-mobile.png');
  await captureLocator(mobile.page,'.headerActions','06-draft-controls.png');

  await mobile.page.evaluate(()=>{
    const pdf=new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'});
    const zip=new Blob(['PK\u0003\u0004demo'],{type:'application/zip'});
    const revision=window._testState.getDocumentRevision();
    window._testState.setAppointmentPackageForTest({
      combinedPdfBlob:pdf,combinedPdfFile:new File([pdf],'Sales Appointment - 22-07-2026 - John Smith & Jenny Smith - Test User.pdf',{type:'application/pdf'}),
      zipBlob:zip,zipFile:new File([zip],'22-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip',{type:'application/zip'}),
      individualPdfs:[{blob:pdf,name:'EOI - John Smith & Jenny Smith - Test Property - Test User - 22-07-2026.pdf'}],
      generatedAt:new Date('2026-07-22T10:00:00+08:00'),revision,
      filenames:{combinedPdf:'Sales Appointment - 22-07-2026 - John Smith & Jenny Smith - Test User.pdf',zip:'22-07-2026 - John Smith & Jenny Smith - Sales Appointment Documents.zip',entries:['EOI - John Smith & Jenny Smith - Test Property - Test User - 22-07-2026.pdf']}
    });
    window._testState.renderPackageReady('ready');
  });
  await captureLocator(mobile.page,'#appointmentPackageReady','08-package-ready.png');
  await mobile.page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){};});
  await mobile.page.click('#downloadPackage');
  await mobile.page.waitForFunction(()=>document.querySelector('#packageDownloadStatus').textContent.includes('Downloads started'));
  await captureLocator(mobile.page,'#appointmentPackageReady','09-downloads-started.png');
  await mobile.context.close();

  const landscape=await createPage({width:844,height:390});
  await enter(landscape.page,'zoom');
  await fillCommon(landscape.page);
  await landscape.page.fill('#crNextAppointmentDate','2026-08-05');
  await landscape.page.fill('#contractDueDate','2026-08-30');
  await landscape.page.evaluate(()=>scrollTo(0,0));
  await capturePage(landscape.page,'04-zoom-workspace.png');
  const canvas=landscape.page.locator('#whiteboardCanvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  assert.ok(box?.width>100 && box?.height>100,'whiteboard is not visible');
  await landscape.page.mouse.move(box.x+60,box.y+80);
  await landscape.page.mouse.down();
  await landscape.page.mouse.move(box.x+180,box.y+150,{steps:12});
  await landscape.page.mouse.move(box.x+300,box.y+90,{steps:12});
  await landscape.page.mouse.up();
  await captureLocator(landscape.page,'#zoomWorkspaceSection','05-zoom-whiteboard.png');
  await landscape.context.close();

  console.log(`PASS captured 9 privacy-safe guide screenshots at 390x844, 844x390, and 1440x900`);
}finally{
  await browser.close();
}
