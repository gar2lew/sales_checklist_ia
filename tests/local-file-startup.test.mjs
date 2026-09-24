import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const browser = await chromium.launch({headless:true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const failures = [];
  page.on('requestfailed', request => failures.push(request.url()));
  await page.goto(pathToFileURL(path.resolve('index.html')).href,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('.landing-container').evaluate(element => getComputedStyle(element).display),'grid','local file loads landing layout CSS');
  assert.equal(await page.evaluate(() => typeof window._testState),'object','local file loads the application runtime');
  assert.deepEqual(failures,[],'local file has no missing asset requests');
  console.log('PASS local file startup loads layout and application assets');
} finally {
  await browser.close();
}
