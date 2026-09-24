import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:1440,height:900} });
page.setDefaultTimeout(20000);
page.addInitScript(() => { window.confirm = () => true; });
await page.goto('http://127.0.0.1:8766/', { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:5000 });
await page.fill('#clientName', 'Fictional Test Client');
await page.locator('#signature').scrollIntoViewIfNeeded();
const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + 40, box.y + box.height/2);
await page.mouse.down();
await page.mouse.move(box.x + box.width - 40, box.y + box.height/2, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(200);
const client = await page.context().newCDPSession(page);
await client.send('Profiler.enable');
await client.send('Profiler.setSamplingInterval', { interval: 200 });
await client.send('Profiler.start');
console.log('CLICK');
const clicked = await Promise.race([ page.click('#generateTop').then(()=>true, ()=>true), new Promise(res => setTimeout(res, 12000)) ]);
console.log('after click wait');
await new Promise(res => setTimeout(res, 8000));
const profile = await client.send('Profiler.stop');
const nodes = profile.profile.nodes;
const samples = profile.profile.samples || [];
const self = new Map();
const stacks = [];
for (const s of samples) {
  const chain = [];
  let n = nodes.find(x => x.id === s);
  let guard = 0;
  while (n && guard++ < 40) {
    chain.push((n.callFrame.functionName || '(anon)') + '::' + (n.callFrame.url||'').split('/').pop() + ':' + n.callFrame.lineNumber);
    n = n.parentId ? nodes.find(x => x.id === n.parentId) : null;
  }
  stacks.push(chain.join(' < '));
}
const byStack = new Map();
for (const st of stacks) byStack.set(st, (byStack.get(st)||0)+1);
const ranked = Array.from(byStack.entries()).sort((a,b)=>b[1]-a[1]).slice(0,8);
console.log('TOTAL_SAMPLES ' + samples.length);
for (const [st, cnt] of ranked) console.log(cnt + ' | ' + st.slice(0, 260));
await browser.close();
