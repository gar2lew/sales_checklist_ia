import assert from "node:assert/strict";
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
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
    const urlPath = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    let filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath.slice(1));
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    response.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });

async function openWorkspace(width = 1366, height = 768) {
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", acceptDownloads: true });
  const page = await context.newPage();
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.click("#landingStaffTrigger");
  await page.click('#landingStaffMenu [data-value="Blake"]');
  await page.fill("#landingClient1", "Taylor Morgan");
  await page.click("#landingStartBtn");
  return { context, page };
}

try {
  const landingContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, serviceWorkers: "block" });
  const landingPage = await landingContext.newPage();
  await landingPage.goto(baseUrl, { waitUntil: "domcontentloaded" });
  assert.equal(await landingPage.locator("#landingStaff").getAttribute("aria-hidden"), "true", "hidden native staff select must remain available");
  await landingPage.click("#landingStaffTrigger");
  await landingPage.keyboard.press("ArrowDown");
  await landingPage.keyboard.press("Enter");
  assert.notEqual(await landingPage.locator("#landingStaff").inputValue(), "", "keyboard selection should update the native staff value");
  await landingPage.click("#landingStaffTrigger");
  await landingPage.click(".landing-heading");
  assert.equal(await landingPage.locator("#landingStaffMenu").isVisible(), false, "outside click should close the staff menu");
  await landingPage.fill("#landingClient1", "Keyboard Client");
  assert.equal(await landingPage.locator("#landingStartBtn").isEnabled(), true, "staff and Client 1 should enable Start Appointment");
  await landingPage.click("#landingStartBtn");
  assert.equal(await landingPage.locator("#mainApp").isVisible(), true, "Start Appointment should open the workspace");
  await landingContext.close();

  for (const [width, height] of [[1920, 1080], [768, 1024], [390, 844]]) {
    const responsive = await openWorkspace(width, height);
    const metrics = await responsive.page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      footerTargets: [...document.querySelectorAll(".footerButtons .btn")].map((button) => button.getBoundingClientRect().height),
    }));
    assert.ok(metrics.scrollWidth <= metrics.clientWidth, `${width}x${height} must not have horizontal overflow`);
    assert.ok(metrics.footerTargets.every((target) => target >= 44), `${width}x${height} footer targets must be at least 44px`);
    await responsive.context.close();
  }

  const { context, page } = await openWorkspace();

  const protectedIds = [
    "landingScreen", "landingForm", "landingStaff", "landingClient1", "landingClient2",
    "mainApp", "backToStart", "saveDraft", "loadDraft", "loadTestData", "generateTop",
    "downloadTop", "downloadPackageTop", "shareTop", "previewTop", "openSettings",
    "resetForm", "saveDraftBottom", "generateBottom", "downloadBottom",
    "downloadPackageBottom", "shareBottom", "includeEOI", "includeIA",
  ];
  for (const id of protectedIds) {
    assert.equal(await page.locator(`#${id}`).count(), 1, `${id} must remain present exactly once`);
  }

  assert.equal(await page.locator("#client2SummaryStatus").innerText(), "Not required");
  assert.equal(await page.locator("#label-signatures").innerText(), "1 required · 0 captured");
  await page.fill("#client2Name", "Jordan Morgan");
  assert.notEqual(await page.locator("#client2SummaryStatus").innerText(), "Not required");
  assert.match(await page.locator("#label-signatures").innerText(), /2 required/);
  await page.fill("#client2Name", "");
  assert.equal(await page.locator("#client2SummaryStatus").innerText(), "Not required");

  assert.equal(await page.locator("#draftConfidenceStatus").count(), 1, "draft confidence status must exist");
  assert.equal(await page.locator("#outputConfidenceStatus").count(), 1, "output confidence status must exist");
  assert.match(await page.locator("#draftConfidenceStatus").innerText(), /Unsaved changes/i);
  assert.match(await page.locator("#outputConfidenceStatus").innerText(), /No PDF generated/i);

  await page.click("#saveDraft");
  assert.match(await page.locator("#draftConfidenceStatus").innerText(), /Draft saved/i);
  await page.fill("#clientPhone", "0400 000 001");
  assert.match(await page.locator("#draftConfidenceStatus").innerText(), /Unsaved changes/i);
  await page.click("#loadDraft");
  assert.match(await page.locator("#draftConfidenceStatus").innerText(), /Draft loaded/i);

  await page.click("#loadTestData");
  await page.evaluate(() => {
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = 10;
    imageCanvas.height = 10;
    window._testState.setPhotoImg(0, imageCanvas);
    window._testState.setHasSignature(true);
    window._testState.clearGenerated();
  });
  await page.click("#generateTop");
  await page.waitForFunction(() => document.querySelector("#outputConfidenceStatus")?.textContent.includes("PDF ready"), null, { timeout: 30000 });
  assert.match(await page.locator("#outputConfidenceStatus").innerText(), /PDF ready/i);

  await page.click("#previewTop");
  await page.click("#openSettings");
  assert.equal(await page.locator("#settingsOverlay").getAttribute("class").then((value) => value.includes("hidden")), false);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settingsOverlay").getAttribute("class").then((value) => value.includes("hidden")), true);

  const pdfDownload = page.waitForEvent("download");
  await page.click("#downloadTop");
  assert.match((await pdfDownload).suggestedFilename(), /\.pdf$/i);

  const packageDownloads = [];
  const collectPackageDownload = (download) => packageDownloads.push(download.suggestedFilename());
  page.on("download", collectPackageDownload);
  await page.click("#downloadPackageTop");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("Package downloaded"), null, { timeout: 30000 });
  page.off("download", collectPackageDownload);
  assert.ok(packageDownloads.some((name) => /\.pdf$/i.test(name)), "package should include a PDF download");
  assert.ok(packageDownloads.some((name) => /\.zip$/i.test(name)), "package should include a ZIP download");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    window.open = (...args) => { window.__shareFallbackOpen = args[0]; return null; };
  });
  await page.click("#shareTop");
  await page.waitForFunction(() => document.querySelector("#status")?.textContent.includes("downloaded"), null, { timeout: 30000 });
  assert.match(await page.evaluate(() => window.__shareFallbackOpen || ""), /^mailto:/i);

  await page.fill("#propertySaleAddress", "Updated output address");
  assert.match(await page.locator("#outputConfidenceStatus").innerText(), /PDF needs regenerating/i);

  const presentation = await page.evaluate(() => {
    const firstCard = document.querySelector("main > .card");
    const secondCard = document.querySelectorAll("main > .card")[1];
    const summaryTitle = document.querySelector(".summary-card-col-title");
    const footerButton = document.querySelector(".footerButtons .btn");
    const fields = document.querySelector(".fields.three");
    return {
      cardGap: secondCard.getBoundingClientRect().top - firstCard.getBoundingClientRect().bottom,
      summaryTitleSize: parseFloat(getComputedStyle(summaryTitle).fontSize),
      footerButtonHeight: footerButton.getBoundingClientRect().height,
      fieldColumns: getComputedStyle(fields).gridTemplateColumns.split(" ").length,
      actionPrimary: document.querySelector("#generateTop").classList.contains("workspace-action-primary"),
      readinessState: document.querySelector("#appointmentStatus").dataset.state,
    };
  });
  assert.ok(presentation.cardGap >= 16, `expected section gap >= 16, got ${presentation.cardGap}`);
  assert.ok(presentation.summaryTitleSize >= 11, `expected summary title >= 11px, got ${presentation.summaryTitleSize}`);
  assert.ok(presentation.footerButtonHeight >= 44, `expected footer target >= 44px, got ${presentation.footerButtonHeight}`);
  assert.equal(presentation.fieldColumns, 2);
  assert.equal(presentation.actionPrimary, true);
  assert.match(presentation.readinessState, /attention|ready/);

  const preservedClient = await page.locator("#clientName").inputValue();
  await page.click("#backToStart");
  assert.equal(await page.locator("#landingScreen").isVisible(), true, "Back to Start should return to landing");
  assert.equal(await page.locator("#clientName").inputValue(), preservedClient, "Back to Start must preserve workspace data");
  await page.click("#landingStartBtn");

  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#resetForm");
  assert.match(await page.locator("#draftConfidenceStatus").innerText(), /Unsaved changes/i);
  assert.match(await page.locator("#outputConfidenceStatus").innerText(), /No PDF generated/i);

  await context.close();
  console.log("PASS ux-polish presentation and protected interaction contracts");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
