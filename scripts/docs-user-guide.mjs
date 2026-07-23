import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  COMMANDS,
  assertDocumentationMode,
  createRunPaths,
  getWriteContract,
} from './docs/config.mjs';
import {
  assertCleanNamedBranch,
  inspectRepository,
} from './docs/git-integrity.mjs';
import { runMetadataUpdate } from './docs/metadata.mjs';

const foundationOnlyHandler = async ({ mode }) => {
  throw new Error(
    `Documentation mode "${mode}" is wired but is not available until its approved implementation phase.`,
  );
};

const metadataOnlyGenerateHandler = async ({
  paths,
  repositoryInspector,
  assertRepository,
  metadataUpdate,
  clock,
}) => {
  const repository = await repositoryInspector({ repoRoot: paths.repoRoot });
  await assertRepository(repository, { mode: 'generate' });
  return metadataUpdate({
    repoRoot: paths.repoRoot,
    repository,
    clock,
  });
};

const defaultHandlers = Object.freeze({
  generate: metadataOnlyGenerateHandler,
  screenshots: foundationOnlyHandler,
  validate: foundationOnlyHandler,
  clean: foundationOnlyHandler,
});

export async function runDocumentationCommand(mode, dependencies = {}) {
  assertDocumentationMode(mode);
  const repoRoot = resolve(dependencies.repoRoot ?? resolve(import.meta.dirname, '..'));
  const handlers = dependencies.handlers ?? defaultHandlers;
  const handler = handlers[mode];
  if (typeof handler !== 'function') {
    throw new Error(`No documentation handler is configured for mode: ${mode}`);
  }
  return handler(Object.freeze({
    mode,
    paths: createRunPaths(repoRoot),
    writeContract: getWriteContract(mode),
    repositoryInspector: dependencies.repositoryInspector ?? inspectRepository,
    assertRepository: dependencies.assertRepository ?? assertCleanNamedBranch,
    metadataUpdate: dependencies.metadataUpdate ?? runMetadataUpdate,
    clock: dependencies.clock ?? (() => new Date()),
  }));
}

async function main() {
  const mode = process.argv[2];
  try {
    await runDocumentationCommand(mode);
  } catch (error) {
    process.stderr.write(`[docs:${mode ?? 'unknown'}] ${error.message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
