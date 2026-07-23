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
import { generateDocuments } from './docs/documents.mjs';
import { runMetadataUpdate } from './docs/metadata.mjs';
import {
  discoverDocumentGenerationTooling,
  discoverValidationTooling,
} from './docs/tooling.mjs';
import { validateGuide } from './docs/validation.mjs';

const foundationOnlyHandler = async ({ mode }) => {
  throw new Error(
    `Documentation mode "${mode}" is wired but is not available until its approved implementation phase.`,
  );
};

const documentGenerateHandler = async ({
  paths,
  repositoryInspector,
  assertRepository,
  metadataUpdate,
  generationTooling,
  documentGeneration,
  clock,
}) => {
  const repository = await repositoryInspector({ repoRoot: paths.repoRoot });
  await assertRepository(repository, { mode: 'generate' });
  await metadataUpdate({
    repoRoot: paths.repoRoot,
    repository,
    clock,
  });
  const tooling = await generationTooling({ repoRoot: paths.repoRoot });
  return documentGeneration({
    repoRoot: paths.repoRoot,
    tooling,
  });
};

const validationHandler = async ({
  paths,
  repositoryInspector,
  assertRepository,
  validationTooling,
  guideValidation,
}) => {
  const repository = await repositoryInspector({ repoRoot: paths.repoRoot });
  await assertRepository(repository, { mode: 'validate' });
  const tooling = await validationTooling({ repoRoot: paths.repoRoot });
  return guideValidation({ repoRoot: paths.repoRoot, tooling });
};

const defaultHandlers = Object.freeze({
  generate: documentGenerateHandler,
  screenshots: foundationOnlyHandler,
  validate: validationHandler,
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
    generationTooling: dependencies.generationTooling ?? discoverDocumentGenerationTooling,
    documentGeneration: dependencies.documentGeneration ?? generateDocuments,
    validationTooling: dependencies.validationTooling ?? discoverValidationTooling,
    guideValidation: dependencies.guideValidation ?? validateGuide,
    clock: dependencies.clock ?? (() => new Date()),
  }));
}

async function main() {
  const mode = process.argv[2];
  try {
    const result = await runDocumentationCommand(mode);
    if (mode === 'validate') {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (result.status === 'FAIL') process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`[docs:${mode ?? 'unknown'}] ${error.message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
