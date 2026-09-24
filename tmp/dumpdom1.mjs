import { chromium } from 'playwright';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport:{width:1440,height:900} });
await context.addInitScript(() => { window.confirm = () => true; });
const page = await context.newPage();
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
const info = await page.evaluate(() => {
  const q = sel => {
    const el = document.querySelector(sel);
    if(!el) return { exists:false };
    const cs = getComputedStyle(el);
    return { exists:true, tag:el.tagName, hidden:el.hasAttribute('hidden'), display:cs.display, visibility:cs.visibility, opacity:cs.opacity, rect:(()=>{const r=el.getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height)]})(), inDoc:!!el.offsetParent };
  };
  return {
    toggle: q('#waiverClient2Toggle'),
    toggleAncestors: (() => {
      const el = document.getElementById('waiverClient2Toggle');
      if(!el) return [];
      const chain = []; let n = el;
      for(let i=0;i<6 && n;i++){ chain.push((n.id||n.className||n.tagName) + ' disp=' + getComputedStyle(n).display + ' h=' + (n.hasAttribute('hidden')?'Y':'N')); n = n.parentElement; }
      return chain;
    })(),
    sig1: q('#signature'),
    sig2: q('#signature2'),
    saveCombined: q('#saveCombinedPdf'),
    saveCombinedChain: (() => {
      const el = document.getElementById('saveCombinedPdf');
      if(!el) return null;
      const chain = []; let n = el;
      for(let i=0;i<6 && n;i++){ chain.push((n.id||n.className||n.tagName)); n = n.parentElement; }
      return chain;
    })(),
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();
