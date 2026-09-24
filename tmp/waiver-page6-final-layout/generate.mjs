/* Generate four waiver PDFs (late/redesign matrix) for the final page-6
   signing panel. Uses the real app via Playwright; signatures for Client 1
   and Client 2 are explicitly different shapes.
   Run: node tmp/waiver-page6-final-layout/generate.mjs
*/
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outDir = fileURLToPath(new URL('.', import.meta.url));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const baseURL = `http://127.0.0.1:${server.address().port}/`;

const C1 = 'John Smith';
const C2 = 'Jenny Smith';
const DATE = '11/09/2026';

const browser = await chromium.launch({ headless: true });

async function signPad(page, selector, variant){
  // variant 1 = Client 1, variant 2 = Client 2 (clearly different shapes)
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if(!box) throw new Error(selector + ' not visible');
  const cx = x => box.x + box.width * x;
  const cy = y => box.y + box.height * y;
  const smooth = t => t * t * (3 - 2 * t);
  const n = 52;
  const path = [];
  for(let i = 0; i <= n; i++){
    const t = i / n;
    if(variant === 1){
      // flowing multi-loop signature with an ascender and a descender loop
      const x = 0.05 + 0.90 * t;
      const y = 0.55
        + 0.10 * Math.sin(t * 11 + 0.5)
        + 0.06 * Math.sin(t * 26 + 1.9)
        + 0.05 * Math.sin(t * 53 + 0.2);
      path.push([x, y]);
    }else{
      // spikier, more angular signature with different rhythm
      const x = 0.06 + 0.88 * t;
      const y = 0.52
        + 0.14 * Math.sin(t * 7 + 2.1)
        + 0.09 * Math.sin(t * 19 + 0.7)
        + 0.04 * Math.sin(t * 47 + 3.3);
      path.push([x, y]);
    }
  }
  if(variant === 1){
    path.unshift([0.08, 0.28]);
    path.unshift([0.05, 0.52]);
    path.push([0.94, 0.80]);
    path.push([0.89, 0.46]);
    path.push([0.96, 0.58]);
  }else{
    path.unshift([0.10, 0.62]);
    path.unshift([0.05, 0.34]);
    path.push([0.92, 0.70]);
    path.push([0.95, 0.44]);
    path.push([0.90, 0.62]);
  }
  await page.mouse.move(cx(0.5), cy(0.5));
  await page.mouse.down();
  for(const [fx, fy] of path) await page.mouse.move(cx(fx), cy(fy), { steps: 1 });
  await page.mouse.up();
}

async function enterWaiverOnly(page){
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('.app.show-waiver', { timeout: 10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout: 10000 });
}

async function capturePdf(page){
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 1 && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100));
  const stream = await downloads[0].createReadStream();
  const chunks = [];
  await new Promise((res, rej) => stream.on('data', c => chunks.push(c)).on('end', res).on('error', rej));
  return Buffer.concat(chunks);
}

async function buildWaiver(page, { client2, timestampOn }){
  await page.fill('#clientName', C1);
  await page.evaluate((on) => {
    const el = document.getElementById('includeSignatureTimestamp');
    el.checked = on;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, timestampOn);
  await page.waitForSelector('#waiverSignatureSection', { state: 'visible', timeout: 15000 });
  await signPad(page, '#signature', 1);
  await page.fill('#waiverClient1Date', DATE);
  if(client2){
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', C2);
    await signPad(page, '#signature2', 2);
    await page.fill('#waiverClient2Date', DATE);
  }
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
  const state = await page.evaluate(() => ({
    signedAt1: window._testState.getSignedAt1(),
    signedAt2: window._testState.getSignedAt2(),
    tsEnabled: window._testState.isSignatureTimestampEnabled(),
    c2Name: document.getElementById('client2Name') ? document.getElementById('client2Name').value : '',
  }));
  const pdf = await capturePdf(page);
  return { pdf, ...state };
}

const combos = [
  { name: 'finalA', file: 'waiver-c1-timestamp.pdf',   client2: false, timestampOn: true  },
  { name: 'finalB', file: 'waiver-c1-notimestamp.pdf', client2: false, timestampOn: false },
  { name: 'finalC', file: 'waiver-c1c2-timestamp.pdf', client2: true,  timestampOn: true  },
  { name: 'finalD', file: 'waiver-c1c2-notimestamp.pdf', client2: true, timestampOn: false },
];

const summary = {};
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const errors = [];
context.addInitScript(() => { window.confirm = () => true; });
context.on('page', p => p.on('pageerror', e => errors.push(e.message)));

for(const combo of combos){
  const page = await context.newPage();
  await enterWaiverOnly(page);
  const { pdf, signedAt1, signedAt2, tsEnabled, c2Name } = await buildWaiver(page, combo);
  writeFileSync(outDir + combo.file, pdf);
  writeFileSync(outDir + combo.name + '.pdf', pdf);
  summary[combo.name] = {
    client2: combo.client2, timestampOn: combo.timestampOn,
    signedAt1, signedAt2, tsEnabled, c2Name, pdfBytes: pdf.length,
  };
  await page.close();
}

summary.rb = { errors };
writeFileSync(outDir + 'summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
server.close();