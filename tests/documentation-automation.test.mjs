import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
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
import {
  assertAllowedChanges,
  assertCleanNamedBranch,
  hashProtectedFiles,
  inspectRepository,
} from '../scripts/docs/git-integrity.mjs';
import { runCommand } from '../scripts/docs/process.mjs';
import {
  assertNodeFeatures,
  discoverPython,
  discoverTooling,
} from '../scripts/docs/tooling.mjs';

const repoRoot = resolve(import.meta.dirname, '..');

async function createGitFixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'docs-preflight-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [executable, args] of [
    ['git', ['init', '-b', 'fixture/clean']],
    ['git', ['config', 'user.email', 'docs@example.invalid']],
    ['git', ['config', 'user.name', 'Docs Fixture']],
  ]) {
    const result = await runCommand(executable, args, { cwd: directory });
    assert.equal(result.exitCode, 0, result.stderr);
  }
  await writeFile(resolve(directory, 'tracked.txt'), 'baseline\n');
  await runCommand('git', ['add', 'tracked.txt'], { cwd: directory });
  await runCommand('git', ['commit', '-m', 'fixture'], { cwd: directory });
  return directory;
}

function successfulResult(stdout = '') {
  return { exitCode: 0, signal: null, stdout, stderr: '' };
}

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

test('Git preflight accepts a clean named branch and records the Source commit', async (t) => {
  const fixture = await createGitFixture(t);
  const nested = resolve(fixture, 'nested/path');
  await mkdir(nested, { recursive: true });
  const context = await inspectRepository({ repoRoot: nested });
  await assertCleanNamedBranch(context, { mode: 'generate' });
  assert.equal(context.branch, 'fixture/clean');
  assert.match(context.sourceCommit, /^[0-9a-f]{40}$/);
  assert.equal(context.shortSourceCommit, context.sourceCommit.slice(0, 12));
  assert.equal(context.repoRoot, fixture);
});

test('Git preflight rejects detached HEAD with remediation', async (t) => {
  const fixture = await createGitFixture(t);
  await runCommand('git', ['checkout', '--detach'], { cwd: fixture });
  const context = await inspectRepository({ repoRoot: fixture });
  await assert.rejects(
    assertCleanNamedBranch(context, { mode: 'generate' }),
    /Git preflight.*detached HEAD.*git switch/si,
  );
});

test('Git preflight rejects tracked, staged, and untracked dirt but exempts clean mode', async (t) => {
  const fixture = await createGitFixture(t);
  const cases = [
    async () => writeFile(resolve(fixture, 'tracked.txt'), 'dirty\n'),
    async () => {
      await writeFile(resolve(fixture, 'staged.txt'), 'staged\n');
      await runCommand('git', ['add', 'staged.txt'], { cwd: fixture });
    },
    async () => writeFile(resolve(fixture, 'untracked.txt'), 'untracked\n'),
  ];
  for (const makeDirty of cases) {
    await runCommand('git', ['reset', '--hard', 'HEAD'], { cwd: fixture });
    await runCommand('git', ['clean', '-fd'], { cwd: fixture });
    await makeDirty();
    const context = await inspectRepository({ repoRoot: fixture });
    await assert.rejects(
      assertCleanNamedBranch(context, { mode: 'generate' }),
      /Git preflight.*working tree.*git status/si,
    );
    await assert.doesNotReject(assertCleanNamedBranch(context, { mode: 'clean' }));
  }
});

test('protected hashing detects byte changes and allowed-change contracts reject scope drift', async (t) => {
  const fixture = await createGitFixture(t);
  await mkdir(resolve(fixture, 'js'));
  await writeFile(resolve(fixture, 'index.html'), 'one');
  await writeFile(resolve(fixture, 'js/app.js'), 'one');
  await runCommand('git', ['add', '.'], { cwd: fixture });
  await runCommand('git', ['commit', '-m', 'runtime'], { cwd: fixture });
  const before = await hashProtectedFiles({ repoRoot: fixture });
  await writeFile(resolve(fixture, 'js/app.js'), 'two');
  const after = await hashProtectedFiles({ repoRoot: fixture });
  assert.notEqual(before.get('js/app.js'), after.get('js/app.js'));
  assert.doesNotThrow(() => assertAllowedChanges({
    mode: 'generate',
    changedPaths: ['docs/user-guides/guide.pdf', '.tmp/docs-user-guide/candidate.png'],
  }));
  for (const forbidden of [
    'package.json',
    'scripts/docs-user-guide.mjs',
    'tests/documentation-automation.test.mjs',
    'js/app.js',
    'notes.txt',
  ]) {
    assert.throws(
      () => assertAllowedChanges({ mode: 'generate', changedPaths: [forbidden] }),
      new RegExp(`Integrity preflight.*${forbidden.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'si'),
    );
  }
  assert.throws(
    () => assertAllowedChanges({ mode: 'screenshots', changedPaths: ['docs/user-guides/README.md'] }),
    /Integrity preflight.*README\.md/si,
  );
});

test('Node preflight validates supported versions and required features', () => {
  assert.doesNotThrow(() => assertNodeFeatures({
    nodeVersion: '18.20.0',
    fetch: () => {},
    abortSignalTimeout: () => {},
    createHash: () => {},
    importMetaUrl: 'file:///test.mjs',
  }));
  for (const [environment, requirement] of [
    [{ nodeVersion: '16.20.2' }, /Node 18 or newer/],
    [{ nodeVersion: 'not-a-version' }, /valid Node version/],
    [{ nodeVersion: '20.0.0', fetch: null }, /native fetch/],
    [{ nodeVersion: '20.0.0', fetch: () => {}, abortSignalTimeout: null }, /AbortSignal\.timeout/],
    [{
      nodeVersion: '20.0.0',
      fetch: () => {},
      abortSignalTimeout: () => {},
      createHash: null,
    }, /SHA-256/],
    [{
      nodeVersion: '20.0.0',
      fetch: () => {},
      abortSignalTimeout: () => {},
      createHash: () => {},
      importMetaUrl: null,
    }, /ES modules/],
  ]) {
    assert.throws(() => assertNodeFeatures(environment), requirement);
  }
});

test('Python discovery honours the approved precedence and validates imports', async () => {
  const calls = [];
  const runner = async (executable, args) => {
    calls.push([executable, args]);
    return successfulResult();
  };
  assert.deepEqual(await discoverPython({
    env: { DOCS_PYTHON: 'C:\\Python\\python.exe' },
    platform: 'win32',
    run: runner,
  }), { executable: 'C:\\Python\\python.exe', prefixArgs: [] });
  assert.equal(calls[0][0], 'C:\\Python\\python.exe');

  const pythonFallbackCalls = [];
  const pythonFallback = await discoverPython({
    env: {},
    platform: 'win32',
    run: async (executable, args) => {
      pythonFallbackCalls.push([executable, args]);
      return executable === 'python' ? successfulResult() : { ...successfulResult(), exitCode: 1 };
    },
  });
  assert.deepEqual(pythonFallback, { executable: 'python', prefixArgs: [] });
  assert.equal(pythonFallbackCalls.some(([name]) => name.includes('.codex')), false);

  const pyFallback = await discoverPython({
    env: {},
    platform: 'win32',
    run: async (executable) => (
      executable === 'py' ? successfulResult() : { ...successfulResult(), exitCode: 1 }
    ),
  });
  assert.deepEqual(pyFallback, { executable: 'py', prefixArgs: ['-3'] });
});

test('Python discovery rejects missing interpreters and required imports', async () => {
  await assert.rejects(
    discoverPython({
      env: {},
      platform: 'linux',
      run: async () => ({ ...successfulResult(), exitCode: 1 }),
    }),
    /Python preflight.*DOCS_PYTHON.*python-docx.*Pillow/si,
  );
  for (const missing of ['docx', 'PIL']) {
    await assert.rejects(
      discoverPython({
        env: { DOCS_PYTHON: 'python-custom' },
        platform: 'linux',
        run: async (_executable, args) => (
          args.at(-1)?.includes(`import ${missing}`)
            ? { ...successfulResult(), exitCode: 1 }
            : successfulResult()
        ),
      }),
      new RegExp(`Python preflight.*${missing}`, 'si'),
    );
  }
});

test('tooling preflight rejects missing Playwright, Chromium, LibreOffice, pdfinfo, or input', async () => {
  const base = {
    repoRoot,
    nodeEnvironment: {
      nodeVersion: '20.11.1',
      fetch: () => {},
      abortSignalTimeout: () => {},
      createHash: () => {},
      importMetaUrl: 'file:///test.mjs',
    },
    discoverPythonCommand: async () => ({ executable: 'python', prefixArgs: [] }),
    resolvePlaywright: async () => ({ chromium: { launch: async () => ({ close: async () => {} }) } }),
    findExecutable: async (name) => ({ executable: name, prefixArgs: [] }),
    fileExists: async () => true,
  };
  const failures = [
    [{ resolvePlaywright: async () => null }, /Playwright preflight.*npm install/si],
    [{
      resolvePlaywright: async () => ({
        chromium: { launch: async () => { throw new Error('browser missing'); } },
      }),
    }, /Chromium preflight.*playwright install chromium/si],
    [{ findExecutable: async (name) => (name === 'libreoffice' ? null : { executable: name, prefixArgs: [] }) }, /LibreOffice preflight/],
    [{ findExecutable: async (name) => (name === 'pdfinfo' ? null : { executable: name, prefixArgs: [] }) }, /pdfinfo preflight/],
    [{ fileExists: async (path) => !path.endsWith('SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md') }, /Repository input preflight.*SALES_APPOINTMENT/si],
  ];
  for (const [override, expected] of failures) {
    await assert.rejects(discoverTooling({ ...base, ...override }), expected);
  }
  const tooling = await discoverTooling(base);
  assert.equal(tooling.python.executable, 'python');
  assert.equal(tooling.playwright, 'available');
});
