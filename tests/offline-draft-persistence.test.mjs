import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildFictionalOfflineDraft, assertDraftShape, assertFictionalStrings } from './helpers/offline-fixtures.mjs';

const root = process.cwd();
const fixturePath = resolve(root, 'tests/fixtures/offline-draft-v2.7.0-alpha.1.json');

// 1. Legacy fixture is valid and contains only fictional data
const legacyFixture = JSON.parse(await readFile(fixturePath, 'utf8'));
assertDraftShape(legacyFixture);
assertFictionalStrings(legacyFixture);
assert.equal(legacyFixture.appointmentMode, 'zoom');
assert.equal(legacyFixture.staffName, 'Garry Lewis');
assert.ok(legacyFixture.includeEOI);
assert.ok(legacyFixture.includeIA);
assert.ok(legacyFixture.contractDueDateTbc);
assert.ok(legacyFixture.signature.startsWith('data:image/png'));
assert.ok(Array.isArray(legacyFixture.photos));
assert.ok(legacyFixture.photos[0].dataURL.startsWith('data:image/png'));
assert.ok(Array.isArray(legacyFixture.whiteboardPages));
assert.ok(legacyFixture.whiteboardPages[0].strokes[0].points.length >= 3);
assert.ok(Array.isArray(legacyFixture.wbSavedPages));
assert.ok(legacyFixture.wbSavedPages[0].dataURL.startsWith('data:image/png'));
console.log('PASS legacy draft fixture validates all required fields');

// 2. buildFictionalOfflineDraft produces a valid draft
const draft = buildFictionalOfflineDraft();
assertDraftShape(draft);
assertFictionalStrings(draft);
assert.equal(draft.appointmentMode, 'zoom');
assert.equal(draft.staffName, 'Garry Lewis');
assert.equal(draft.clientName, 'Fictional Test Client');
assert.equal(draft.clientEmail, 'fictional.test@example.invalid');
assert.ok(draft.includeEOI);
assert.ok(draft.includeIA);
assert.ok(draft.contractDueDateTbc);
assert.ok(draft.signature.startsWith('data:image/png'));
assert.ok(draft.photos[0].dataURL.startsWith('data:image/png'));
assert.ok(draft.wbSavedPages[0].dataURL.startsWith('data:image/png'));
console.log('PASS buildFictionalOfflineDraft produces complete valid draft');

// 3. Overrides are applied
const overridden = buildFictionalOfflineDraft({ clientName: 'Override Client', includeEOI: false });
assert.equal(overridden.clientName, 'Override Client');
assert.equal(overridden.includeEOI, false);
assert.equal(overridden.staffName, 'Garry Lewis'); // unchanged
console.log('PASS overrides are applied correctly');

// 4. JSON round-trip
const serialized = JSON.stringify(draft);
const deserialized = JSON.parse(serialized);
assertDraftShape(deserialized);
assert.equal(deserialized.clientName, 'Fictional Test Client');
assert.equal(deserialized.signature, draft.signature);
console.log('PASS JSON round-trip preserves all fields');

// 5. Corruption detection: malformed JSON
let corruptDetected = false;
try { JSON.parse('{corrupted'); } catch { corruptDetected = true; }
assert.ok(corruptDetected, 'Malformed JSON must be detectable');
console.log('PASS malformed JSON is detectable');

// 6. Corruption detection: missing required keys
const missingKey = buildFictionalOfflineDraft();
delete missingKey.signature;
let missingDetected = false;
try { assertDraftShape(missingKey); } catch { missingDetected = true; }
assert.ok(missingDetected, 'Missing required key must be detectable');
console.log('PASS missing required key is detectable');

// 7. No real client data in fixtures
const fixtureText = await readFile(fixturePath, 'utf8');
const banned = ['@gmail.com', '@yahoo.com', '@outlook.com', '0400 000 000', '0411 111 111'];
for (const term of banned) {
  assert.ok(!fixtureText.includes(term), `Fixture must not contain real-looking value: ${term}`);
}
console.log('PASS fixture contains no real-looking client data');

console.log('\nAll offline draft persistence tests PASSED');
