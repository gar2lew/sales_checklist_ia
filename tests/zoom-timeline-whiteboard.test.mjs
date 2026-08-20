import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const mime = { '.css':'text/css', '.html':'text/html', '.js':'text/javascript', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try { response.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));

const browser = await chromium.launch({ headless:true });
try {
  const page = await browser.newPage({ viewport:{width:1688,height:1000} });
  await page.addInitScript(() => {
    const NativeResizeObserver = window.ResizeObserver;
    window.__resizeObserverDiagnostics = { created:0, observed:0, disconnected:0 };
    window.ResizeObserver = class extends NativeResizeObserver {
      constructor(callback){ super(callback); window.__resizeObserverDiagnostics.created++; }
      observe(target,options){ window.__resizeObserverDiagnostics.observed++; return super.observe(target,options); }
      disconnect(){ window.__resizeObserverDiagnostics.disconnected++; return super.disconnect(); }
    };
  });
  const errors=[];
  page.on('pageerror',error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil:'networkidle' });

  assert.ok(await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.width) >= 0,'hidden initialization completes safely');
  await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');

  await page.waitForFunction(() => document.querySelector('#whiteboardCanvas').width > 0);
  const timeline = await page.evaluate(() => {
    const list=document.querySelector('#timelineZoom');
    const nav=document.querySelector('#progressTimeline');
    const boxes=Array.from(list.children).map(item => item.getBoundingClientRect());
    return {
      display:getComputedStyle(list).display,
      count:boxes.length,
      sameRow:boxes.every(box => Math.abs(box.top-boxes[0].top) < 1),
      fullWidthRows:boxes.some(box => box.width > list.clientWidth * .8),
      navHeight:nav.getBoundingClientRect().height
    };
  });
  assert.deepEqual(timeline,{display:'flex',count:8,sameRow:true,fullWidthRows:false,navHeight:55});

  const initialCanvas = await page.locator('#whiteboardCanvas').evaluate(canvas => ({
    width:canvas.width,
    height:canvas.height,
    cssWidth:canvas.getBoundingClientRect().width,
    cssHeight:canvas.getBoundingClientRect().height,
    containerWidth:canvas.parentElement.clientWidth
  }));
  assert.ok(initialCanvas.width > 0 && initialCanvas.height > 0);
  assert.equal(initialCanvas.width,Math.round(initialCanvas.cssWidth * 2),'backing width follows the existing 2x rendering scale');
  assert.equal(initialCanvas.height,Math.round(initialCanvas.cssHeight * 2));
  assert.ok(Math.abs(initialCanvas.cssWidth-initialCanvas.containerWidth) <= 1);

  await page.locator('#whiteboardCanvas').scrollIntoViewIfNeeded();
  const before = await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.toDataURL());
  const box = await page.locator('#whiteboardCanvas').boundingBox();
  await page.mouse.move(box.x+40,box.y+40);
  await page.mouse.down();
  await page.mouse.move(box.x+160,box.y+120,{steps:8});
  await page.mouse.up();
  const after = await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.toDataURL());
  assert.notEqual(after,before,'pointer input draws after reveal');

  const previousBackingWidth = await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.width);
  await page.locator('.workspace-canvas-wrap').evaluate(wrap => { wrap.style.width='500px'; });
  await page.waitForFunction(width => document.querySelector('#whiteboardCanvas').width !== width,previousBackingWidth);
  assert.equal(await page.locator('#whiteboardCanvas').evaluate(canvas => canvas.width),await page.locator('.workspace-canvas-wrap').evaluate(wrap => wrap.clientWidth * 2),'container resize updates backing width');

  await page.click('#backToStart');
  await page.click('.mode-card[data-mode="zoom"]');
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  assert.deepEqual(await page.evaluate(() => window.__resizeObserverDiagnostics),{created:1,observed:1,disconnected:0},'mode changes do not duplicate observers');
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  assert.deepEqual(await page.evaluate(() => window.__resizeObserverDiagnostics),{created:1,observed:1,disconnected:1},'page lifecycle disconnects the observer');
  assert.deepEqual(errors,[]);
  await page.close();

  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    const mobile=await browser.newPage({viewport});
    await mobile.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
    await mobile.click('.mode-card[data-mode="zoom"]');
    await mobile.selectOption('#landingStaff','Garry Lewis');
    await mobile.click('#landingContinue');
    assert.equal(await mobile.locator('#timelineZoom').evaluate(list => getComputedStyle(list).display),'flex');
    assert.equal(await mobile.locator('#timelineZoom').evaluate(list => {
      const boxes=Array.from(list.children).map(item => item.getBoundingClientRect());
      return boxes.every(box => Math.abs(box.top-boxes[0].top) < 1);
    }),true,`Zoom steps remain horizontal at ${viewport.width}px`);
    await mobile.close();
  }

  const inPerson=await browser.newPage({viewport:{width:1280,height:800}});
  await inPerson.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await inPerson.selectOption('#landingStaff','Garry Lewis');
  await inPerson.click('#landingContinue');
  assert.equal(await inPerson.locator('#timelineInPerson').evaluate(list => getComputedStyle(list).display),'flex','in-person timeline remains unchanged');
  assert.equal(await inPerson.locator('#zoomWorkspaceSection').isVisible(),false,'in-person does not expose the Zoom whiteboard');
  await inPerson.close();

  console.log('PASS Zoom timeline layout, whiteboard reveal/resize/drawing, observer lifecycle, and in-person boundary');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
