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
  SERVER_DEFAULTS,
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
  FINGERPRINT_PATHS,
  buildLocalFingerprint,
  compareServerFingerprint,
  fetchBounded,
  resolveServerConfiguration,
  runWithServerLease,
  stopOwnedServer,
} from '../scripts/docs/server.mjs';
import {
  applyScreenshotChanges,
  assertCaptureReady,
  buildScreenshotMetadata,
  classifyScreenshots,
  runScreenshotCapture,
  serializeScreenshotMetadata,
  sha256File,
  validatePng,
} from '../scripts/docs/screenshots.mjs';
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

test('server defaults and candidate configuration match the approved finite contract', () => {
  assert.deepEqual(SERVER_DEFAULTS, {
    host: '127.0.0.1',
    preferredPort: 8766,
    firstPort: 8766,
    lastPort: 8776,
    startupTimeoutMs: 15_000,
    pollIntervalMs: 200,
    requestTimeoutMs: 5_000,
    maxResponseBytes: 10 * 1024 * 1024,
    redirect: 'manual',
  });
  assert.deepEqual(FINGERPRINT_PATHS, [
    'index.html',
    'css/app.css',
    'js/app.js',
    'manifest.webmanifest',
    'service-worker.js',
  ]);
  assert.deepEqual(resolveServerConfiguration({ env: {} }).ports, [
    8766, 8767, 8768, 8769, 8770, 8771, 8772, 8773, 8774, 8775, 8776,
  ]);
  assert.equal(
    resolveServerConfiguration({ env: { DOCS_BASE_URL: 'https://localhost:9443' } })
      .explicitBaseUrl.href,
    'https://localhost:9443/',
  );
  assert.equal(
    resolveServerConfiguration({ env: { DOCS_PORT: '9000' } }).explicitPort,
    9000,
  );
  for (const value of [
    'ftp://localhost:8766',
    'http://user@localhost:8766',
    'http://localhost:8766/path',
    'not a url',
  ]) {
    assert.throws(
      () => resolveServerConfiguration({ env: { DOCS_BASE_URL: value } }),
      /Server configuration.*DOCS_BASE_URL/si,
    );
  }
  for (const value of ['abc', '9000.5', '1023', '65536']) {
    assert.throws(
      () => resolveServerConfiguration({ env: { DOCS_PORT: value } }),
      /Server configuration.*DOCS_PORT/si,
    );
  }
});

test('fingerprint helpers hash raw bytes and report match, mismatch, missing, and cache busting', async (t) => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'docs-fingerprint-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  const content = new Map();
  for (const path of FINGERPRINT_PATHS) {
    await mkdir(resolve(fixture, path, '..'), { recursive: true });
    const value = Buffer.from(`bytes:${path}`);
    content.set(path, value);
    await writeFile(resolve(fixture, path), value);
  }
  const local = await buildLocalFingerprint({ repoRoot: fixture });
  assert.equal(local.size, 5);
  const requested = [];
  const matchingFetch = async (url, options) => {
    requested.push([String(url), options.redirect]);
    const path = new URL(url).pathname.slice(1);
    return new Response(content.get(path), { status: 200 });
  };
  const matched = await compareServerFingerprint({
    baseUrl: new URL('http://127.0.0.1:8766'),
    localFingerprint: local,
    fetchImpl: matchingFetch,
    cacheToken: 'fixed',
  });
  assert.equal(matched.match, true);
  assert.equal(requested.length, 5);
  assert.ok(requested.every(([url, redirect]) => (
    url.includes('docs_fingerprint=fixed') && redirect === 'manual'
  )));

  const mismatch = await compareServerFingerprint({
    baseUrl: new URL('http://127.0.0.1:8766'),
    localFingerprint: local,
    fetchImpl: async (url) => {
      const path = new URL(url).pathname.slice(1);
      return new Response(path === 'js/app.js' ? 'changed' : content.get(path), { status: 200 });
    },
  });
  assert.deepEqual(mismatch.mismatched, ['js/app.js']);
  assert.equal(mismatch.match, false);

  const missing = await compareServerFingerprint({
    baseUrl: new URL('http://127.0.0.1:8766'),
    localFingerprint: local,
    fetchImpl: async (url) => (
      new URL(url).pathname === '/service-worker.js'
        ? new Response('missing', { status: 404 })
        : new Response(content.get(new URL(url).pathname.slice(1)), { status: 200 })
    ),
  });
  assert.deepEqual(missing.missing, ['service-worker.js']);
});

test('bounded fetch rejects redirects, non-200 responses, and oversized bodies', async () => {
  await assert.rejects(
    fetchBounded(new URL('http://localhost/file'), {
      fetchImpl: async () => new Response('', { status: 302, headers: { location: '/other' } }),
    }),
    /HTTP preflight.*redirect/si,
  );
  await assert.rejects(
    fetchBounded(new URL('http://localhost/file'), {
      fetchImpl: async () => new Response('no', { status: 404 }),
    }),
    /HTTP preflight.*404/si,
  );
  await assert.rejects(
    fetchBounded(new URL('http://localhost/file'), {
      maxBytes: 4,
      fetchImpl: async () => new Response('12345', {
        status: 200,
        headers: { 'content-length': '5' },
      }),
    }),
    /HTTP preflight.*4 bytes/si,
  );
  await assert.rejects(
    fetchBounded(new URL('http://localhost/file'), {
      maxBytes: 4,
      fetchImpl: async () => new Response('12345', { status: 200 }),
    }),
    /HTTP preflight.*4 bytes/si,
  );
});

test('server cleanup is ownership-scoped, idempotent, and preserves primary errors', async () => {
  let reusedStops = 0;
  const reused = {
    disposition: 'reused',
    cleanup: async () => { reusedStops += 1; },
  };
  await runWithServerLease(reused, async () => 'ok');
  assert.equal(reusedStops, 1);

  const calls = [];
  const child = { pid: 4321, exitCode: null };
  await stopOwnedServer({
    child,
    platform: 'win32',
    run: async (executable, args) => {
      calls.push([executable, args]);
      child.exitCode = 0;
      return successfulResult();
    },
    waitForExit: async () => true,
  });
  assert.deepEqual(calls, [['taskkill.exe', ['/PID', '4321', '/T', '/F']]]);

  const primary = new Error('primary pipeline failure');
  const cleanup = new Error('cleanup failed');
  const lease = { cleanup: async () => { throw cleanup; } };
  await assert.rejects(
    runWithServerLease(lease, async () => { throw primary; }),
    (error) => error === primary && error.cleanupError === cleanup,
  );
});

async function writePngFixture(path, width = 20, height = 10, suffix = '') {
  const bytes = Buffer.alloc(33 + Buffer.byteLength(suffix));
  Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  Buffer.from(suffix).copy(bytes, 33);
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
}

test('screenshot classification supports unchanged, updated, new, and intentional removed', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-screenshots-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidateDir = resolve(root, 'candidate');
  const committedDir = resolve(root, 'committed');
  await writePngFixture(resolve(candidateDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(committedDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(candidateDir, '02-updated.png'), 20, 10, 'new');
  await writePngFixture(resolve(committedDir, '02-updated.png'), 20, 10, 'old');
  await writePngFixture(resolve(candidateDir, '03-new.png'), 20, 10, 'new');
  await writePngFixture(resolve(committedDir, '04-removed.png'), 20, 10, 'removed');
  const manifest = [
    { filename: '01-same.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'A', description: 'Same' },
    { filename: '02-updated.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'B', description: 'Updated' },
    { filename: '03-new.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'C', description: 'New' },
  ];
  const result = await classifyScreenshots({ manifest, candidateDir, committedDir });
  assert.deepEqual(result.UNCHANGED.map(({ filename }) => filename), ['01-same.png']);
  assert.deepEqual(result.UPDATED.map(({ filename }) => filename), ['02-updated.png']);
  assert.deepEqual(result.NEW.map(({ filename }) => filename), ['03-new.png']);
  assert.deepEqual(result.REMOVED.map(({ filename }) => filename), ['04-removed.png']);
  assert.equal(await sha256File(resolve(candidateDir, '01-same.png')), result.UNCHANGED[0].hash);
});

test('candidate validation rejects missing, unexpected, duplicate, malformed, and invalid PNG sets before writes', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-screenshot-invalid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidateDir = resolve(root, 'candidate');
  const committedDir = resolve(root, 'committed');
  await mkdir(candidateDir, { recursive: true });
  await mkdir(committedDir, { recursive: true });
  const entry = {
    filename: '01-required.png',
    viewport: { width: 20, height: 10, deviceScaleFactor: 2 },
    page: 'A',
    description: 'Required',
  };
  await assert.rejects(
    classifyScreenshots({ manifest: [entry], candidateDir, committedDir }),
    /Screenshot capture.*missing.*01-required/si,
  );
  await writePngFixture(resolve(candidateDir, entry.filename));
  await writePngFixture(resolve(candidateDir, 'unexpected.png'));
  await assert.rejects(
    classifyScreenshots({ manifest: [entry], candidateDir, committedDir }),
    /Screenshot capture.*unexpected\.png/si,
  );
  await rm(resolve(candidateDir, 'unexpected.png'));
  await assert.rejects(
    classifyScreenshots({ manifest: [entry, entry], candidateDir, committedDir }),
    /Screenshot manifest.*duplicate/si,
  );
  await writeFile(resolve(candidateDir, entry.filename), 'not png');
  await assert.rejects(
    classifyScreenshots({ manifest: [entry], candidateDir, committedDir }),
    /PNG validation/si,
  );
  await assert.rejects(validatePng(resolve(candidateDir, entry.filename)), /PNG validation/);
});

test('capture failure never alters or removes committed screenshots', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-screenshot-preserve-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidateDir = resolve(root, '.tmp/docs-user-guide/screenshots');
  const committedDir = resolve(root, 'docs/user-guides/screenshots');
  const metadataPath = resolve(root, 'docs/user-guides/screenshots.json');
  const committedPath = resolve(committedDir, '01-existing.png');
  await writePngFixture(committedPath, 20, 10, 'preserve');
  const before = await readFile(committedPath);
  await assert.rejects(
    applyScreenshotChanges({
      manifest: [{
        filename: '02-required.png',
        viewport: { width: 20, height: 10, deviceScaleFactor: 2 },
        page: 'Required',
        description: 'Required',
      }],
      candidateDir,
      committedDir,
      metadataPath,
      timestamp: '2026-07-22T02:00:00.000Z',
    }),
    /Screenshot capture.*missing/si,
  );
  assert.deepEqual(await readFile(committedPath), before);
});

test('screenshot metadata is ordered and preserves unchanged timestamps while sharing changed timestamp', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-screenshot-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidateDir = resolve(root, 'candidate');
  const committedDir = resolve(root, 'committed');
  await writePngFixture(resolve(candidateDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(committedDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(candidateDir, '02-new.png'), 30, 15, 'new');
  const manifest = [
    { filename: '02-new.png', viewport: { width: 30, height: 15, deviceScaleFactor: 2 }, page: 'New', description: 'New item' },
    { filename: '01-same.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'Same', description: 'Same item' },
  ];
  const classification = await classifyScreenshots({ manifest, candidateDir, committedDir });
  const timestamp = '2026-07-22T02:00:00.000Z';
  const metadata = buildScreenshotMetadata({
    manifest,
    classification,
    previousMetadata: {
      schemaVersion: 1,
      screenshots: [{
        filename: '01-same.png',
        viewport: { width: 20, height: 10, deviceScaleFactor: 2 },
        page: 'Same',
        description: 'Same item',
        hash: classification.UNCHANGED[0].hash,
        lastGenerated: '2026-01-01T00:00:00.000Z',
      }],
    },
    timestamp,
  });
  assert.deepEqual(metadata.screenshots.map(({ filename }) => filename), ['01-same.png', '02-new.png']);
  assert.equal(metadata.screenshots[0].lastGenerated, '2026-01-01T00:00:00.000Z');
  assert.equal(metadata.screenshots[1].lastGenerated, timestamp);
  const serialized = serializeScreenshotMetadata(metadata);
  assert.equal(serialized.endsWith('\n'), true);
  assert.equal(serialized.endsWith('\n\n'), false);
  assert.match(serialized, /^\{\n  "schemaVersion": 1,\n  "screenshots": \[/);
  assert.throws(
    () => buildScreenshotMetadata({
      manifest,
      classification,
      previousMetadata: { schemaVersion: 2, screenshots: [] },
      timestamp,
    }),
    /Screenshot metadata.*schemaVersion/si,
  );
  assert.throws(
    () => serializeScreenshotMetadata({
      schemaVersion: 1,
      screenshots: [...metadata.screenshots].reverse(),
    }),
    /Screenshot metadata.*sorted order/si,
  );
});

test('applying screenshots preserves unchanged bytes and mtime and writes only declared outputs', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-screenshot-apply-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const candidateDir = resolve(root, '.tmp/docs-user-guide/screenshots');
  const committedDir = resolve(root, 'docs/user-guides/screenshots');
  const metadataPath = resolve(root, 'docs/user-guides/screenshots.json');
  await writePngFixture(resolve(candidateDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(committedDir, '01-same.png'), 20, 10, 'same');
  await writePngFixture(resolve(candidateDir, '02-new.png'), 20, 10, 'new');
  const before = await import('node:fs/promises').then(({ stat }) => stat(resolve(committedDir, '01-same.png')));
  const manifest = [
    { filename: '01-same.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'A', description: 'Same' },
    { filename: '02-new.png', viewport: { width: 20, height: 10, deviceScaleFactor: 2 }, page: 'B', description: 'New' },
  ];
  const result = await applyScreenshotChanges({
    manifest,
    candidateDir,
    committedDir,
    metadataPath,
    timestamp: '2026-07-22T02:00:00.000Z',
  });
  const after = await import('node:fs/promises').then(({ stat }) => stat(resolve(committedDir, '01-same.png')));
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(result.metadata.screenshots.length, 2);
  assert.equal((await readFile(metadataPath, 'utf8')).endsWith('\n'), true);
});

test('capture readiness rejects missing locators, zero bounds, and fonts that never load', async () => {
  const page = {
    waitForFunction: async () => {},
    evaluate: async () => {},
  };
  const locator = {
    count: async () => 1,
    waitFor: async () => {},
    scrollIntoViewIfNeeded: async () => {},
    boundingBox: async () => ({ x: 0, y: 0, width: 20, height: 10 }),
  };
  await assert.rejects(
    assertCaptureReady({
      page,
      locator: { ...locator, count: async () => 0 },
      filename: 'missing.png',
      selector: '#missing',
    }),
    /Screenshot capture.*missing.*#missing/si,
  );
  await assert.rejects(
    assertCaptureReady({
      page,
      locator: { ...locator, boundingBox: async () => ({ width: 0, height: 10 }) },
      filename: 'zero.png',
      selector: '#zero',
    }),
    /Screenshot capture.*zero bounds.*#zero/si,
  );
  await assert.rejects(
    assertCaptureReady({
      page: { ...page, waitForFunction: async () => { throw new Error('font timeout'); } },
      locator,
      filename: 'fonts.png',
      selector: '#fonts',
    }),
    /Screenshot capture.*fonts were not ready/si,
  );
});

test('Playwright capture contract is deterministic and writes only to the injected temporary output', async () => {
  const captureSource = await readFile(
    resolve(repoRoot, 'tests/user-guide-screenshots.spec.mjs'),
    'utf8',
  );
  const source = [
    captureSource,
    await readFile(resolve(repoRoot, 'scripts/docs/screenshots.mjs'), 'utf8'),
  ].join('\n');
  for (const required of [
    "locale:'en-AU'",
    "timezoneId:'Australia/Perth'",
    "colorScheme:'light'",
    "reducedMotion:'reduce'",
    'deviceScaleFactor:2',
    "serviceWorkers:'block'",
    '2026-07-22T10:00:00+08:00',
    'DOCS_BASE_URL',
    'DOCS_SCREENSHOT_OUTPUT',
    'document.fonts.ready',
    "document.fonts.status==='loaded'",
    'caret-color:transparent',
    'animation-duration:0s',
    'transition-duration:0s',
    'scroll-behavior:auto',
    'boundingBox()',
  ]) {
    assert.ok(source.includes(required), `missing deterministic capture contract: ${required}`);
  }
  assert.doesNotMatch(source, /waitForTimeout\s*\(/);
  assert.doesNotMatch(captureSource, /docs\/user-guides\/(?:source\/)?screenshots/);
  assert.match(source, /John Smith/);
  assert.match(source, /Jenny Smith/);
  await assert.rejects(
    runScreenshotCapture({
      repoRoot,
      baseUrl: 'http://127.0.0.1:8766',
      outputDir: resolve(repoRoot, 'docs/user-guides/screenshots'),
      run: async () => { throw new Error('must not execute'); },
    }),
    /Screenshot capture.*outside the pipeline temporary directory/si,
  );
});
