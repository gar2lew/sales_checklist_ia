import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const [name = "capture", widthArg = "1366", heightArg = "768", state = "disabled"] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);
const outputDir = path.resolve("screenshots", "landing-migration");

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width, height } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });
if (state === "enabled") {
  await page.locator("#landingStaffTrigger").click();
  await page.locator('#landingStaffMenu [data-value="Blake"]').click();
  await page.locator("#landingClient1").fill("Taylor Morgan");
}
await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });
await browser.close();
