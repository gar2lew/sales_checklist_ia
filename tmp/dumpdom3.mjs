import { chromium } from 'playwright';
const browser = await chromium.launch();

/* Part 2: zoom mode */
const ctx2 = await browser.newContext({ viewport:{width:1440,height:900} });
await ctx2.addInitScript(() => { window.confirm = () => true; });
const p2 = await ctx2.newPage();
await p2.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await p2.click('.mode-card[data-mode="zoom"]');
await p2.selectOption('#landingStaff', 'Garry Lewis');
await p2.click('#landingContinue');
await p2.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:5000 });
const zoom = await p2.evaluate(() => {
  const q = sel => { const el = document.querySelector(sel); if(!el) return {exists:false}; const cs = getComputedStyle(el); return { display:cs.display, visibility:cs.visibility }; };
  return {
    timelineZoom: q('#timelineZoom'),
    timelineInPerson: q('#timelineInPerson'),
    timelineWaiver: q('#timelineWaiver'),
    zoomInclude: q('#zoomIncludeWaiver'),
    firstConsultOption: (() => { const el = document.querySelector('[name="consultationType"], #consultationType'); return el ? { tag:el.tagName, value:el.value, checked: el.checked } : null; })(),
    consultSlider: (() => { const el = document.querySelector('#consultationSlider'); return el ? { value:el.value, type:el.type } : null; })(),
    bodyClass: document.body.className,
    appClass: document.querySelector('.app').className,
  };
});
console.log('ZOOM ' + JSON.stringify(zoom, null, 1));
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
  const canvases = Array.from(document.querySelectorAll('canvas')).map(c => ({
    id:c.id, w:c.width, h:c.height, disp:getComputedStyle(c).display,
    rect: (() => { const r = c.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  }));
  return { canvases, sigSection: document.getElementById('waiverSignatureSection') ? !document.getElementById('waiverSignatureSection').hidden : 'none' };
});
console.log('MOBILE ' + JSON.stringify(mob, null, 1));
await ctx3.close();
await browser.close();
