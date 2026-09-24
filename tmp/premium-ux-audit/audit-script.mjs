import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';

const root = process.cwd();
const auditDir = resolve(root, 'tmp/premium-ux-audit');
mkdirSync(auditDir, { recursive: true });

console.log('Root:', root);

const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const appJs = readFileSync(resolve(root, 'js/app.js'), 'utf8');
const appCss = readFileSync(resolve(root, 'css/app.css'), 'utf8');

const mime = {
  '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json'
};

const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if (!file.startsWith(root)) return response.writeHead(403).end();
  try {
    response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const port = server.address().port;
console.log(`Server running on http://127.0.0.1:${port}`);

const browser = await chromium.launch({ headless: true });

const viewports = [
  { name: 'iPhone-SE', width: 375, height: 667 },
  { name: 'iPhone-14', width: 390, height: 844 },
  { name: 'iPhone-14-PM', width: 393, height: 852 },
  { name: 'iPhone-15-PM', width: 430, height: 932 },
  { name: 'iPad', width: 768, height: 1024 },
  { name: 'Desktop', width: 1280, height: 800 }
];

const findings = [];

for (const vp of viewports) {
  console.log(`\n=== Testing viewport: ${vp.name} (${vp.width}x${vp.height}) ===`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.width <= 500 ? 3 : 1,
    isMobile: vp.width <= 500,
    hasTouch: vp.width <= 1024,
    userAgent: vp.width <= 500
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined
  });
  const page = await context.newPage();
  const errors = [];
  const consoleErrors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  const timing = {};
  try {
    const start = Date.now();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    timing.load = Date.now() - start;

    // Measure DOM size
    const domStats = await page.evaluate(() => ({
      totalNodes: document.querySelectorAll('*').length,
      scripts: document.querySelectorAll('script').length,
      stylesheets: document.styleSheets.length,
      images: document.querySelectorAll('img').length,
      canvases: document.querySelectorAll('canvas').length
    }));

    // Check for horizontal overflow
    const overflow = await page.evaluate(() => {
      const body = document.body;
      return {
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        hasOverflow: body.scrollWidth > body.clientWidth
      };
    });

    // Check touch targets on landing
    const touchTargets = await page.evaluate(() => {
      const interactive = document.querySelectorAll('button, a, input, select, [role="button"]');
      const small = [];
      interactive.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 44 || rect.height < 44)) {
          small.push({
            tag: el.tagName,
            text: el.textContent?.trim().slice(0, 30),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      });
      return small.slice(0, 15);
    });

    // Screenshot landing
    await page.screenshot({ path: resolve(auditDir, `before-${vp.name}-landing.png`), fullPage: false });

    // Navigate to appointment - click the first mode card then continue
    const firstModeCard = await page.$('.mode-card');
    if (firstModeCard) {
      await firstModeCard.click().catch(() => {});
      await page.waitForTimeout(300);
    }
    const continueBtn = await page.$('#landingContinue');
    if (continueBtn) {
      await continueBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // Screenshot workspace
    await page.screenshot({ path: resolve(auditDir, `before-${vp.name}-workspace.png`), fullPage: false });

    findings.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      timing,
      domStats,
      overflow,
      touchTargets,
      pageErrors: errors.slice(0, 5),
      consoleErrors: consoleErrors.slice(0, 5)
    });

    console.log(`  Load: ${timing.load}ms | Nodes: ${domStats.totalNodes} | Overflow: ${overflow.hasOverflow} | Small touch: ${touchTargets.length}`);

  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    findings.push({ viewport: vp.name, error: err.message });
  }

  await context.close();
}

await browser.close();
server.close();

// Write findings
writeFileSync(resolve(auditDir, 'baseline-findings.json'), JSON.stringify(findings, null, 2));
console.log('\n=== AUDIT COMPLETE ===');
console.log(JSON.stringify(findings, null, 2));
