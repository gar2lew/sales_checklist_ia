import {
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

import { GUIDE_VERSION } from './config.mjs';

const START_MARKER = '<!-- docs-automation:metadata:start -->';
const END_MARKER = '<!-- docs-automation:metadata:end -->';
const FIELD_NAMES = Object.freeze([
  'Application version',
  'Guide version',
  'Generated',
  'Git branch',
  'Source commit',
]);

function metadataError(message) {
  return new Error(`Documentation metadata validation failed: ${message}.`);
}

function markerIndexes(markdown) {
  const starts = [...markdown.matchAll(new RegExp(START_MARKER, 'g'))].map(({ index }) => index);
  const ends = [...markdown.matchAll(new RegExp(END_MARKER, 'g'))].map(({ index }) => index);
  if (starts.length === 0) throw metadataError('missing start marker');
  if (ends.length === 0) throw metadataError('missing end marker');
  if (starts.length > 1) throw metadataError('duplicate start marker');
  if (ends.length > 1) throw metadataError('duplicate end marker');
  if (starts[0] > ends[0]) throw metadataError('start marker must appear before end marker');
  return { start: starts[0], end: ends[0] };
}

function parseBlock(markdown) {
  const indexes = markerIndexes(markdown);
  const contentStart = indexes.start + START_MARKER.length;
  const raw = markdown.slice(contentStart, indexes.end);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length !== FIELD_NAMES.length) {
    throw metadataError('malformed metadata block');
  }
  const metadata = {};
  for (const [index, field] of FIELD_NAMES.entries()) {
    const match = lines[index].match(/^\*\*([^*]+):\*\*\s+(.+?)(?:<br>)?$/);
    if (!match || match[1] !== field || !match[2].trim()) {
      throw metadataError('malformed metadata block');
    }
    metadata[field] = match[2].trim();
  }
  return { indexes, metadata };
}

function validateMetadata(metadata) {
  for (const key of [
    'applicationVersion',
    'guideVersion',
    'generatedDate',
    'sourceBranch',
    'sourceCommit',
  ]) {
    if (typeof metadata[key] !== 'string' || metadata[key].trim() === '') {
      throw metadataError(`missing ${key}`);
    }
  }
  if (!/^[0-9a-f]{40}$/i.test(metadata.sourceCommit)) {
    throw metadataError('Source commit must be a full 40-character hash');
  }
}

function lineEndingOf(markdown) {
  return markdown.includes('\r\n') ? '\r\n' : '\n';
}

function renderBlock(metadata, lineEnding) {
  validateMetadata(metadata);
  return [
    START_MARKER,
    `**Application version:** ${metadata.applicationVersion}<br>`,
    `**Guide version:** ${metadata.guideVersion}<br>`,
    `**Generated:** ${metadata.generatedDate}<br>`,
    `**Git branch:** ${metadata.sourceBranch}<br>`,
    `**Source commit:** ${metadata.sourceCommit}`,
    END_MARKER,
  ].join(lineEnding);
}

export function readApplicationVersion(appJsText) {
  const declarationNameCount = (appJsText.match(/\bAPP_VERSION\b/g) ?? []).length;
  const values = [...appJsText.matchAll(
    /\b(?:const|let|var)\s+APP_VERSION\s*=\s*(['"])([^'"]+)\1\s*;/g,
  )].map((match) => match[2]);
  if (declarationNameCount === 0) {
    throw metadataError('authoritative APP_VERSION was not found');
  }
  if (values.length === 0) {
    throw metadataError('malformed APP_VERSION');
  }
  if (new Set(values).size > 1) {
    throw metadataError('conflicting APP_VERSION values');
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(values[0])) {
    throw metadataError('malformed APP_VERSION');
  }
  return values[0];
}

export function formatPerthLongDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw metadataError('generation clock is invalid');
  }
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function parseGeneratedMetadata(markdown) {
  return Object.freeze(parseBlock(markdown).metadata);
}

export function replaceGeneratedMetadata(markdown, metadata) {
  const { indexes } = parseBlock(markdown);
  const lineEnding = lineEndingOf(markdown);
  const replacement = renderBlock(metadata, lineEnding);
  return [
    markdown.slice(0, indexes.start),
    replacement,
    markdown.slice(indexes.end + END_MARKER.length),
  ].join('');
}

export async function updateGeneratedMetadataFile(path, metadata, options = {}) {
  const target = resolve(path);
  const original = await readFile(target, 'utf8');
  const updated = replaceGeneratedMetadata(original, metadata);
  if (updated === original) {
    return Object.freeze({ changed: false, path: target });
  }

  const temporary = resolve(
    dirname(target),
    `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const replace = options.replace ?? rename;
  try {
    await writeFile(temporary, updated, 'utf8');
    await replace(temporary, target);
  } finally {
    await rm(temporary, { force: true });
  }
  return Object.freeze({ changed: true, path: target });
}

export async function runMetadataUpdate(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const repository = options.repository;
  if (!repository?.branch || !repository?.sourceCommit) {
    throw metadataError('captured named branch and Source commit are required');
  }
  const appPath = resolve(repoRoot, 'js/app.js');
  const guidePath = resolve(
    repoRoot,
    'docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md',
  );
  const applicationVersion = readApplicationVersion(await readFile(appPath, 'utf8'));
  const clock = options.clock ?? (() => new Date());
  const result = await updateGeneratedMetadataFile(guidePath, {
    applicationVersion,
    guideVersion: GUIDE_VERSION,
    generatedDate: formatPerthLongDate(clock()),
    sourceBranch: repository.branch,
    sourceCommit: repository.sourceCommit,
  }, options.fileOptions);
  return Object.freeze({
    ...result,
    applicationVersion,
    guideVersion: GUIDE_VERSION,
  });
}

export const METADATA_MARKERS = Object.freeze({
  start: START_MARKER,
  end: END_MARKER,
});
