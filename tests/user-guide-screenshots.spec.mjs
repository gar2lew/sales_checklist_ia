import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root=resolve(import.meta.dirname,'..');
const output=resolve(root,'docs/user-guides/source/screenshots');
const baseUrl='http://localhost:8766';
mkdirSync(output,{recursive:true});
let server=null;

async function reachable(){
  try{return (await fetch(baseUrl)).ok;}catch{return false;}
}
if(!await reachable()){
  server=spawn('python',['-m','http.server','8766','--bind','127.0.0.1'],{cwd:root,stdio:'ignore',windowsHide:true});
  for(let i=0;i<40 && !await reachable();i++) await new Promise(resolveWait=>setTimeout(resolveWait,250));
  assert.equal(await reachable(),true,'could not start the local screenshot server');
}

const browser=await chromium.launch({headless:true});
const settings={staff:{mode:'select',options:[{id:'test-user',name:'Test User',email:'',office:'Perth',role:'Demonstration',active:true}]},branch:{options:['Perth','Brisbane']},solicitor:{mode:'select',options:['B.O.S.S Conveyancing','Example Legal']}};

async function createPage(viewport){
  const context=await browser.newContext({viewport,deviceScaleFactor:2,serviceWorkers:'block'});
  await context.addInitScript(value=>{
    localStorage.clear();
    localStorage.setItem('salesAppointmentAdminSettings',JSON.stringify(value));
  },settings);
  const page=await context.newPage();
  await page.goto(baseUrl,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
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
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await locator.screenshot({path:resolve(output,name),animations:'disabled'});
}

try{
  const desktop=await createPage({width:1440,height:900});
  await desktop.page.screenshot({path:resolve(output,'01-appointment-type-selection.png'),animations:'disabled'});
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
  await desktop.page.screenshot({path:resolve(output,'02-in-person-workspace.png'),animations:'disabled'});
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
  await landscape.page.screenshot({path:resolve(output,'04-zoom-workspace.png'),animations:'disabled'});
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
  if(server){server.kill();await new Promise(resolveClose=>server.once('exit',resolveClose));}
}
