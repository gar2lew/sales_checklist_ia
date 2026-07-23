import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';

import { runCommand } from './process.mjs';

const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');

function screenshotError(stage, requirement, remediation, cause) {
  return new Error(
    `${stage} failed: ${requirement}. ${remediation}`,
    cause ? { cause } : undefined,
  );
}

function sortedUniqueManifest(manifest) {
  const filenames = manifest.map(({ filename }) => filename);
  const duplicate = filenames.find((filename, index) => filenames.indexOf(filename) !== index);
  if (duplicate) {
    throw screenshotError(
      'Screenshot manifest',
      `duplicate filename: ${duplicate}`,
      'Keep each authoritative screenshot filename unique.',
    );
  }
  return [...manifest].sort((left, right) => left.filename.localeCompare(right.filename));
}

async function listFiles(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map(({ name }) => name)
      .sort();
  } catch (cause) {
    if (cause.code === 'ENOENT') return [];
    throw cause;
  }
}

export async function sha256File(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

export async function validatePng(path) {
  const bytes = await readFile(path);
  if (
    bytes.length < 24
    || !bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
    || bytes.toString('ascii', 12, 16) !== 'IHDR'
  ) {
    throw screenshotError(
      'PNG validation',
      `${basename(path)} does not have a valid PNG signature and IHDR`,
      'Recapture the declared screenshot as a PNG.',
    );
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) {
    throw screenshotError(
      'PNG validation',
      `${basename(path)} has invalid dimensions ${width}x${height}`,
      'Recapture a visible, non-zero screenshot.',
    );
  }
  return Object.freeze({ width, height, bytes: bytes.length });
}

export async function assertCaptureReady(options = {}) {
  const { page, locator, filename, selector } = options;
  if (!await locator.count()) {
    throw screenshotError(
      'Screenshot capture',
      `${filename}: required locator is missing: ${selector}`,
      'Restore the expected application state before capture.',
    );
  }
  await locator.waitFor({ state: 'visible' });
  await locator.scrollIntoViewIfNeeded();
  try {
    await page.waitForFunction(async () => {
      await document.fonts.ready;
      return document.fonts.status === 'loaded';
    });
  } catch (cause) {
    throw screenshotError(
      'Screenshot capture',
      `${filename}: fonts were not ready`,
      'Wait for the complete font set before capture.',
      cause,
    );
  }
  await page.evaluate(() => new Promise(
    (resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)),
  ));
  const box = await locator.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) {
    throw screenshotError(
      'Screenshot capture',
      `${filename}: required locator has zero bounds: ${selector}`,
      'Ensure the target is visible and laid out before capture.',
    );
  }
  return Object.freeze({ ...box });
}

export async function classifyScreenshots(options = {}) {
  const manifest = sortedUniqueManifest(options.manifest ?? []);
  const expected = manifest.map(({ filename }) => filename);
  const candidates = await listFiles(options.candidateDir);
  const missing = expected.filter((filename) => !candidates.includes(filename));
  const unexpected = candidates.filter((filename) => !expected.includes(filename));
  if (missing.length || unexpected.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      unexpected.length ? `unexpected: ${unexpected.join(', ')}` : '',
    ].filter(Boolean).join('; ');
    throw screenshotError(
      'Screenshot capture',
      `candidate set does not match the manifest (${details})`,
      'Complete every declared capture and remove undeclared candidates before applying changes.',
    );
  }

  for (const filename of candidates) {
    await validatePng(resolve(options.candidateDir, filename));
  }

  const committed = await listFiles(options.committedDir);
  const result = { UNCHANGED: [], UPDATED: [], NEW: [], REMOVED: [] };
  for (const entry of manifest) {
    const candidatePath = resolve(options.candidateDir, entry.filename);
    const hash = await sha256File(candidatePath);
    if (!committed.includes(entry.filename)) {
      result.NEW.push(Object.freeze({ filename: entry.filename, hash }));
      continue;
    }
    const committedHash = await sha256File(resolve(options.committedDir, entry.filename));
    const classification = committedHash === hash ? 'UNCHANGED' : 'UPDATED';
    result[classification].push(Object.freeze({
      filename: entry.filename,
      hash,
      previousHash: committedHash,
    }));
  }
  for (const filename of committed.filter((name) => !expected.includes(name))) {
    result.REMOVED.push(Object.freeze({
      filename,
      previousHash: await sha256File(resolve(options.committedDir, filename)),
    }));
  }
  return Object.freeze(Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, Object.freeze(value)]),
  ));
}

function validatePriorMetadata(metadata) {
  if (metadata === null || metadata === undefined) {
    return { schemaVersion: 1, screenshots: [] };
  }
  if (
    metadata.schemaVersion !== 1
    || !Array.isArray(metadata.screenshots)
    || metadata.screenshots.some((entry) => (
      !entry
      || typeof entry.filename !== 'string'
      || !entry.viewport
      || !Number.isInteger(entry.viewport.width)
      || !Number.isInteger(entry.viewport.height)
      || entry.viewport.deviceScaleFactor !== 2
      || typeof entry.page !== 'string'
      || typeof entry.description !== 'string'
      || !/^[0-9a-f]{64}$/.test(entry.hash)
      || Number.isNaN(Date.parse(entry.lastGenerated))
    ))
  ) {
    throw screenshotError(
      'Screenshot metadata',
      'screenshots.json does not match schemaVersion 1',
      'Restore valid deterministic screenshot metadata before continuing.',
    );
  }
  const names = metadata.screenshots.map(({ filename }) => filename);
  if (new Set(names).size !== names.length) {
    throw screenshotError(
      'Screenshot metadata',
      'screenshots.json contains duplicate filenames',
      'Keep one metadata entry per authoritative screenshot.',
    );
  }
  const sortedNames = [...names].sort((left, right) => left.localeCompare(right));
  if (names.some((name, index) => name !== sortedNames[index])) {
    throw screenshotError(
      'Screenshot metadata',
      'screenshots.json filenames are not in stable sorted order',
      'Sort metadata entries by filename.',
    );
  }
  return metadata;
}

export function buildScreenshotMetadata(options = {}) {
  const manifest = sortedUniqueManifest(options.manifest ?? []);
  const prior = validatePriorMetadata(options.previousMetadata);
  const timestamp = options.timestamp;
  if (!timestamp || Number.isNaN(Date.parse(timestamp))) {
    throw screenshotError(
      'Screenshot metadata',
      'a valid shared ISO generation timestamp is required',
      'Generate one timestamp and reuse it for every NEW or UPDATED entry.',
    );
  }
  const previousByName = new Map(prior.screenshots.map((entry) => [entry.filename, entry]));
  const classificationByName = new Map();
  for (const state of ['UNCHANGED', 'UPDATED', 'NEW']) {
    for (const item of options.classification[state]) {
      classificationByName.set(item.filename, { state, ...item });
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    screenshots: Object.freeze(manifest.map((entry) => {
      const classified = classificationByName.get(entry.filename);
      if (!classified) {
        throw screenshotError(
          'Screenshot metadata',
          `manifest entry was not classified: ${entry.filename}`,
          'Classify the complete candidate set before building metadata.',
        );
      }
      const previous = previousByName.get(entry.filename);
      return Object.freeze({
        filename: entry.filename,
        viewport: Object.freeze({
          width: entry.viewport.width,
          height: entry.viewport.height,
          deviceScaleFactor: entry.viewport.deviceScaleFactor,
        }),
        page: entry.page,
        description: entry.description,
        hash: classified.hash,
        lastGenerated: classified.state === 'UNCHANGED' && previous
          ? previous.lastGenerated
          : timestamp,
      });
    })),
  });
}

export function serializeScreenshotMetadata(metadata) {
  validatePriorMetadata(metadata);
  return `${JSON.stringify(metadata, null, 2)}\n`;
}

async function readPreviousMetadata(metadataPath) {
  try {
    return JSON.parse(await readFile(metadataPath, 'utf8'));
  } catch (cause) {
    if (cause.code === 'ENOENT') return null;
    throw screenshotError(
      'Screenshot metadata',
      `could not read ${basename(metadataPath)}`,
      'Restore valid JSON metadata before applying screenshot changes.',
      cause,
    );
  }
}

async function atomicCopy(source, destination) {
  const temporary = `${destination}.${process.pid}.tmp`;
  await copyFile(source, temporary);
  try {
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function atomicWrite(path, content) {
  try {
    const current = await readFile(path, 'utf8');
    if (current === content || current.replaceAll('\r\n', '\n') === content.replaceAll('\r\n', '\n')) {
      return false;
    }
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause;
  }
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content);
  try {
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return true;
}

export async function applyScreenshotChanges(options = {}) {
  const committedPath = resolve(options.committedDir).replaceAll('\\', '/');
  const metadataPath = resolve(options.metadataPath).replaceAll('\\', '/');
  const candidatePath = resolve(options.candidateDir).replaceAll('\\', '/');
  if (
    !committedPath.endsWith('/docs/user-guides/screenshots')
    || !metadataPath.endsWith('/docs/user-guides/screenshots.json')
    || !candidatePath.includes('/.tmp/docs-user-guide/screenshots')
  ) {
    throw screenshotError(
      'Screenshot write contract',
      'screenshot paths are outside the approved committed or temporary outputs',
      'Use docs/user-guides/screenshots, screenshots.json, and .tmp/docs-user-guide/screenshots.',
    );
  }
  const classification = await classifyScreenshots(options);
  const previousMetadata = options.previousMetadata
    ?? await readPreviousMetadata(options.metadataPath);
  const metadata = buildScreenshotMetadata({
    manifest: options.manifest,
    classification,
    previousMetadata,
    timestamp: options.timestamp,
  });
  await mkdir(options.committedDir, { recursive: true });
  await mkdir(resolve(options.metadataPath, '..'), { recursive: true });
  for (const state of ['UPDATED', 'NEW']) {
    for (const { filename } of classification[state]) {
      await atomicCopy(
        resolve(options.candidateDir, filename),
        resolve(options.committedDir, filename),
      );
    }
  }
  for (const { filename } of classification.REMOVED) {
    await rm(resolve(options.committedDir, filename), { force: true });
  }
  const metadataChanged = await atomicWrite(
    options.metadataPath,
    serializeScreenshotMetadata(metadata),
  );
  return Object.freeze({ classification, metadata, metadataChanged });
}

function assertTemporaryCapturePath(repoRoot, outputDir) {
  const expectedRoot = resolve(repoRoot, '.tmp/docs-user-guide/screenshots');
  const actual = resolve(outputDir);
  const pathFromExpected = relative(expectedRoot, actual);
  if (pathFromExpected.startsWith('..') || resolve(expectedRoot, pathFromExpected) !== actual) {
    throw screenshotError(
      'Screenshot capture',
      `output is outside the pipeline temporary directory: ${actual}`,
      `Use ${expectedRoot} or a descendant.`,
    );
  }
}

export async function runScreenshotCapture(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const outputDir = resolve(
    options.outputDir ?? resolve(repoRoot, '.tmp/docs-user-guide/screenshots'),
  );
  assertTemporaryCapturePath(repoRoot, outputDir);
  await mkdir(outputDir, { recursive: true });
  const run = options.run ?? runCommand;
  const result = await run(
    process.execPath,
    ['tests/user-guide-screenshots.spec.mjs'],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        DOCS_BASE_URL: String(options.baseUrl),
        DOCS_SCREENSHOT_OUTPUT: outputDir,
      },
      timeoutMs: options.timeoutMs ?? 120_000,
    },
  );
  if (result.exitCode !== 0) {
    throw screenshotError(
      'Screenshot capture',
      `Playwright exited with code ${result.exitCode}`,
      'Review the bounded capture output and required locator state.',
      new Error(result.stderr || result.stdout),
    );
  }
  return Object.freeze({ outputDir, stdout: result.stdout, stderr: result.stderr });
}
