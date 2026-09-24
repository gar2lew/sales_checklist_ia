import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const [name, widthArg = "1366", heightArg = "768", state = "initial"] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);
await mkdir("screenshots/ux-polish", { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
const page = await context.newPage();
await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });

if (state !== "landing") {
  await page.click("#landingStaffTrigger");
  await page.click('#landingStaffMenu [data-value="Blake"]');
  await page.fill("#landingClient1", "Taylor Morgan");
  if (state === "client2") await page.fill("#landingClient2", "Jordan Morgan");
  await page.click("#landingStartBtn");
  if (state === "saved") await page.click("#saveDraft");
  if (state === "expanded") await page.click("#summaryDisclosure");
  if (state === "lower") {
    await page.locator("#item4").scrollIntoViewIfNeeded();
    await page.locator("#notes").focus();
  }
  if (state === "ready" || state === "invalidated") {
    page.on("dialog", (dialog) => dialog.accept());
    if (!await page.locator("#loadTestData").isVisible()) await page.click("#workspaceSecondaryActions > .secondaryActionsTrigger");
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
    if (state === "invalidated") await page.fill("#propertySaleAddress", "Updated output address");
  }
}

await page.screenshot({ path: `screenshots/ux-polish/${name}.png`, fullPage: false });
await browser.close();
