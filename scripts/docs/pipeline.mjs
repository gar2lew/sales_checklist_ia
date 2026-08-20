import {
  lstat,
  realpath,
  rm,
} from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const MODES = Object.freeze({
  generate: Object.freeze([
    'preflight', 'tooling', 'server', 'screenshots', 'metadata',
    'documents', 'validation', 'report', 'integrity',
  ]),
  screenshots: Object.freeze(['preflight', 'tooling', 'server', 'screenshots', 'integrity']),
  validate: Object.freeze(['preflight', 'tooling', 'validation', 'integrity']),
});

function stageValue(value) {
  if (value && typeof value === 'object') {
    return Object.freeze({ status: value.status ?? 'PASS', ...value });
  }
  return Object.freeze({ status: 'PASS', value });
}

function overallStatus(stages) {
  const statuses = Object.values(stages).map(({ status }) => status);
  if (statuses.includes('BLOCKED')) return 'BLOCKED';
  if (statuses.includes('FAIL')) return 'FAIL';
  if (statuses.includes('WARN')) return 'WARN';
  return 'PASS';
}

export async function runPipeline(mode, dependencies = {}) {
  const sequence = MODES[mode];
  if (!sequence) throw new Error(`Unsupported pipeline mode: ${mode}`);
  const stages = Object.fromEntries(sequence.map((stage) => [stage, { status: 'NOT RUN' }]));
  stages.cleanup = { status: 'NOT RUN' };
  const result = { mode, status: 'NOT RUN', stages };
  let primaryError;
  let serverLease;
  let completed = false;
  let cleanupPromise;
  const cleanupResources = () => {
    if (cleanupPromise) return cleanupPromise;
    cleanupPromise = (async () => {
      const errors = [];
      if (serverLease?.cleanup) {
        try {
          await serverLease.cleanup();
        } catch (error) {
          errors.push(error);
        }
      }
      try {
        stages.cleanup = stageValue(await dependencies.cleanup?.(
          Object.freeze({ mode, stages: Object.freeze({ ...stages }) }),
        ) ?? { status: 'PASS' });
      } catch (error) {
        stages.cleanup = { status: 'FAIL', message: error.message };
        errors.push(error);
      }
      return errors;
    })();
    return cleanupPromise;
  };
  const signalSource = dependencies.signalSource;
  const signalHandlers = new Map();
  if (signalSource?.once && signalSource?.removeListener) {
    for (const signal of ['SIGINT', 'SIGTERM']) {
      const handler = async () => {
        await cleanupResources();
        signalSource.removeListener(signal, handler);
        if (typeof signalSource.kill === 'function') signalSource.kill(signal);
      };
      signalHandlers.set(signal, handler);
      signalSource.once(signal, handler);
    }
  }
  try {
    for (const stage of sequence) {
      const handler = dependencies[stage];
      if (typeof handler !== 'function') throw new Error(`Missing pipeline stage handler: ${stage}`);
      const value = await handler(Object.freeze({ mode, stages: Object.freeze({ ...stages }) }));
      stages[stage] = stageValue(value);
      dependencies.log?.(stage, stages[stage].status);
      if (stage === 'server') serverLease = value;
      if (stages[stage].status === 'FAIL' || stages[stage].status === 'BLOCKED') {
        const error = new Error(`${stage} returned ${stages[stage].status}`);
        error.stage = stage;
        throw error;
      }
    }
    result.status = overallStatus(stages);
    completed = true;
  } catch (error) {
    primaryError = error;
    const failedStage = sequence.find((stage) => stages[stage].status === 'NOT RUN');
    if (failedStage) stages[failedStage] = { status: 'FAIL', message: error.message };
    result.status = error.status === 'BLOCKED' ? 'BLOCKED' : 'FAIL';
    throw error;
  } finally {
    for (const [signal, handler] of signalHandlers) {
      signalSource.removeListener(signal, handler);
    }
    const cleanupErrors = await cleanupResources();
    dependencies.log?.('cleanup', stages.cleanup.status);
    if (primaryError) {
      primaryError.cleanupErrors = cleanupErrors;
      primaryError.pipelineResult = Object.freeze({ ...result, stages: Object.freeze({ ...stages }) });
    } else if (cleanupErrors.length) {
      const error = cleanupErrors[0];
      error.cleanupErrors = cleanupErrors.slice(1);
      error.pipelineResult = Object.freeze({ ...result, status: 'FAIL', stages: Object.freeze({ ...stages }) });
      throw error;
    }
  }
  if (completed) {
    dependencies.log?.('result', result.status);
    return Object.freeze({ ...result, stages: Object.freeze({ ...stages }) });
  }
  throw new Error('Pipeline did not complete.');
}

async function assertNoLinksBetween(root, target) {
  const pathFromRoot = relative(root, target);
  let current = root;
  for (const segment of pathFromRoot.split(/[\\/]/).filter(Boolean)) {
    current = resolve(current, segment);
    try {
      const details = await lstat(current);
      if (details.isSymbolicLink()) {
        throw new Error(`Cleanup target contains a link or reparse point: ${current}`);
      }
    } catch (cause) {
      if (cause.code === 'ENOENT') return;
      throw cause;
    }
  }
}

export async function cleanDocumentationTemp(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const expected = resolve(repoRoot, '.tmp/docs-user-guide');
  const target = resolve(options.target ?? expected);
  if (target !== expected) {
    throw new Error(`Cleanup is restricted to the exact pipeline-owned path: ${expected}`);
  }
  const resolvedRoot = await realpath(repoRoot);
  if (relative(resolvedRoot, target).startsWith('..')) {
    throw new Error('Cleanup target escapes the repository.');
  }
  await assertNoLinksBetween(resolvedRoot, target);
  try {
    await lstat(target);
  } catch (cause) {
    if (cause.code === 'ENOENT') return Object.freeze({ status: 'MISSING', path: target });
    throw cause;
  }
  await rm(target, { recursive: true, force: false });
  return Object.freeze({ status: 'REMOVED', path: target });
}
