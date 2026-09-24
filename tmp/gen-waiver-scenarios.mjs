import fs from 'node:fs';
import { createServer } from 'node:http';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = resolve('tmp/pdfs/waivercheck');
fs.mkdirSync(outDir, { recursive: true });
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(fs.readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const baseURL = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ headless:true });

const CLIENT_1 = 'John Smith';
const CLIENT_2 = 'Jane Smith';
const DATE = '25/08/2026';

async function enterMode(page, mode){
  await page.goto(baseURL, { waitUntil:'networkidle' });
  await page.click(`.mode-card[data-mode="${mode}"]`);
  await page.selectOption('#landingStaff', 'Garry Lewis');
  await page.click('#landingContinue');
  const cls = mode === 'waiverOnly' ? 'show-waiver' : mode === 'inPerson' ? 'show-in-person' : 'show-zoom';
  await page.waitForSelector(`.app.${cls}`, { timeout:10000 });
  await page.waitForSelector('#appointmentInfoSection:not([hidden])', { timeout:10000 });
}

async function drawOnPad(page, selector){
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if(!box || box.width <= 10 || box.height <= 10) throw new Error(`${selector} not visible`);
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.5, { steps: 8 });
  await page.mouse.up();
}

async function signClient1(page, waitWaiver){
  if(waitWaiver) await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:15000 });
  await drawOnPad(page, '#signature');
  await page.waitForFunction(() => {
    const el = document.getElementById('waiverClient1Date');
    return el && /^\d{2}\/\d{2}\/\d{4}$/.test(el.value);
  }, null, { timeout:5000 });
}

async function signClient2(page){
  await page.check('#waiverClient2Toggle');
  await page.fill('#client2Name', CLIENT_2);
  await drawOnPad(page, '#signature2');
  await page.waitForFunction(() => {
    const el = document.getElementById('waiverClient2Date');
    return el && /^\d{2}\/\d{2}\/\d{4}$/.test(el.value);
  }, null, { timeout:5000 });
}

async function fillSharedAppointment(page){
  await page.fill('#date', DATE);
  await page.selectOption('#teamMember', { label:'Garry Lewis' });
  await page.fill('#clientName', CLIENT_1);
  await page.evaluate(() => {
    const el = document.getElementById('contractDueDateTbc');
    el.checked = true;
    el.dispatchEvent(new Event('change', { bubbles:true }));
  });
}

async function generateAndWaitReady(page){
  await page.click('#generateTop');
  await page.waitForSelector('#appointmentPackageReady:not(.hidden)', { timeout:120000 });
}

async function downloadAndSave(page, expected, trigger, names){
  const downloads = [];
  page.on('download', d => downloads.push(d));
  await trigger();
  const t0 = Date.now();
  while(downloads.length < expected && Date.now() - t0 < 20000){
    await new Promise(r => setTimeout(r, 100));
  }
  if(downloads.length !== expected) throw new Error(`expected ${expected} downloads, got ${downloads.length}`);
  for(let i = 0; i < downloads.length; i++){
    const dl = downloads[i];
    const name = names[i] || dl.suggestedFilename();
    const stream = await dl.createReadStream();
    const chunks = [];
    for await (const ch of stream) chunks.push(ch);
    const buf = Buffer.concat(chunks);
    fs.writeFileSync(resolve(outDir, name), buf);
    console.log(`  saved ${name} (${buf.length} bytes)`);
  }
}

const context = await browser.newContext({ viewport:{ width:1440, height:900 } });
await context.addInitScript(() => { window.confirm = () => true; });

/* 1. standalone Client 1 */
{
  const page = await context.newPage();
  await enterMode(page, 'waiverOnly');
  await page.fill('#clientName', CLIENT_1);
  await signClient1(page, true);
  await generateAndWaitReady(page);
  await downloadAndSave(page, 1, () => page.click('#downloadPackage'), ['waiver-standalone-c1.pdf']);
  await page.close();
}

/* 2. standalone Client 1 + 2 */
{
  const page = await context.newPage();
  await enterMode(page, 'waiverOnly');
  await page.fill('#clientName', CLIENT_1);
  await signClient1(page, true);
  await signClient2(page);
  await generateAndWaitReady(page);
  await downloadAndSave(page, 1, () => page.click('#downloadPackage'), ['waiver-standalone-c1-c2.pdf']);
  await page.close();
}

/* 3. In-Person + waiver (combined booklet + ZIP) */
{
  const page = await context.newPage();
  await enterMode(page, 'inPerson');
  await fillSharedAppointment(page);
  await page.check('#includeWaiver');
  await signClient1(page, true);
  await generateAndWaitReady(page);
  await downloadAndSave(page, 2, () => page.click('#downloadPackage'),
    ['waiver-inperson-combined.pdf', 'waiver-inperson-package.zip']);
  await page.close();
}

/* 4. Zoom + waiver (combined booklet + ZIP; pads relocated like waiverOnly mode) */
{
  const page = await context.newPage();
  await enterMode(page, 'zoom');
  await fillSharedAppointment(page);
  await page.check('#zoomIncludeWaiver');
  await page.waitForSelector('#waiverSignatureSection', { state:'visible', timeout:15000 });
  await page.evaluate(() => {
    const sigHost = document.getElementById('sigPadsHost');
    const waiverHost = document.getElementById('waiverPadsHost');
    if(waiverHost.childElementCount === 0 && sigHost.childElementCount > 0){
      while(sigHost.firstChild){ waiverHost.appendChild(sigHost.firstChild); }
    }
  });
  await signClient1(page, false);
  await generateAndWaitReady(page);
  await downloadAndSave(page, 2, () => page.click('#downloadPackage'),
    ['waiver-zoom-combined.pdf', 'waiver-zoom-package.zip']);
  await page.close();
}

await browser.close();
server.close();
console.log('DONE -> ' + outDir);