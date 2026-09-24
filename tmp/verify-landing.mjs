import { chromium } from "playwright";
import assert from "node:assert/strict";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto("http://127.0.0.1:4173/", { waitUntil: "networkidle" });

const requiredIds = [
  "landingScreen", "landingForm", "landingStaffWrapper", "landingStaffTrigger",
  "landingStaffMenu", "landingStaff", "landingClient1", "landingClient2",
  "landingStartBtn",
];
for (const id of requiredIds) {
  assert.equal(await page.locator(`#${id}`).count(), 1, `${id} must exist exactly once`);
}

assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-haspopup"), "listbox");
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "false");
assert.equal(await page.locator("#landingStaffMenu").getAttribute("role"), "listbox");
assert.equal(await page.locator('#landingStaffMenu li[role="option"]').count(), 6);
assert.equal(await page.locator("#landingStaff").getAttribute("aria-hidden"), "true");
assert.equal(await page.locator("#landingStaff").getAttribute("style"), "display:none");
assert.equal(await page.locator('label[for="landingStaff"]').count(), 1);
assert.equal(await page.locator('label[for="landingClient1"]').count(), 1);
assert.equal(await page.locator('label[for="landingClient2"]').count(), 1);
assert.equal(await page.locator("#landingStartBtn").isDisabled(), true);

await page.locator("#landingStaffTrigger").click();
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "true");
await page.locator(".landing-form-title").click();
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "false");

await page.locator("#landingStaffTrigger").focus();
await page.keyboard.press("ArrowDown");
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "true");
await page.keyboard.press("ArrowDown");
assert.equal(await page.locator("#landingStaffMenu li").first().evaluate((el) => el === document.activeElement), true);
await page.keyboard.press("ArrowDown");
assert.equal(await page.locator("#landingStaffMenu li").nth(1).evaluate((el) => el === document.activeElement), true);
await page.keyboard.press("ArrowUp");
assert.equal(await page.locator("#landingStaffMenu li").first().evaluate((el) => el === document.activeElement), true);
await page.keyboard.press("Enter");
assert.equal(await page.locator("#landingStaff").inputValue(), "Blake");
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "false");

await page.locator("#landingStaffTrigger").focus();
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Escape");
assert.equal(await page.locator("#landingStaffTrigger").getAttribute("aria-expanded"), "false");
assert.equal(await page.locator("#landingStaffTrigger").evaluate((el) => el === document.activeElement), true);

await page.locator("#landingClient1").fill("Taylor Morgan");
await page.locator("#landingClient2").fill("Jordan Morgan");
assert.equal(await page.locator("#landingStartBtn").isEnabled(), true);
await page.locator("#landingStartBtn").click();
assert.equal(await page.locator("#landingScreen").isHidden(), true);
assert.equal(await page.locator("#mainApp").isVisible(), true);
assert.equal(await page.locator("#teamMember").inputValue(), "Blake");
assert.equal(await page.locator("#clientName").inputValue(), "Taylor Morgan");
assert.equal(await page.locator("#client2Name").inputValue(), "Jordan Morgan");

await page.locator("#backToStart").click();
assert.equal(await page.locator("#landingScreen").isVisible(), true);
assert.equal(await page.locator("#mainApp").isHidden(), true);

await page.locator("#landingStartBtn").click();
assert.equal(await page.locator("#mainApp").isVisible(), true);
page.once("dialog", (dialog) => dialog.accept());
await page.locator("#resetForm").click();
assert.equal(await page.locator("#landingScreen").isVisible(), true);
assert.equal(await page.locator("#clientName").inputValue(), "");
assert.equal(await page.locator("#client2Name").inputValue(), "");

const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
assert.equal(horizontalOverflow, false);

console.log("PASS: DOM contract, dropdown pointer/keyboard behavior, Start state, autofill, Start Appointment, Back to Start, and New Appointment reset");
await browser.close();
