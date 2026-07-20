import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  'IA appended fields must use the approved transparent overlays'
);

const expectedFields = [
  /drawTemplateLineValue\(iaClientNames, 315, 330, 850,/,
  /drawTemplateLineValue\(iaAddress, 245, 378, 900,/,
  /drawTemplateLineValue\(iaProperty, 300, 420, 850,/,
  /overlayFitText\(fieldText\('iaSolicitor'\), 640, 564, 510,/,
  /overlayFitText\(iaAmount, 770, 783, 96, '800', 13, 7\.5\)/,
  /overlayText\(formattedDateForIA\(\), 235, 1225, 391,/
];
for (const fieldPattern of expectedFields) assert.match(fieldRendering, fieldPattern);

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

assert.match(source, /perth:\s*'templates\/ia-perth-clean\.jpg'/, 'Perth must use the approved clean IA template');
assert.match(source, /brisbane:\s*'templates\/ia-brisbane-clean\.jpg'/, 'Brisbane must use the approved clean IA template');


assert.match(drawIaPage, /const p1 = map\(130, 1364\);[\s\S]*const p2 = map\(570, 1458\);/, 'signature 1 area must remain unchanged');
assert.match(drawIaPage, /const p1 = map\(700, 1364\);[\s\S]*const p2 = map\(1140, 1458\);/, 'signature 2 area must remain unchanged');
assert.match(drawIaPage, /ctx\.fillRect\(38,806,519,28\);[\s\S]*drawGeneratedFooter\(ctx,pageNumber,totalPages,'Irrevocable Authority',42,817\);/, 'footer area must remain unchanged');

console.log('IA target-rendering regression checks passed.');
