import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const drawIaStart = source.indexOf('function drawIAPage(');
const drawIaEnd = source.indexOf('// SECTION M:', drawIaStart);
const drawIaPage = drawIaStart >= 0 && drawIaEnd > drawIaStart
  ? source.slice(drawIaStart, drawIaEnd)
  : '';
const fieldRenderStart = drawIaPage.indexOf("const iaAmount = fieldText('iaAmount')");
const fieldRenderEnd = drawIaPage.indexOf('if(hasSignature', fieldRenderStart);
const fieldRendering = drawIaPage.slice(fieldRenderStart, fieldRenderEnd);

assert.ok(drawIaPage, 'drawIAPage must remain available');
assert.ok(fieldRenderStart >= 0 && fieldRenderEnd > fieldRenderStart, 'IA field-rendering block must remain identifiable');
assert.doesNotMatch(
  fieldRendering,
  /whiteOut|fillRect|clearRect|strokeRect|globalCompositeOperation|clip\(|ctx\.rect\(|drawImage\(/,
  'appended IA fields must use transparent text without fills, masks, erasure, clipping, or template replacement'
);

const expectedFields = [
  /drawTemplateLineValue\(iaClientNames, 315, 332, 850,/,
  /drawTemplateLineValue\(iaAddress, 245, 382, 900,/,
  /drawTemplateLineValue\(iaProperty, 300, 428, 850,/,
  /overlayFitText\(fieldText\('iaSolicitor'\), 640, 564, 510,/,
  /overlayFitText\(iaAmount, 770, 783, 96, '800', 13, 7\.5\)/,
  /overlayText\(formattedDateForIA\(\), 235, 1225, 391,/
];
for (const fieldPattern of expectedFields) assert.match(fieldRendering, fieldPattern);

assert.match(source, /perth:\s*'templates\/ia-perth-clean\.jpg'/, 'Perth must use a clean amount template');
assert.match(source, /brisbane:\s*'templates\/ia-brisbane-clean\.jpg'/, 'Brisbane must use a clean amount template');

const templateWidth = 1224;
const fieldBounds = {
  clientNames: { x: 315, width: 850 },
  address: { x: 245, width: 900 },
  property: { x: 300, width: 850 },
  solicitor: { x: 640, width: 510 },
  date: { x: 235, width: 391 }
};
for (const [field, bounds] of Object.entries(fieldBounds)) {
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= templateWidth, `${field} must stay inside the IA page`);
}

const amountRegion = { left: 770, right: 866, baseline: 783 };
const templateToCanvasScale = 595 / templateWidth;
assert.equal(amountRegion.right - amountRegion.left, 96);
assert.ok(amountRegion.left >= 770, 'amount must retain a natural space after "an amount of"');
assert.ok(amountRegion.right < 870, 'amount must end before "from the proceeds"');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const results = await page.evaluate(({ amounts, region, scale }) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return amounts.map(amount => {
      let size = 13;
      while (size > 7.5) {
        ctx.font = `800 ${size}px Arial`;
        if (ctx.measureText(amount).width <= (region.right - region.left) * scale) break;
        size -= 0.5;
      }
      ctx.font = `800 ${size}px Arial`;
      const width = ctx.measureText(amount).width;
      return { amount, size, width, right: region.left + (width / scale) };
    });
  }, { amounts: ['$1,000', '$10,000', '$100,000', '$1,000,000'], region: amountRegion, scale: templateToCanvasScale });

  for (const result of results) {
    assert.ok(result.right <= amountRegion.right, `${result.amount} must not overlap "from the proceeds"`);
    assert.ok(result.size >= 7.5, `${result.amount} must remain legible`);
  }
  console.log(JSON.stringify({ amountRegion, results }, null, 2));
} finally {
  await browser.close();
}

assert.match(drawIaPage, /const p1 = map\(130, 1364\);[\s\S]*const p2 = map\(570, 1458\);/, 'signature 1 area must remain unchanged');
assert.match(drawIaPage, /const p1 = map\(700, 1364\);[\s\S]*const p2 = map\(1140, 1458\);/, 'signature 2 area must remain unchanged');
assert.match(drawIaPage, /ctx\.fillRect\(38,806,519,28\);[\s\S]*drawGeneratedFooter\(ctx,pageNumber,totalPages,'Irrevocable Authority',42,817\);/, 'footer area must remain unchanged');

console.log('IA transparent-overlay regression checks passed.');
