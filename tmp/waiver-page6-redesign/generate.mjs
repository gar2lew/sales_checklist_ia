/* Generate the four waiver matrix PDFs for the page-6 signing-panel redesign.
   Run: node tmp/waiver-page6-redesign/generate.mjs
*/
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

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

async function realisticSignature(page, selector){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if(!box) throw new Error(selector + ' not visible');
  const cx = x => box.x + box.width * x;
  const cy = y => box.y + box.height * y;
  const path = [];   // [[x, y], ...] in pad coords (fractions of box)
  const n = 46;
  for(let i = 0; i <= n; i++){
    const t = i / n;
    const x = 0.06 + 0.88 * t;
    const y = 0.54
      + 0.11 * Math.sin(t * 11 + 0.5)
      + 0.07 * Math.sin(t * 27 + 1.9)
      + 0.05 * Math.sin(t * 51 + 0.2);
    path.push([x, y]);
  }
  // ascender flourish near the start
  path.unshift([0.09, 0.30]);
  path.unshift([0.06, 0.52]);
  // descender loop at the end
  path.push([0.95, 0.78]);
  path.push([0.90, 0.46]);
  path.push([0.97, 0.60]);
  await page.mouse.move(cx(0.05), cy(0.55));
  await page.mouse.down();
  for(const [fx, fy] of path) await page.mouse.move(cx(fx), cy(fy), { steps: 1 });
  // a second lighter pass underlines the row
  await page.mouse.move(cx(0.06), cy(0.65), { steps: 4 });
  for(const [fx, fy] of path.slice(4)) await page.mouse.move(cx(fx), cy(fy + 0.07), { steps: 1 });
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
  const consoleMsgs = [];
  const pageErrors = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => pageErrors.push(String(e && e.message || e)));
  await page.fill('#clientName', C1);
  await page.evaluate((on) => {
    const el = document.getElementById('includeSignatureTimestamp');
    el.checked = on;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, timestampOn);
  await page.waitForSelector('#waiverSignatureSection', { state: 'visible', timeout: 15000 });
  await realisticSignature(page, '#signature');
  await page.fill('#waiverClient1Date', DATE);
  if(client2){
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', C2);
    await realisticSignature(page, '#signature2');
    await page.fill('#waiverClient2Date', DATE);
  }
  await page.click('#generateTop');
  try{
    await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout: 120000 });
  }catch(e){
    console.error('BUILD FAILED combo client2=' + client2 + ' timestamp=' + timestampOn);
    console.error('console log tail:');
    for(const m of consoleMsgs.slice(-60)) console.error('  [' + m.type + '] ' + m.text);
    throw e;
  }
  const state = await page.evaluate(() => ({
    signedAt1: window._testState.getSignedAt1(),
    signedAt2: window._testState.getSignedAt2(),
    tsEnabled: window._testState.isSignatureTimestampEnabled(),
  }));
  const pdf = await capturePdf(page);
  return { pdf, ...state };
}

const combos = [
  { name: 'comboA', client2: false, timestampOn: true  },
  { name: 'comboB', client2: false, timestampOn: false },
  { name: 'comboC', client2: true,  timestampOn: true  },
  { name: 'comboD', client2: true,  timestampOn: false },
];

const summary = {};
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
const errors = [];
context.addInitScript(() => { window.confirm = () => true; });
context.on('page', p => p.on('pageerror', e => errors.push(e.message)));

for(const combo of combos){
  const page = await context.newPage();
  await enterWaiverOnly(page);
  const { pdf, signedAt1, signedAt2, tsEnabled } = await buildWaiver(page, combo);
  writeFileSync(outDir + combo.name + '.pdf', pdf);
  summary[combo.name] = { client2: combo.client2, timestampOn: combo.timestampOn, signedAt1, signedAt2, tsEnabled, pdfBytes: pdf.length };
  await page.close();
}

summary.rb = { errors };
writeFileSync(outDir + 'summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

await context.close();
await browser.close();
server.close();