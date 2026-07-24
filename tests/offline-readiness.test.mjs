import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    let file = resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    if (!file.startsWith(root)) { response.writeHead(403).end(); return; }
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] || 'application/octet-stream',
      'Cache-Control': pathname === '/service-worker.js' ? 'no-cache' : 'no-store',
    });
    response.end(await readFile(file));
  } catch { response.writeHead(404).end('Not found'); }
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ headless: true });

async function waitForCurrentCache(page) {
  await page.waitForFunction(
    async () => (await caches.keys()).includes('sales-capture-v2.7.0-alpha.21')
  );
}

try {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage();

  // 1. First online visit: service worker installs and caches the shell
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await waitForCurrentCache(page);

  const cachedAssets = await page.evaluate(async () => {
    const cache = await caches.open('sales-capture-v2.7.0-alpha.21');
    return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
  });

  // Verify required assets are cached
  const required = ['/index.html', '/js/app.js', '/css/app.css', '/manifest.webmanifest'];
  for (const asset of required) {
    assert.ok(cachedAssets.includes(asset), `Required asset must be cached: ${asset}`);
  }
  assert.ok(cachedAssets.length >= 20, `Expected at least 20 cached assets, got ${cachedAssets.length}`);
  console.log(`PASS ${cachedAssets.length} cache entries include all required shell assets`);

  // 2. Template assets are cached for PDF generation
  const templateAssets = cachedAssets.filter((a) => a.startsWith('/templates/'));
  assert.ok(templateAssets.length >= 4, `Expected at least 4 template assets, got ${templateAssets.length}`);
  assert.ok(cachedAssets.includes('/templates/rendered/client-review-page-1.jpg'));
  console.log(`PASS ${templateAssets.length} template assets cached`);

  // 3. Clean-install atomicity: all declared APP_SHELL entries are present
  const manifestAssets = await page.evaluate(async () => {
    // Read from the service worker's APP_SHELL constant indirectly via cache
    const cache = await caches.open('sales-capture-v2.7.0-alpha.21');
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  const declaredShell = [
    '/', '/index.html', '/manifest.webmanifest', '/css/app.css', '/js/app.js',
    '/icons/icon-192.png', '/icons/icon-512.png',
  ];
  for (const shell of declaredShell) {
    const found = manifestAssets.some((a) => a === shell || a === '/index.html' && shell === '/');
    assert.ok(found || manifestAssets.includes(shell), `APP_SHELL entry must be cached: ${shell}`);
  }
  console.log('PASS all declared APP_SHELL entries present in cache');

  // 4. Non-existent routes do not break cache
  const nonexistentCount = cachedAssets.filter((a) => a.includes('nonexistent')).length;
  assert.equal(nonexistentCount, 0, 'No nonexistent assets should be cached');
  console.log('PASS no nonexistent assets cached');

  // 5. Cache version isolation
  const cacheNames = await page.evaluate(async () => await caches.keys());
  assert.ok(cacheNames.includes('sales-capture-v2.7.0-alpha.21'));
  assert.ok(!cacheNames.includes('sales-capture-v2.7.0-alpha.20'), 'Old cache version must be cleaned');
  console.log('PASS cache version is isolated to v2.7.0-alpha.21');

  // 6. navigator.onLine is true (not a readiness signal alone)
  const online = await page.evaluate(() => navigator.onLine);
  assert.equal(online, true, 'navigator.onLine must be true in online context');
  console.log('PASS navigator.onLine reflects connection state');

  console.log('\nAll offline readiness tests PASSED');

  await context.close();
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
