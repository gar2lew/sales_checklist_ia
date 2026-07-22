import assert from "node:assert/strict";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const currentWorker = await readFile(path.join(root, "service-worker.js"), "utf8");
const previousWorker = currentWorker.replace("v2.7.0-alpha.13", "v2.7.0-alpha.12");
let servedWorker = previousWorker;
const mime = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    if (pathname === "/service-worker.js") {
      response.writeHead(200, { "Content-Type": "text/javascript", "Cache-Control": "no-cache" });
      response.end(servedWorker);
      return;
    }
    let filePath = path.join(root, pathname === "/" ? "index.html" : pathname.slice(1));
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

async function waitForCache(page, expected, absent = []) {
  await page.waitForFunction(async ({ expectedName, absentNames }) => {
    const keys = await caches.keys();
    return keys.includes(expectedName) && absentNames.every((name) => !keys.includes(name));
  }, { expectedName: expected, absentNames: absent }, { timeout: 15000 });
}

try {
  const upgradeContext = await browser.newContext({ serviceWorkers: "allow" });
  const upgradePage = await upgradeContext.newPage();
  await upgradePage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await upgradePage.evaluate(() => navigator.serviceWorker.ready);
  await waitForCache(upgradePage, "sales-capture-v2.7.0-alpha.12");

  servedWorker = currentWorker;
  await upgradePage.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
  });
  await waitForCache(upgradePage, "sales-capture-v2.7.0-alpha.13", ["sales-capture-v2.7.0-alpha.12"]);

  await upgradeContext.setOffline(true);
  await upgradePage.reload({ waitUntil: "domcontentloaded" });
  assert.equal(await upgradePage.locator("#landingScreen").isVisible(), true, "upgraded application shell must remain available offline");
  assert.notEqual(await upgradePage.locator("#landingScreen").evaluate((element) => getComputedStyle(element).display), "none", "upgraded cached CSS must render offline");
  await upgradeContext.close();

  const freshContext = await browser.newContext({ serviceWorkers: "allow" });
  const freshPage = await freshContext.newPage();
  await freshPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await freshPage.evaluate(() => navigator.serviceWorker.ready);
  await waitForCache(freshPage, "sales-capture-v2.7.0-alpha.13", ["sales-capture-v2.7.0-alpha.12"]);
  assert.equal(await freshPage.locator("#landingScreen").isVisible(), true, "fresh installation must render the current shell");
  await freshContext.close();

  console.log("PASS browser service-worker fresh install, v2.7.0-alpha.12 upgrade, cache cleanup, and offline reload");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
