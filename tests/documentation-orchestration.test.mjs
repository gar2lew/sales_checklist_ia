import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  cleanDocumentationTemp,
  runPipeline,
} from '../scripts/docs/pipeline.mjs';

function stages(overrides = {}) {
  const calls = [];
  const handler = (name, value = { status: 'PASS' }) => async (context) => {
    calls.push(name);
    return typeof value === 'function' ? value(context) : value;
  };
  return {
    calls,
    dependencies: {
      preflight: handler('preflight', { status: 'PASS', source: { branch: 'feature', commit: 'a'.repeat(40) } }),
      tooling: handler('tooling', { status: 'PASS' }),
      server: handler('server', { status: 'PASS', disposition: 'pipeline-owned', cleanup: handler('server-cleanup') }),
      screenshots: handler('screenshots', { status: 'PASS', classification: { UNCHANGED: Array(9).fill({}), UPDATED: [], NEW: [], REMOVED: [] } }),
      metadata: handler('metadata', { status: 'UNCHANGED' }),
      documents: handler('documents', { status: 'PASS' }),
      validation: handler('validation', { status: 'WARN', findings: [{ code: 'VISUAL_EDGE' }] }),
      report: handler('report', { status: 'UPDATED' }),
      integrity: handler('integrity', { status: 'PASS' }),
      cleanup: handler('cleanup', { status: 'PASS' }),
      ...overrides,
    },
  };
}

test('generate pipeline preserves stage order, facts, WARN, and cleanup', async () => {
  const fixture = stages();
  const result = await runPipeline('generate', fixture.dependencies);
  assert.deepEqual(fixture.calls, [
    'preflight', 'tooling', 'server', 'screenshots', 'metadata',
    'documents', 'validation', 'report', 'integrity', 'server-cleanup', 'cleanup',
  ]);
  assert.equal(result.status, 'WARN');
  assert.equal(result.stages.validation.status, 'WARN');
  assert.equal(result.stages.report.status, 'UPDATED');
  assert.equal(result.stages.cleanup.status, 'PASS');
  assert.equal(result.stages.server.status, 'PASS');
});

test('primary failure stops dependent stages, marks NOT RUN, and cleanup never masks it', async () => {
  const primary = new Error('capture failed');
  const cleanup = new Error('cleanup failed');
  const fixture = stages({
    screenshots: async () => { fixture.calls.push('screenshots'); throw primary; },
    cleanup: async () => { fixture.calls.push('cleanup'); throw cleanup; },
  });
  await assert.rejects(
    runPipeline('generate', fixture.dependencies),
    (error) => {
      assert.equal(error, primary);
      assert.equal(error.cleanupErrors[0], cleanup);
      assert.equal(error.pipelineResult.stages.metadata.status, 'NOT RUN');
      return true;
    },
  );
  assert.deepEqual(fixture.calls, ['preflight', 'tooling', 'server', 'screenshots', 'server-cleanup', 'cleanup']);
});

test('capture and validate run only their approved stage scopes', async () => {
  const capture = stages();
  await runPipeline('screenshots', capture.dependencies);
  assert.deepEqual(capture.calls, ['preflight', 'tooling', 'server', 'screenshots', 'integrity', 'server-cleanup', 'cleanup']);

  const validate = stages();
  const result = await runPipeline('validate', validate.dependencies);
  assert.deepEqual(validate.calls, ['preflight', 'tooling', 'validation', 'integrity', 'cleanup']);
  assert.equal(result.status, 'WARN');
});

test('cleanup removes only the exact safe pipeline directory and is idempotent on dirty trees', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-clean-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const owned = resolve(root, '.tmp/docs-user-guide');
  const unrelated = resolve(root, '.tmp/other-tool');
  await mkdir(owned, { recursive: true });
  await mkdir(unrelated, { recursive: true });
  await writeFile(resolve(owned, 'candidate.tmp'), 'owned');
  await writeFile(resolve(unrelated, 'keep.tmp'), 'keep');
  assert.equal((await cleanDocumentationTemp({ repoRoot: root })).status, 'REMOVED');
  await assert.rejects(stat(owned), /ENOENT/);
  assert.equal((await stat(unrelated)).isDirectory(), true);
  assert.equal((await cleanDocumentationTemp({ repoRoot: root })).status, 'MISSING');
});

test('cleanup rejects traversal and symlink/reparse targets', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-clean-safety-'));
  const external = await mkdtemp(resolve(tmpdir(), 'docs-clean-external-'));
  t.after(() => Promise.all([
    rm(root, { recursive: true, force: true }),
    rm(external, { recursive: true, force: true }),
  ]));
  await assert.rejects(cleanDocumentationTemp({ repoRoot: root, target: resolve(root, '..', 'escape') }), /exact pipeline-owned path/i);
  await mkdir(resolve(root, '.tmp'), { recursive: true });
  try {
    await symlink(external, resolve(root, '.tmp/docs-user-guide'), 'junction');
  } catch (cause) {
    if (cause.code === 'EPERM') return;
    throw cause;
  }
  await assert.rejects(cleanDocumentationTemp({ repoRoot: root }), /link|reparse/i);
  assert.equal((await stat(external)).isDirectory(), true);
});

test('signal cleanup is idempotent and terminates with the received signal', async () => {
  const signalSource = new EventEmitter();
  const killed = [];
  signalSource.kill = (signal) => killed.push(signal);
  let release;
  let cleanupCount = 0;
  const waiting = new Promise((resolveWaiting) => { release = resolveWaiting; });
  const execution = runPipeline('validate', {
    preflight: async () => {
      await waiting;
      return { status: 'PASS' };
    },
    tooling: async () => ({ status: 'PASS' }),
    validation: async () => ({ status: 'PASS' }),
    integrity: async () => ({ status: 'PASS' }),
    cleanup: async () => {
      cleanupCount += 1;
      return { status: 'PASS' };
    },
    signalSource,
  });

  signalSource.emit('SIGINT');
  await new Promise((resolveImmediate) => setImmediate(resolveImmediate));
  release();
  await execution;

  assert.equal(cleanupCount, 1);
  assert.deepEqual(killed, ['SIGINT']);
  assert.equal(signalSource.listenerCount('SIGINT'), 0);
  assert.equal(signalSource.listenerCount('SIGTERM'), 0);
});
