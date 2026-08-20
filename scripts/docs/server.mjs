import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { once } from 'node:events';

import { SERVER_DEFAULTS } from './config.mjs';
import { runCommand, spawnDirect } from './process.mjs';

export const FINGERPRINT_PATHS = Object.freeze([
  'index.html',
  'css/app.css',
  'js/app.js',
  'manifest.webmanifest',
  'service-worker.js',
]);

function serverError(stage, requirement, remediation, cause) {
  return new Error(
    `${stage} failed: ${requirement}. ${remediation}`,
    cause ? { cause } : undefined,
  );
}

function mergeConfiguration(configuration = {}) {
  return Object.freeze({ ...SERVER_DEFAULTS, ...configuration });
}

function parsePort(value) {
  if (!/^\d+$/.test(value ?? '')) return null;
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
}

export function resolveServerConfiguration(options = {}) {
  const env = options.env ?? process.env;
  const configuration = mergeConfiguration(options.configuration);
  let explicitBaseUrl = null;
  if (env.DOCS_BASE_URL) {
    try {
      const parsed = new URL(env.DOCS_BASE_URL);
      if (
        !['http:', 'https:'].includes(parsed.protocol)
        || parsed.username
        || parsed.password
        || parsed.pathname !== '/'
        || parsed.search
        || parsed.hash
        || !parsed.hostname
      ) {
        throw new Error('URL must be an HTTP(S) origin without credentials, path, query, or fragment.');
      }
      explicitBaseUrl = new URL(parsed.origin);
    } catch (cause) {
      throw serverError(
        'Server configuration',
        `DOCS_BASE_URL is invalid: ${env.DOCS_BASE_URL}`,
        'Provide a complete local HTTP or HTTPS origin such as http://127.0.0.1:8766.',
        cause,
      );
    }
  }
  let explicitPort = null;
  if (!explicitBaseUrl && env.DOCS_PORT !== undefined && env.DOCS_PORT !== '') {
    explicitPort = parsePort(env.DOCS_PORT);
    if (explicitPort === null) {
      throw serverError(
        'Server configuration',
        `DOCS_PORT is invalid: ${env.DOCS_PORT}`,
        'Use an integer from 1024 through 65535.',
      );
    }
  }
  const ports = explicitPort
    ? [explicitPort]
    : Array.from(
      { length: configuration.lastPort - configuration.firstPort + 1 },
      (_, index) => configuration.firstPort + index,
    );
  return Object.freeze({ ...configuration, explicitBaseUrl, explicitPort, ports: Object.freeze(ports) });
}

export async function buildLocalFingerprint(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const read = options.readFile ?? readFile;
  const result = new Map();
  for (const path of FINGERPRINT_PATHS) {
    const bytes = await read(resolve(repoRoot, path));
    result.set(path, createHash('sha256').update(bytes).digest('hex'));
  }
  return result;
}

export async function fetchBounded(url, options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const maxBytes = options.maxBytes ?? SERVER_DEFAULTS.maxResponseBytes;
  const timeoutMs = options.requestTimeoutMs ?? SERVER_DEFAULTS.requestTimeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs} ms`)), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: options.redirect ?? SERVER_DEFAULTS.redirect,
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      const error = serverError(
        'HTTP preflight',
        `redirect ${response.status} is not permitted for ${url}`,
        'Serve fingerprint files directly without redirects.',
      );
      error.status = response.status;
      throw error;
    }
    if (response.status !== 200) {
      const error = serverError(
        'HTTP preflight',
        `HTTP ${response.status} returned for ${url}`,
        'Confirm the selected server exposes the current checkout.',
      );
      error.status = response.status;
      throw error;
    }
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw serverError(
        'HTTP preflight',
        `response for ${url} exceeds ${maxBytes} bytes`,
        'Reduce the served asset size or verify the selected server.',
      );
    }
    if (!response.body) return Buffer.alloc(0);
    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw serverError(
          'HTTP preflight',
          `response for ${url} exceeds ${maxBytes} bytes`,
          'Reduce the served asset size or verify the selected server.',
        );
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks);
  } catch (cause) {
    if (cause?.message?.includes('HTTP preflight')) throw cause;
    throw serverError(
      'HTTP preflight',
      `request failed for ${url}`,
      'Confirm the server is reachable and retry.',
      cause,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function compareServerFingerprint(options = {}) {
  const baseUrl = new URL(options.baseUrl);
  const localFingerprint = options.localFingerprint;
  const cacheToken = options.cacheToken ?? randomBytes(8).toString('hex');
  const remoteHashes = new Map();
  const missing = [];
  const mismatched = [];
  const errors = [];
  for (const path of FINGERPRINT_PATHS) {
    const url = new URL(path, baseUrl);
    url.searchParams.set('docs_fingerprint', cacheToken);
    try {
      const bytes = await fetchBounded(url, options);
      const hash = createHash('sha256').update(bytes).digest('hex');
      remoteHashes.set(path, hash);
      if (hash !== localFingerprint.get(path)) mismatched.push(path);
    } catch (error) {
      if (error.status === 404) missing.push(path);
      else errors.push({ path, error });
    }
  }
  return Object.freeze({
    match: missing.length === 0 && mismatched.length === 0 && errors.length === 0,
    missing: Object.freeze(missing),
    mismatched: Object.freeze(mismatched),
    errors: Object.freeze(errors),
    remoteHashes,
  });
}

async function defaultPortAvailable(port, host = SERVER_DEFAULTS.host) {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = createServer();
    server.unref();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolvePromise(false);
      else rejectPromise(error);
    });
    server.listen({ port, host, exclusive: true }, () => {
      server.close(() => resolvePromise(true));
    });
  });
}

function mismatchSummary(result) {
  const parts = [];
  if (result.missing?.length) parts.push(`missing: ${result.missing.join(', ')}`);
  if (result.mismatched?.length) parts.push(`mismatched: ${result.mismatched.join(', ')}`);
  if (result.errors?.length) {
    parts.push(`errors: ${result.errors.map(({ path, error }) => `${path} (${error.message})`).join(', ')}`);
  }
  return parts.join('; ') || 'unknown fingerprint failure';
}

function boundedChildOutput(child, maxBytes = 64 * 1024) {
  const state = { stdout: '', stderr: '' };
  for (const streamName of ['stdout', 'stderr']) {
    child[streamName]?.on?.('data', (chunk) => {
      state[streamName] = `${state[streamName]}${chunk}`.slice(-maxBytes);
    });
  }
  return () => ({ ...state });
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function defaultReadinessProbe(options) {
  await fetchBounded(new URL('/', options.baseUrl), options);
  return compareServerFingerprint(options);
}

export async function waitForReady(options = {}) {
  const timeoutMs = options.timeoutMs ?? SERVER_DEFAULTS.startupTimeoutMs;
  const pollIntervalMs = options.pollIntervalMs ?? SERVER_DEFAULTS.pollIntervalMs;
  const now = options.now ?? Date.now;
  const wait = options.delay ?? delay;
  const probe = options.probe ?? (() => defaultReadinessProbe(options));
  const started = now();
  let lastProblem = 'no readiness probe completed';
  while (now() - started <= timeoutMs) {
    if (options.child?.exitCode !== null && options.child?.exitCode !== undefined) {
      const output = options.getOutput?.() ?? {};
      throw serverError(
        'Server readiness',
        `pipeline-owned server exited early with code ${options.child.exitCode}`,
        `Review bounded server output: ${output.stderr || output.stdout || '(none)'}`,
      );
    }
    try {
      const result = await probe();
      if (result.match) return result;
      lastProblem = mismatchSummary(result);
    } catch (error) {
      lastProblem = error.message;
    }
    await wait(pollIntervalMs);
  }
  const output = options.getOutput?.() ?? {};
  throw serverError(
    'Server readiness',
    `${options.baseUrl} was not ready within ${timeoutMs} ms; last result: ${lastProblem}`,
    `Review bounded server output: ${output.stderr || output.stdout || '(none)'}`,
  );
}

async function waitForChildExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null && child.exitCode !== undefined) return true;
  return Promise.race([
    once(child, 'exit').then(() => true),
    delay(timeoutMs).then(() => false),
  ]);
}

export async function stopOwnedServer(options = {}) {
  const child = options.child;
  if (!child || child.exitCode !== null && child.exitCode !== undefined) return;
  const waitForExit = options.waitForExit ?? waitForChildExit;
  if ((options.platform ?? process.platform) === 'win32') {
    const run = options.run ?? runCommand;
    const result = await run(
      'taskkill.exe',
      ['/PID', String(child.pid), '/T', '/F'],
      { timeoutMs: 10_000 },
    );
    if (result.exitCode !== 0 && child.exitCode === null) {
      throw serverError(
        'Server cleanup',
        `taskkill failed for owned PID ${child.pid}`,
        'Stop only the recorded pipeline-owned process tree and retry cleanup.',
        new Error(result.stderr.trim() || 'taskkill failed.'),
      );
    }
  } else {
    child.kill('SIGTERM');
  }
  if (!await waitForExit(child, 5_000)) {
    if ((options.platform ?? process.platform) !== 'win32') child.kill('SIGKILL');
    if (!await waitForExit(child, 1_000)) {
      throw serverError(
        'Server cleanup',
        `owned PID ${child.pid} did not exit`,
        'Terminate only that recorded process before retrying.',
      );
    }
  }
}

function makeLease(details, stop) {
  let cleaned = false;
  return Object.freeze({
    ...details,
    cleanup: async () => {
      if (cleaned) return;
      cleaned = true;
      if (details.disposition === 'pipeline-owned') await stop();
    },
  });
}

export async function runWithServerLease(lease, operation) {
  let primaryError;
  try {
    return await operation(lease);
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await lease.cleanup();
    } catch (cleanupError) {
      if (primaryError) primaryError.cleanupError = cleanupError;
      else throw cleanupError;
    }
  }
}

export async function selectDocumentationServer(options = {}) {
  const configuration = resolveServerConfiguration({
    env: options.env,
    configuration: options.configuration,
  });
  const localFingerprint = options.localFingerprint
    ?? await buildLocalFingerprint({ repoRoot: options.repoRoot });
  const compareFingerprint = options.compareFingerprint
    ?? ((baseUrl) => compareServerFingerprint({
      baseUrl,
      localFingerprint,
      fetchImpl: options.fetchImpl,
      requestTimeoutMs: configuration.requestTimeoutMs,
      maxBytes: configuration.maxResponseBytes,
    }));
  if (configuration.explicitBaseUrl) {
    const result = await compareFingerprint(configuration.explicitBaseUrl);
    if (!result.match) {
      throw serverError(
        'Server selection',
        `DOCS_BASE_URL serves a different checkout (${mismatchSummary(result)})`,
        'Point DOCS_BASE_URL at this checkout or unset it.',
      );
    }
    return makeLease({
      baseUrl: configuration.explicitBaseUrl,
      port: Number(configuration.explicitBaseUrl.port)
        || (configuration.explicitBaseUrl.protocol === 'https:' ? 443 : 80),
      disposition: 'reused',
      child: null,
      fingerprint: result,
    }, async () => {});
  }

  const isPortAvailable = options.isPortAvailable ?? defaultPortAvailable;
  let selectedPort = null;
  for (const port of configuration.ports) {
    const available = await isPortAvailable(port, configuration.host);
    if (available) {
      if (selectedPort === null) selectedPort = port;
      if (configuration.explicitPort) break;
      continue;
    }
    const baseUrl = new URL(`http://${configuration.host}:${port}`);
    const result = await compareFingerprint(baseUrl);
    if (result.match) {
      return makeLease({
        baseUrl,
        port,
        disposition: 'reused',
        child: null,
        fingerprint: result,
      }, async () => {});
    }
    if (configuration.explicitPort) {
      throw serverError(
        'Server selection',
        `DOCS_PORT ${port} serves a different checkout (${mismatchSummary(result)})`,
        'Choose a free port or stop the unrelated server yourself.',
      );
    }
  }
  if (selectedPort === null) {
    throw serverError(
      'Server selection',
      `no port is available in ${configuration.ports.join(', ')}`,
      `Free one port in the finite range ${configuration.firstPort}-${configuration.lastPort}.`,
    );
  }

  const python = options.python;
  if (!python?.executable) {
    throw serverError(
      'Server startup',
      'the validated Phase 2 Python command was not supplied',
      'Run tooling preflight and pass its selected Python command.',
    );
  }
  const spawn = options.spawn ?? spawnDirect;
  const args = [
    ...(python.prefixArgs ?? []),
    '-m',
    'http.server',
    String(selectedPort),
    '--bind',
    configuration.host,
  ];
  const child = spawn(python.executable, args, {
    cwd: options.repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  const getOutput = boundedChildOutput(child);
  const baseUrl = new URL(`http://${configuration.host}:${selectedPort}`);
  const readiness = options.waitForReady ?? waitForReady;
  const stop = () => (options.stopOwnedServer ?? stopOwnedServer)({
    child,
    platform: options.platform,
    run: options.run,
  });
  try {
    const fingerprint = await readiness({
      baseUrl,
      localFingerprint,
      child,
      getOutput,
      fetchImpl: options.fetchImpl,
      timeoutMs: configuration.startupTimeoutMs,
      pollIntervalMs: configuration.pollIntervalMs,
      requestTimeoutMs: configuration.requestTimeoutMs,
      maxBytes: configuration.maxResponseBytes,
    });
    return makeLease({
      baseUrl,
      port: selectedPort,
      disposition: 'pipeline-owned',
      child,
      fingerprint,
      getOutput,
    }, stop);
  } catch (error) {
    try {
      await stop();
    } catch (cleanupError) {
      error.cleanupError = cleanupError;
    }
    throw error;
  }
}
