import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  FINGERPRINT_PATHS,
  buildLocalFingerprint,
  selectDocumentationServer,
  waitForReady,
} from '../scripts/docs/server.mjs';

async function createFingerprintFixture(t) {
  const directory = await mkdtemp(resolve(tmpdir(), 'docs-server-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = new Map();
  for (const path of FINGERPRINT_PATHS) {
    const bytes = Buffer.from(`content:${path}`);
    files.set(`/${path}`, bytes);
    await mkdir(resolve(directory, path, '..'), { recursive: true });
    await writeFile(resolve(directory, path), bytes);
  }
  return { directory, files };
}

async function listen(t, handler) {
  const server = createServer(handler);
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  t.after(() => new Promise((resolvePromise) => server.close(resolvePromise)));
  return {
    server,
    port: server.address().port,
    baseUrl: new URL(`http://127.0.0.1:${server.address().port}`),
  };
}

test('matching existing server is reused and cleanup preserves it', async (t) => {
  const fixture = await createFingerprintFixture(t);
  const existing = await listen(t, (request, response) => {
    const bytes = fixture.files.get(new URL(request.url, 'http://localhost').pathname);
    response.writeHead(bytes ? 200 : 404);
    response.end(bytes ?? 'missing');
  });
  const localFingerprint = await buildLocalFingerprint({ repoRoot: fixture.directory });
  const lease = await selectDocumentationServer({
    repoRoot: fixture.directory,
    python: { executable: 'unused', prefixArgs: [] },
    env: { DOCS_BASE_URL: existing.baseUrl.href },
    localFingerprint,
  });
  assert.equal(lease.disposition, 'reused');
  assert.equal(lease.baseUrl.href, existing.baseUrl.href);
  await lease.cleanup();
  await lease.cleanup();
  assert.equal(existing.server.listening, true);
});

test('explicit mismatched server is preserved and rejected', async (t) => {
  const fixture = await createFingerprintFixture(t);
  const existing = await listen(t, (_request, response) => {
    response.writeHead(200);
    response.end('different checkout');
  });
  const localFingerprint = await buildLocalFingerprint({ repoRoot: fixture.directory });
  await assert.rejects(
    selectDocumentationServer({
      repoRoot: fixture.directory,
      python: { executable: 'unused', prefixArgs: [] },
      env: { DOCS_BASE_URL: existing.baseUrl.href },
      localFingerprint,
    }),
    /different checkout.*mismatched/si,
  );
  assert.equal(existing.server.listening, true);
});

test('default range skips occupied mismatch and selects the first free port deterministically', async () => {
  const calls = [];
  let stopCalls = 0;
  const fakeChild = { pid: 1234, exitCode: null, stdout: null, stderr: null, once: () => {} };
  const lease = await selectDocumentationServer({
    repoRoot: 'C:\\fixture',
    python: { executable: 'python', prefixArgs: [] },
    env: {},
    configuration: {
      firstPort: 8766,
      lastPort: 8768,
      preferredPort: 8766,
      startupTimeoutMs: 10,
      pollIntervalMs: 1,
    },
    localFingerprint: new Map(FINGERPRINT_PATHS.map((path) => [path, 'hash'])),
    isPortAvailable: async (port) => port !== 8766,
    compareFingerprint: async () => ({ match: false, missing: [], mismatched: ['index.html'] }),
    spawn: (executable, args, options) => {
      calls.push([executable, args, options]);
      return fakeChild;
    },
    waitForReady: async () => ({ match: true }),
    stopOwnedServer: async () => {
      stopCalls += 1;
      fakeChild.exitCode = 0;
    },
  });
  assert.equal(lease.port, 8767);
  assert.equal(lease.disposition, 'pipeline-owned');
  assert.deepEqual(calls[0][1], ['-m', 'http.server', '8767', '--bind', '127.0.0.1']);
  assert.equal(calls[0][2].cwd, 'C:\\fixture');
  assert.equal(calls[0][2].shell, false);
  await lease.cleanup();
  await lease.cleanup();
  assert.equal(stopCalls, 1);
});

test('unreachable occupied candidate is preserved and skipped for an owned server', async () => {
  const fakeChild = { pid: 1234, exitCode: null, stdout: null, stderr: null };
  const compared = [];
  const lease = await selectDocumentationServer({
    repoRoot: 'C:\\fixture',
    python: { executable: 'py', prefixArgs: ['-3'] },
    env: {},
    configuration: { firstPort: 8766, lastPort: 8767, preferredPort: 8766 },
    localFingerprint: new Map(FINGERPRINT_PATHS.map((path) => [path, 'hash'])),
    isPortAvailable: async (port) => port === 8767,
    compareFingerprint: async (baseUrl) => {
      compared.push(baseUrl.port);
      return {
        match: false,
        missing: [],
        mismatched: [],
        errors: [{ path: 'index.html', error: new Error('connection refused') }],
      };
    },
    spawn: (_executable, args) => {
      assert.deepEqual(args, ['-3', '-m', 'http.server', '8767', '--bind', '127.0.0.1']);
      return fakeChild;
    },
    waitForReady: async () => ({ match: true }),
    stopOwnedServer: async () => { fakeChild.exitCode = 0; },
  });
  assert.deepEqual(compared, ['8766']);
  assert.equal(lease.port, 8767);
  await lease.cleanup();
});

test('owned server is stopped when readiness fails', async () => {
  const fakeChild = { pid: 2468, exitCode: null, stdout: null, stderr: null };
  let stops = 0;
  const readinessError = new Error('readiness failed');
  await assert.rejects(
    selectDocumentationServer({
      repoRoot: 'C:\\fixture',
      python: { executable: 'python', prefixArgs: [] },
      env: { DOCS_PORT: '9000' },
      localFingerprint: new Map(FINGERPRINT_PATHS.map((path) => [path, 'hash'])),
      isPortAvailable: async () => true,
      spawn: () => fakeChild,
      waitForReady: async () => { throw readinessError; },
      stopOwnedServer: async () => {
        stops += 1;
        fakeChild.exitCode = 0;
      },
    }),
    (error) => error === readinessError,
  );
  assert.equal(stops, 1);
});

test('finite port exhaustion fails clearly without spawning', async () => {
  await assert.rejects(
    selectDocumentationServer({
      repoRoot: 'C:\\fixture',
      python: { executable: 'python', prefixArgs: [] },
      env: {},
      configuration: { firstPort: 8766, lastPort: 8767, preferredPort: 8766 },
      localFingerprint: new Map(FINGERPRINT_PATHS.map((path) => [path, 'hash'])),
      isPortAvailable: async () => false,
      compareFingerprint: async () => ({ match: false, missing: [], mismatched: ['index.html'] }),
      spawn: () => { throw new Error('must not spawn'); },
    }),
    /Server selection.*8766.*8767/si,
  );
});

test('readiness polls sequentially until HTTP and fingerprint match and reports timeout diagnostics', async () => {
  let now = 0;
  let probes = 0;
  const result = await waitForReady({
    baseUrl: new URL('http://127.0.0.1:8766'),
    timeoutMs: 100,
    pollIntervalMs: 10,
    now: () => now,
    delay: async (milliseconds) => { now += milliseconds; },
    probe: async () => {
      probes += 1;
      if (probes < 3) throw new Error('HTTP 503');
      return { match: true, missing: [], mismatched: [] };
    },
  });
  assert.equal(result.match, true);
  assert.equal(probes, 3);
  assert.equal(now, 20);

  now = 0;
  await assert.rejects(
    waitForReady({
      baseUrl: new URL('http://127.0.0.1:8766'),
      timeoutMs: 20,
      pollIntervalMs: 10,
      now: () => now,
      delay: async (milliseconds) => { now += milliseconds; },
      probe: async () => ({ match: false, missing: ['service-worker.js'], mismatched: [] }),
      child: { exitCode: null },
      getOutput: () => ({ stdout: 'bounded out', stderr: '' }),
    }),
    /readiness.*127\.0\.0\.1:8766.*20 ms.*service-worker\.js.*bounded out/si,
  );
});

test('real readiness requires delayed root HTTP 200 and complete fingerprint equality', async (t) => {
  const fixture = await createFingerprintFixture(t);
  let rootRequests = 0;
  const delayed = await listen(t, (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/') {
      rootRequests += 1;
      if (rootRequests < 2) {
        response.writeHead(503);
        response.end('starting');
        return;
      }
    }
    const bytes = pathname === '/' ? fixture.files.get('/index.html') : fixture.files.get(pathname);
    response.writeHead(bytes ? 200 : 404);
    response.end(bytes ?? 'missing');
  });
  const localFingerprint = await buildLocalFingerprint({ repoRoot: fixture.directory });
  const result = await waitForReady({
    baseUrl: delayed.baseUrl,
    localFingerprint,
    timeoutMs: 2_000,
    pollIntervalMs: 10,
    requestTimeoutMs: 500,
  });
  assert.equal(result.match, true);
  assert.ok(rootRequests >= 2);
});

test('early owned child exit fails readiness clearly', async () => {
  await assert.rejects(
    waitForReady({
      baseUrl: new URL('http://127.0.0.1:8766'),
      timeoutMs: 20,
      pollIntervalMs: 1,
      child: { exitCode: 2 },
      getOutput: () => ({ stdout: '', stderr: 'address already in use' }),
      probe: async () => { throw new Error('connection refused'); },
    }),
    /exited.*code 2.*address already in use/si,
  );
});
