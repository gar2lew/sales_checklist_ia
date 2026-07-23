import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { getWriteContract } from './config.mjs';
import { runCommand } from './process.mjs';

const RUNTIME_FILES = new Set([
  'index.html',
  'manifest.webmanifest',
  'service-worker.js',
  'vercel.json',
]);
const RUNTIME_PREFIXES = ['css/', 'js/', 'icons/', 'assets/', 'templates/', 'pdf/'];

function stageError(stage, requirement, remediation, cause) {
  return new Error(
    `${stage} preflight failed: ${requirement}. ${remediation}`,
    cause ? { cause } : undefined,
  );
}

function decodeNullList(value) {
  return value.split('\0').filter(Boolean);
}

async function git(repoRoot, args, run) {
  const result = await run('git', args, { cwd: repoRoot });
  if (result.exitCode !== 0) {
    throw stageError(
      'Git',
      `git ${args.join(' ')} exited with code ${result.exitCode}`,
      'Confirm this checkout is a valid Git worktree and retry.',
      new Error(result.stderr.trim() || 'Git command failed.'),
    );
  }
  return result.stdout;
}

export async function inspectRepository(options = {}) {
  const run = options.run ?? runCommand;
  const requestedRoot = resolve(options.repoRoot ?? process.cwd());
  const repoRoot = resolve((await git(
    requestedRoot,
    ['rev-parse', '--show-toplevel'],
    run,
  )).trim());
  const branchResult = await run(
    'git',
    ['symbolic-ref', '--quiet', '--short', 'HEAD'],
    { cwd: repoRoot },
  );
  const sourceCommit = (await git(repoRoot, ['rev-parse', 'HEAD'], run)).trim();
  const porcelain = await git(
    repoRoot,
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    run,
  );
  return Object.freeze({
    repoRoot,
    branch: branchResult.exitCode === 0 ? branchResult.stdout.trim() : null,
    sourceCommit,
    shortSourceCommit: sourceCommit.slice(0, 12),
    changes: Object.freeze(decodeNullList(porcelain)),
  });
}

export async function assertCleanNamedBranch(context, options = {}) {
  if (!context.branch) {
    throw stageError(
      'Git',
      'detached HEAD is not a named branch',
      'Run `git switch <branch-name>` and retry.',
    );
  }
  if (options.mode !== 'clean' && context.changes.length > 0) {
    throw stageError(
      'Git',
      `working tree is not clean (${context.changes.length} path(s))`,
      'Run `git status --short`, preserve or commit your work, then retry.',
    );
  }
}

function isRuntimeProtected(path) {
  const normalized = path.replaceAll('\\', '/');
  return RUNTIME_FILES.has(normalized)
    || RUNTIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))
    || (!normalized.includes('/') && /\.(?:pdf|png|jpe?g)$/i.test(normalized));
}

export async function hashProtectedFiles(options = {}) {
  const run = options.run ?? runCommand;
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const tracked = decodeNullList(await git(repoRoot, ['ls-files', '-z'], run))
    .filter(isRuntimeProtected)
    .sort();
  const hashes = new Map();
  for (const path of tracked) {
    const content = await readFile(resolve(repoRoot, path));
    hashes.set(path, createHash('sha256').update(content).digest('hex'));
  }
  return hashes;
}

function pathAllowed(path, contract) {
  const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '');
  const allowed = [...contract.committed, ...contract.temporary];
  return allowed.some((entry) => {
    const boundary = entry.replace(/^\.\//, '');
    return boundary.endsWith('/')
      ? normalized.startsWith(boundary)
      : normalized === boundary;
  });
}

export function assertAllowedChanges(options = {}) {
  const contract = options.writeContract ?? getWriteContract(options.mode);
  const unexpected = (options.changedPaths ?? []).filter((path) => !pathAllowed(path, contract));
  if (unexpected.length > 0) {
    throw stageError(
      'Integrity',
      `unexpected changed path(s): ${unexpected.sort().join(', ')}`,
      'Restore or preserve unrelated changes and rerun the documentation command.',
    );
  }
}

export const RUNTIME_PROTECTED_PATHS = Object.freeze({
  files: Object.freeze([...RUNTIME_FILES]),
  prefixes: Object.freeze([...RUNTIME_PREFIXES]),
});
