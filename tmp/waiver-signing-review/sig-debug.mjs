import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const mime = { '.js':'text/javascript', '.html':'text/html', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.pdf':'application/pdf' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const baseURL = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
await page.goto(baseURL, { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:10000 });
await page.fill('#clientName', 'John Smith');

const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + box.width*0.2, box.y + box.height*0.45);
await page.mouse.down();
await page.mouse.move(box.x + box.width*0.7, box.y + box.height*0.55, { steps:10 });
await page.mouse.up();
await page.waitForTimeout(300);

const state = await page.evaluate(() => {
  const sig = document.getElementById('signature');
  const ctx = sig.getContext && sig.getContext('2d');
  let dark = 0;
  if(ctx){ const d = ctx.getImageData(0, 0, sig.width, sig.height).data; for(let i = 0; i < d.length; i += 4){ if((d[i]+d[i+1]+d[i+2])/3 < 120) dark++; } }
  return {
    signedAt1: window._testState ? window._testState.getSignedAt1() : 'no hook',
    hasSignatureHook: window._testState ? typeof window._testState.getHasSignature : 'n/a',
    strokes: dark,
    atPointerDown: sig.getAttribute('data-empty'),
    visible: !!sig.offsetParent,
    rectMatches: JSON.stringify(sig.getBoundingClientRect().toJSON()),
  };
});
console.log(JSON.stringify(state, null, 2));
await browser.close(); server.close();