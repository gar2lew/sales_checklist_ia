import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  COMMANDS,
  assertDocumentationMode,
  createRunPaths,
  getWriteContract,
} from './docs/config.mjs';

const foundationOnlyHandler = async ({ mode }) => {
  throw new Error(
    `Documentation mode "${mode}" is wired but is not available until its approved implementation phase.`,
  );
};

const defaultHandlers = Object.freeze(Object.fromEntries(
  COMMANDS.map((mode) => [mode, foundationOnlyHandler]),
));

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
