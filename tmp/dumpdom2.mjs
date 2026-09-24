import { chromium } from 'playwright';
const browser = await chromium.launch();

/* Part 1: waiver ready modal */
const ctx1 = await browser.newContext({ viewport:{width:1440,height:900} });
await ctx1.addInitScript(() => { window.confirm = () => true; });
const p1 = await ctx1.newPage();
await p1.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await p1.click('.mode-card[data-mode="waiverOnly"]');
await p1.selectOption('#landingStaff', 'Garry Lewis');
await p1.click('#landingContinue');
await p1.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
await p1.fill('#clientName', 'Fictional Test Client');
await p1.locator('#signature').scrollIntoViewIfNeeded();
const b = await p1.locator('#signature').boundingBox();
await p1.mouse.move(b.x+40, b.y+b.height/2); await p1.mouse.down();
await p1.mouse.move(b.x+b.width-40, b.y+b.height/2, { steps:8 }); await p1.mouse.up();
await p1.click('#generateTop');
await p1.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:30000 });
const ready = await p1.evaluate(() => {
  const q = sel => { const el = document.querySelector(sel); if(!el) return {exists:false}; const cs = getComputedStyle(el); return { display:cs.display, h:Math.round(el.getBoundingClientRect().height) }; };
  return { saveCombined: q('#saveCombinedPdf'), saveZip: q('#savePackageZip'), zipRow: q('#packageReadyZipRow'), download: q('#downloadPackage'), email: q('#preparePackageEmail'), actionsGrid: getComputedStyle(document.querySelector('.package-ready-actions')).gridTemplateColumns };
});
console.log('READY ' + JSON.stringify(ready));
await ctx1.close();

/* Part 2: zoom mode */
const ctx2 = await browser.newContext({ viewport:{width:1440,height:900} });
await ctx2.addInitScript(() => { window.confirm = () => true; });
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await p2.click('.mode-card[data-mode="zoom"]');
await p2.click('#landingContinue');
await p2.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:5000 });
const zoom = await p2.evaluate(() => {
  const q = sel => { const el = document.querySelector(sel); if(!el) return {exists:false}; const cs = getComputedStyle(el); return { display:cs.display, bodyClass: document.body.className, appClass: document.querySelector('.app').className }; };
  return { timelineZoom: q('#timelineZoom'), zoomInclude: q('#zoomIncludeWaiver'), firstConsult: q('#firstConsult') ? q('#firstConsult') : null, mode: (typeof appointmentMode !== 'undefined') ? appointmentMode : q('') };
});
console.log('ZOOM ' + JSON.stringify(zoom));
await ctx2.close();

/* Part 3: mobile pads */
const ctx3 = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await ctx3.addInitScript(() => { window.confirm = () => true; });
const p3 = await ctx3.newPage();
await p3.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await p3.click('.mode-card[data-mode="waiverOnly"]');
await p3.selectOption('#landingStaff', 'Garry Lewis');
await p3.click('#landingContinue');
await p3.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
const mob = await p3.evaluate(() => {
  const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({ id:c.id, w:c.width, h:c.height, disp:getComputedStyle(c).display }));
  return { canvases, sigSectionHidden: document.getElementById('waiverSignatureSection').hidden, appClass: document.querySelector('.app').className, bodyClass: document.body.className };
});
console.log('MOBILE ' + JSON.stringify(mob));
await ctx3.close();
await browser.close();
