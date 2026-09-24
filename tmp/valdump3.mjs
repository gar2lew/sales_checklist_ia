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
const elFacts = await page.evaluate(() => {
  const out = {};
  for (const id of ['waiverClient1Date','waiverClient1Name','waiverSignature1','waiverClient2Date','waiverClient2Name','waiverSignature2','date','clientName']) {
    const el = document.getElementById(id);
    out[id] = el ? { tag: el.tagName, visible: !el.hasAttribute('hidden') && getComputedStyle(el).display !== 'none', value: el.value } : null;
  }
  out.status = document.getElementById('status') ? document.getElementById('status').textContent : null;
  out.readiness = (typeof waiverReadiness === 'function') ? waiverReadiness().items.map(i => ({ id: i.id, ok: i.ok, test: String(i.test).slice(0,90) })) : 'none';
  return out;
});
console.log(JSON.stringify(elFacts, null, 1));
await page.click('#generateTop');
const after = await page.evaluate(() => ({
  errors: Array.from(document.querySelectorAll('.fieldError')).map(e => String(e.getAttribute('data-field') || '').trim() || e.textContent.trim()),
  status: document.getElementById('status').textContent,
}));
console.log('AFTER_FAIL_CLICK ' + JSON.stringify(after));
await page.fill('#clientName', 'Fictional Test Client');
await page.click('#generateTop');
const after2 = await page.evaluate(() => ({
  errors: Array.from(document.querySelectorAll('.fieldError')).map(e => String(e.getAttribute('data-field') || '').trim() || e.textContent.trim()),
  status: document.getElementById('status').textContent,
  dateVal: document.getElementById('date') ? document.getElementById('date').value : null,
}));
console.log('AFTER_NAME ' + JSON.stringify(after2));
await page.click('#timelineWaiver .tl-step-btn[data-tl-target="footerBar"]');
const after3 = await page.evaluate(() => ({
  errors: Array.from(document.querySelectorAll('.fieldError')).map(e => String(e.getAttribute('data-field') || '').trim() || e.textContent.trim()),
  status: document.getElementById('status').textContent,
}));
console.log('AFTER_STEP ' + JSON.stringify(after3));
await browser.close();
