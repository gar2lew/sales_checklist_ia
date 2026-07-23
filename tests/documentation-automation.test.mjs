import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  COMMANDS,
  GUIDE_VERSION,
  SCREENSHOT_MANIFEST,
  createRunPaths,
  getWriteContract,
} from '../scripts/docs/config.mjs';
import { runDocumentationCommand } from '../scripts/docs-user-guide.mjs';
import { runCommand } from '../scripts/docs/process.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

test('foundation exposes the four approved documentation modes', () => {
  assert.deepEqual(COMMANDS, ['generate', 'screenshots', 'validate', 'clean']);
  assert.equal(GUIDE_VERSION, '1.0.0');
});

test('screenshot manifest is complete, sorted, unique, and deterministic', () => {
  const expected = [
    ['01-appointment-type-selection.png', 1440, 900, 'Landing', 'appointment-type-selection'],
    ['02-in-person-workspace.png', 1440, 900, 'In-person', 'in-person-workspace'],
    ['03-sale-details-mobile.png', 390, 844, 'In-person', 'sale-details-mobile'],
    ['04-zoom-workspace.png', 844, 390, 'Zoom', 'zoom-workspace'],
    ['05-zoom-whiteboard.png', 844, 390, 'Zoom', 'zoom-whiteboard'],
    ['06-draft-controls.png', 390, 844, 'In-person', 'draft-controls'],
    ['07-id-signatures.png', 1440, 900, 'In-person', 'id-signatures'],
    ['08-package-ready.png', 390, 844, 'In-person', 'package-ready'],
    ['09-downloads-started.png', 390, 844, 'In-person', 'downloads-started'],
  ];
  assert.deepEqual(
    SCREENSHOT_MANIFEST.map((entry) => [
      entry.filename,
      entry.viewport.width,
      entry.viewport.height,
      entry.page,
      entry.captureKey,
    ]),
    expected,
  );
  assert.equal(new Set(SCREENSHOT_MANIFEST.map(({ filename }) => filename)).size, expected.length);
  for (const entry of SCREENSHOT_MANIFEST) {
    assert.equal(entry.viewport.deviceScaleFactor, 2);
    assert.ok(entry.description.length > 10);
    assert.equal(Object.isFrozen(entry), true);
    assert.equal(Object.isFrozen(entry.viewport), true);
  }
  assert.equal(Object.isFrozen(SCREENSHOT_MANIFEST), true);
});

test('run paths remain rooted in the supplied repository', () => {
  const paths = createRunPaths(repoRoot);
  assert.equal(paths.repoRoot, repoRoot);
  assert.equal(paths.guideDir, resolve(repoRoot, 'docs/user-guides'));
  assert.equal(paths.committedScreenshotDir, resolve(repoRoot, 'docs/user-guides/screenshots'));
  assert.equal(paths.tempRoot, resolve(repoRoot, '.tmp/docs-user-guide'));
  assert.equal(paths.tempScreenshotDir, resolve(repoRoot, '.tmp/docs-user-guide/screenshots'));
  for (const path of Object.values(paths)) {
    assert.ok(path === repoRoot || path.startsWith(`${repoRoot}\\`) || path.startsWith(`${repoRoot}/`));
  }
});

test('write contracts match the approved command boundaries', () => {
  assert.deepEqual(getWriteContract('generate'), {
    committed: ['docs/user-guides/'],
    temporary: ['.tmp/docs-user-guide/'],
    readOnly: false,
    cleanOnly: false,
  });
  assert.deepEqual(getWriteContract('screenshots'), {
    committed: [
      'docs/user-guides/screenshots/',
      'docs/user-guides/screenshots.json',
      'docs/user-guides/documentation-report.md',
    ],
    temporary: ['.tmp/docs-user-guide/'],
    readOnly: false,
    cleanOnly: false,
  });
  assert.deepEqual(getWriteContract('validate'), {
    committed: [],
    temporary: [],
    readOnly: true,
    cleanOnly: false,
  });
  assert.deepEqual(getWriteContract('clean'), {
    committed: [],
    temporary: ['.tmp/docs-user-guide/'],
    readOnly: false,
    cleanOnly: true,
  });
  assert.throws(() => getWriteContract('unknown'), /Unknown documentation mode: unknown/);
});

test('orchestrator dispatches each approved mode to its distinct injected handler', async () => {
  const calls = [];
  const handlers = Object.fromEntries(
    COMMANDS.map((mode) => [mode, async (context) => {
      calls.push([mode, context.mode]);
      return { mode, status: 'tested' };
    }]),
  );
  for (const mode of COMMANDS) {
    assert.deepEqual(
      await runDocumentationCommand(mode, { handlers, repoRoot }),
      { mode, status: 'tested' },
    );
  }
  assert.deepEqual(calls, COMMANDS.map((mode) => [mode, mode]));
  await assert.rejects(
    runDocumentationCommand('unknown', { handlers, repoRoot }),
    /Unknown documentation mode: unknown/,
  );
});

test('direct command execution preserves literal arguments and bounds output', async () => {
  const literal = await runCommand(
    process.execPath,
    ['-e', 'process.stdout.write(JSON.stringify(process.argv.slice(1)))', 'a b', '$()'],
  );
  assert.equal(literal.exitCode, 0);
  assert.equal(literal.stdout, '["a b","$()"]');
  assert.equal(literal.stderr, '');

  await assert.rejects(
    runCommand(process.execPath, ['-e', 'process.stdout.write("12345678901")'], { maxOutputBytes: 10 }),
    /exceeded 10 bytes/,
  );
});

test('package scripts and temporary ignore rule expose only the approved foundation wiring', async () => {
  const packageJson = JSON.parse(await readFile(resolve(repoRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['docs:user-guide'], 'node scripts/docs-user-guide.mjs generate');
  assert.equal(packageJson.scripts['docs:screenshots'], 'node scripts/docs-user-guide.mjs screenshots');
  assert.equal(packageJson.scripts['docs:validate'], 'node scripts/docs-user-guide.mjs validate');
  assert.equal(packageJson.scripts['docs:clean'], 'node scripts/docs-user-guide.mjs clean');

  const gitignore = await readFile(resolve(repoRoot, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\/\.tmp\/docs-user-guide\/$/m);
  assert.doesNotMatch(gitignore, /^\/?\.tmp\/?$/m);
});
