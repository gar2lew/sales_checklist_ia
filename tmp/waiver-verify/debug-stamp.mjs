import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
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
const context = await browser.newContext({ acceptDownloads:true, viewport:{width:1440,height:900} });
context.addInitScript(() => { window.confirm = () => true; });
const page = await context.newPage();

await page.goto(baseURL, { waitUntil:'networkidle' });
await page.click('.mode-card[data-mode="waiverOnly"]');
await page.selectOption('#landingStaff', 'Garry Lewis');
await page.click('#landingContinue');
await page.waitForSelector('#waiverSignatureSection:not([hidden])', { timeout:10000 });
await page.fill('#clientName', 'John Smith');
await page.locator('#signature').scrollIntoViewIfNeeded();
const box = await page.locator('#signature').boundingBox();
await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
await page.mouse.up();
await page.fill('#waiverClient1Date', '25/08/2026');
await page.click('#generateTop');
await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:120000 });

const downloads = [];
page.on('download', d => downloads.push(d));
await page.click('#downloadPackage');
let t0 = Date.now();
while(downloads.length < 1 && Date.now() - t0 < 20000){ await new Promise(r => setTimeout(r, 100)); }
const stream = await downloads[0].createReadStream();
const chunks = [];
await new Promise((res, rej) => stream.on('data', c => chunks.push(c)).on('end', res).on('error', rej));
const buf = Buffer.concat(chunks);

const doc = await getDocument({ data: new Uint8Array(buf), standardFontDataUrl: pathToFileURL(resolve(root, 'node_modules/pdfjs-dist/standard_fonts/') + '/').href }).promise;
const page6 = await doc.getPage(6);
const tc = await page6.getTextContent();
const raw = tc.items.map(it => it.str).join(' ');
const i = raw.indexOf('Digitally signed');
console.log('RAW SNIPPET:', JSON.stringify(raw.slice(Math.max(0, i - 30), i + 110)));
console.log('STATES:', await page.evaluate(() => ({
  s1: window._testState.getSignedAt1(),
  fmt: window._testState.formatSigningTimestamp(window._testState.getSignedAt1()),
})));
await browser.close();
server.close();