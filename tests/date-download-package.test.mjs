import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../css/app.css',import.meta.url),'utf8');
assert.match(html,/id="downloadPackage"[^>]*>Download Package</);
assert.doesNotMatch(html,/id="downloadPackage"[^>]*>Share Package</);
assert.match(html,/id="packageDownloadStatus"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(css,/:is\(#eoiNextApptDate,#crNextAppointmentDate,#contractDueDate\)/);

const mime={'.css':'text/css','.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
const server=createServer((request,response)=>{
  const pathname=new URL(request.url,'http://127.0.0.1').pathname;
  const relative=pathname==='/'?'index.html':decodeURIComponent(pathname.slice(1));
  const file=resolve(root,normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try{response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(readFileSync(file));}
  catch{response.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({headless:true});

async function enter(page,mode='inPerson'){
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  if(mode==='zoom') await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  if(mode==='inPerson') await page.check('#includeEOI');
}
async function installPackage(page,suffix=''){
  await page.evaluate(value=>{
    const pdf=new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'});
    const zip=new Blob(['PK\u0003\u0004data'],{type:'application/zip'});
    window._testState.setAppointmentPackageForTest({
      combinedPdfBlob:pdf,combinedPdfFile:new File([pdf],`Combined${value}.pdf`,{type:'application/pdf'}),
      zipBlob:zip,zipFile:new File([zip],`Documents${value}.zip`,{type:'application/zip'}),
      individualPdfs:[{blob:pdf,name:'EOI.pdf'}],generatedAt:new Date(),
      filenames:{combinedPdf:`Combined${value}.pdf`,zip:`Documents${value}.zip`,entries:['EOI.pdf']},
      revision:window._testState.getDocumentRevision()
    });
    window._testState.renderPackageReady('ready');
  },suffix);
}

try{
  for(const mode of ['inPerson','zoom']){
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await enter(page,mode);
    const nextId=mode==='zoom'?'crNextAppointmentDate':'eoiNextApptDate';
    for(const id of [nextId,'contractDueDate']){
      assert.equal(await page.getAttribute(`#${id}`,'type'),'date');
      const metrics=await page.locator(`#${id}`).evaluate(input=>{const style=getComputedStyle(input);const parentStyle=getComputedStyle(input.parentElement);return {width:input.getBoundingClientRect().width,parentWidth:input.parentElement.clientWidth-parseFloat(parentStyle.paddingLeft)-parseFloat(parentStyle.paddingRight),height:input.getBoundingClientRect().height,radius:style.borderRadius,fontSize:style.fontSize,color:style.color,background:style.backgroundColor,paddingLeft:style.paddingLeft,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth};});
      assert.ok(Math.abs(metrics.width-metrics.parentWidth)<=1,`${mode} ${id} fills its field`);
      assert.ok(metrics.height>=44);
      assert.equal(metrics.radius,'12px');
      assert.equal(metrics.fontSize,'16px');
      assert.equal(metrics.overflow,false);
      await page.fill(`#${id}`,'2026-08-15');
      assert.equal(await page.inputValue(`#${id}`),'2026-08-15','selected native date remains visible');
    }
    await page.check('#contractDueDateTbc');
    assert.equal(await page.locator('#contractDueDate').isDisabled(),true);
    await page.waitForTimeout(200);
    assert.ok(Number(await page.locator('#contractDueDate').evaluate(input=>getComputedStyle(input).opacity))<1,'TBC disabled styling is visible');
    await page.close();
  }

  const page=await browser.newPage({viewport:{width:390,height:844}});
  await enter(page);
  await installPackage(page);
  assert.equal(await page.locator('#downloadPackage').isVisible(),true);
  assert.equal(await page.getAttribute('#downloadPackage','aria-label'),null);
  assert.equal((await page.textContent('#downloadPackage')).trim(),'Download Package');
  for(const id of ['downloadPackage','saveCombinedPdf','savePackageZip','preparePackageEmail']) assert.equal(await page.locator(`#${id}`).isEnabled(),true);
  assert.deepEqual(await page.locator('.package-ready-actions button').evaluateAll(buttons=>buttons.filter(button=>!button.hidden).map(button=>button.id)),['downloadPackage','saveCombinedPdf','savePackageZip','preparePackageEmail']);

  await page.evaluate(()=>{
    window.__downloadCalls=[];
    window.__nativeAnchorClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){window.__downloadCalls.push(this.download);};
  });
  const countsBefore=await page.evaluate(()=>window._testState.getPackageGenerationCounts());
  await page.click('#downloadPackage');
  await page.waitForFunction(()=>window.__downloadCalls.length===2);
  assert.deepEqual(await page.evaluate(()=>window.__downloadCalls),['Combined.pdf','Documents.zip']);
  assert.deepEqual(await page.evaluate(()=>window._testState.getPackageGenerationCounts()),countsBefore,'Download Package reuses the generated package');
  assert.equal(await page.locator('#packageDownloadStatus').isVisible(),true);
  assert.match((await page.textContent('#packageDownloadStatus')).trim(),/^Downloads started\s+Please tap Prepare Email and attach the Combined PDF and Document ZIP from your Downloads\.$/);
  assert.doesNotMatch(await page.textContent('#packageDownloadStatus'),/attached automatically|already attached/i);
  assert.equal(await page.locator('#preparePackageEmail').isEnabled(),true);

  await page.click('#downloadPackage');
  await page.waitForFunction(()=>window.__downloadCalls.length===4);
  assert.deepEqual(await page.evaluate(()=>window.__downloadCalls),['Combined.pdf','Documents.zip','Combined.pdf','Documents.zip'],'repeated taps initiate clean pairs');
  assert.deepEqual(await page.evaluate(()=>window._testState.getPackageGenerationCounts()),countsBefore);

  await page.evaluate(()=>{window.__downloadCalls=[];let call=0;HTMLAnchorElement.prototype.click=function(){call++;if(call===2)throw new Error('blocked second download');window.__downloadCalls.push(this.download);};});
  await page.click('#downloadPackage');
  await page.waitForFunction(()=>document.querySelector('#packageDownloadStatus').textContent.includes('separate downloads'));
  assert.deepEqual(await page.evaluate(()=>window.__downloadCalls),['Combined.pdf']);
  assert.match(await page.textContent('#packageDownloadStatus'),/Your browser may require separate downloads\. Tap Save Combined PDF and Save ZIP below\./);
  assert.doesNotMatch(await page.textContent('#packageDownloadStatus'),/Downloads started/,'partial initiation never reports success');

  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=function(){window.__downloadCalls.push(this.download);};});
  await page.click('#downloadPackage');
  await page.waitForFunction(()=>document.querySelector('#packageDownloadStatus').textContent.includes('Downloads started'));
  assert.equal(await page.locator('#packageDownloadStatus').isVisible(),true);
  await page.fill('#clientName','Changed Client');
  await page.locator('#clientName').blur();
  assert.equal(await page.locator('#packageDownloadStatus').isHidden(),true,'package invalidation clears confirmation');
  assert.equal(await page.locator('#downloadPackage').isDisabled(),true,'stale package blocks package download');

  await installPackage(page,'-new');
  assert.equal(await page.locator('#packageDownloadStatus').isHidden(),true,'new package resets prior confirmation');
  assert.equal(await page.locator('#preparePackageEmail').isEnabled(),true);
  await page.evaluate(()=>{HTMLAnchorElement.prototype.click=window.__nativeAnchorClick;});

  for(const [width,height] of [[320,568],[375,667],[390,844],[393,852],[414,896],[844,390],[1024,768],[1280,800],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,`${width}x${height} has no horizontal overflow`);
  }
  await page.close();
  console.log('PASS native date styling, Download Package initiation/fallback, accessible guidance, stale reset, and workflow boundaries');
}finally{
  await browser.close();
  await new Promise(done=>server.close(done));
}
