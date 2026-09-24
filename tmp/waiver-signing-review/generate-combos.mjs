// Browser verification harness for the 4 waiver signing combinations.
// Produces real PDFs + page-6 renders + a geometry summary into tmp/waiver-signing-review/.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outDir = resolve(fileURLToPath(new URL('.', import.meta.url)).replace(/\\?$/, '\\'));
const poppler = 'C:\\Users\\great\\AppData\\Local\\Temp\\opencode\\tools\\poppler-26.07.0\\Library\\bin';

const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.pdf':'application/pdf', '.webmanifest':'application/manifest+json' };
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

async function signPad(page, selector, dateField){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if(!(box && box.width > 10)) throw new Error(selector + ' not visible');
  await page.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.45);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3, { steps: 6 });
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.move(box.x + box.width * 0.82, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await page.fill(dateField, '25/08/2026');
}

const combos = [
  { id: 'A', client2: false, ts: true },
  { id: 'B', client2: false, ts: false },
  { id: 'C', client2: true, ts: true },
  { id: 'D', client2: true, ts: false },
];

const summary = {};

for(const combo of combos){
  const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
  const errors = [];
  context.addInitScript(() => { window.confirm = () => true; });
  context.on('page', p => p.on('pageerror', e => errors.push('pageerror: ' + e.message)));
  context.on('page', p => p.on('console', m => { if(m.type() === 'error') errors.push('console: ' + m.text()); }));
  const page = await context.newPage();

  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click('.mode-card[data-mode="waiverOnly"]');
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:10000 });
  await page.fill('#clientName', 'John Smith');

  if(!combo.ts){
    await page.evaluate(() => {
      const el = document.getElementById('includeSignatureTimestamp');
      el.checked = false;
      el.dispatchEvent(new Event('change', { bubbles:true }));
    });
  }

  await signPad(page, '#signature', '#waiverClient1Date');
  let signedAt2 = null;
  if(combo.client2){
    await page.check('#waiverClient2Toggle');
    await page.fill('#client2Name', 'Jane Smith');
    await signPad(page, '#signature2', '#waiverClient2Date');
    signedAt2 = await page.evaluate(() => window._testState.getSignedAt2());
  }
  const signedAt1 = await page.evaluate(() => window._testState.getSignedAt1());
  const stateAt1 = await page.evaluate(() => window._testState.formatSigningTimestamp(window._testState.getSignedAt1()));
  const stateAt2 = await page.evaluate(() => window._testState.formatSigningTimestamp(window._testState.getSignedAt2()));

  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:120000 });
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await page.click('#downloadPackage');
  const t0 = Date.now();
  while(downloads.length < 1 && Date.now() - t0 < 20000){ await new Promise(r => setTimeout(r, 100)); }
  const stream = await downloads[0].createReadStream();
  const chunks = [];
  await new Promise((res, rej) => stream.on('data', c => chunks.push(c)).on('end', res).on('error', rej));
  const buf = Buffer.concat(chunks);
  const pdfPath = resolve(fileURLToPath(new URL(`combo-${combo.id}.pdf`, import.meta.url)));
  writeFileSync(pdfPath, buf);

  summary[combo.id] = { signedAt1, signedAt2, stateAt1, stateAt2, errors };
  await context.close();
  console.log(`Generated combo ${combo.id} (client2=${combo.client2}, ts=${combo.ts}), ${buf.length} bytes`);
}

for(const combo of combos){
  const pdfPath = resolve(fileURLToPath(new URL(`combo-${combo.id}.pdf`, import.meta.url)));
  const renderPath = resolve(fileURLToPath(new URL(`renders/combo-${combo.id}-page6.png`, import.meta.url)));
  execFileSync(resolve(poppler, 'pdftoppm.exe'), ['-f', '6', '-l', '6', '-r', '110', '-png', pdfPath, renderPath.replace(/\.png$/, '')]);
  console.log('Rendered page 6 for combo', combo.id);
}

writeFileSync(resolve(fileURLToPath(new URL('summary.json', import.meta.url))), JSON.stringify(summary, null, 2));
await browser.close();
server.close();
console.log('Verification artifacts written to', outDir);