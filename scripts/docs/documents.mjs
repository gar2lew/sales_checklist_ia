import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';

import JSZip from 'jszip';

import { parseGeneratedMetadata } from './metadata.mjs';
import { runCommand } from './process.mjs';

export const DOCUMENT_FILENAMES = Object.freeze({
  docx: 'ASG_Sales_Appointment_Capture_User_Guide.docx',
  pdf: 'ASG_Sales_Appointment_Capture_User_Guide.pdf',
});

function generationError(requirement, remediation, cause) {
  return new Error(
    `Document generation failed: ${requirement}. ${remediation}`,
    cause ? { cause } : undefined,
  );
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function metadataValues(metadata) {
  return [
    'Application version',
    'Guide version',
    'Generated',
    'Git branch',
    'Source commit',
  ].map((key) => [key, metadata[key]]);
}

export async function validateGenerationInputs(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const guideDir = resolve(repoRoot, 'docs/user-guides');
  const sourcePath = resolve(
    guideDir,
    'source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md',
  );
  const screenshotDir = resolve(guideDir, 'screenshots');
  const metadataPath = resolve(guideDir, 'screenshots.json');
  let markdown;
  let screenshotMetadata;
  try {
    markdown = await readFile(sourcePath, 'utf8');
    screenshotMetadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  } catch (cause) {
    throw generationError(
      'canonical Markdown or screenshot metadata could not be read',
      'Restore the committed guide inputs and retry.',
      cause,
    );
  }
  const metadata = parseGeneratedMetadata(markdown);
  if (
    screenshotMetadata?.schemaVersion !== 1
    || !Array.isArray(screenshotMetadata.screenshots)
  ) {
    throw generationError(
      'screenshots.json is malformed',
      'Restore deterministic schemaVersion 1 screenshot metadata.',
    );
  }
  const declared = screenshotMetadata.screenshots.map(({ filename }) => filename);
  if (new Set(declared).size !== declared.length) {
    throw generationError(
      'screenshots.json contains duplicate filenames',
      'Keep one authoritative entry per screenshot.',
    );
  }
  const linked = [...markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)]
    .map((match) => match[1])
    .filter((path) => path.replaceAll('\\', '/').includes('/screenshots/'))
    .map((path) => basename(path));
  for (const filename of linked) {
    if (!declared.includes(filename)) {
      throw generationError(
        `linked screenshot is not declared: ${filename}`,
        'Declare it in screenshots.json or remove the Markdown link.',
      );
    }
  }
  const unconsumed = declared.filter((filename) => !linked.includes(filename));
  if (unconsumed.length > 0) {
    throw generationError(
      `manifest screenshot is not linked by the guide: ${unconsumed.join(', ')}`,
      'Keep the canonical Markdown and screenshot manifest in sync.',
    );
  }
  for (const entry of screenshotMetadata.screenshots) {
    const path = resolve(screenshotDir, entry.filename);
    if (!await exists(path)) {
      throw generationError(
        `missing screenshot: ${entry.filename}`,
        'Restore or recapture the declared screenshot.',
      );
    }
    const actualHash = await sha256(path);
    if (actualHash !== entry.hash) {
      throw generationError(
        `screenshot hash does not match screenshots.json: ${entry.filename}`,
        'Run the approved screenshot pipeline before document generation.',
      );
    }
  }
  return Object.freeze({
    repoRoot,
    guideDir,
    sourcePath,
    screenshotDir,
    screenshotMetadataPath: metadataPath,
    screenshotNames: Object.freeze([...declared]),
    metadata,
  });
}

export async function validateDocxCandidate(path, options = {}) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (cause) {
    throw generationError(
      `candidate DOCX is missing: ${path}`,
      'Inspect the Python generator output.',
      cause,
    );
  }
  if (bytes.length === 0 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw generationError(
      'candidate DOCX is not a valid ZIP package',
      'Inspect the Python generator output.',
    );
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (cause) {
    throw generationError(
      'candidate DOCX ZIP could not be opened',
      'Inspect the Python generator output.',
      cause,
    );
  }
  for (const entry of [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
  ]) {
    if (!zip.file(entry)) {
      throw generationError(
        `candidate DOCX is missing required OOXML entry: ${entry}`,
        'Restore the retained generator package structure.',
      );
    }
  }
  const documentXml = await zip.file('word/document.xml').async('string');
  for (const [label, value] of metadataValues(options.metadata ?? {})) {
    if (!value || !documentXml.includes(value)) {
      throw generationError(
        `candidate DOCX is missing metadata: ${label}`,
        'Render all canonical metadata values into the document.',
      );
    }
  }
  const mediaCount = Object.keys(zip.files)
    .filter((entry) => /^word\/media\/[^/]+$/.test(entry)).length;
  if (mediaCount < (options.screenshotCount ?? 0)) {
    throw generationError(
      `candidate DOCX is missing screenshot media (${mediaCount} found)`,
      'Render every approved guide screenshot.',
    );
  }
  return Object.freeze({ size: bytes.length, mediaCount });
}

export async function validatePdfCandidate(path) {
  let bytes;
  try {
    bytes = await readFile(path);
  } catch (cause) {
    throw generationError(
      `candidate PDF is missing: ${path}`,
      'Inspect the LibreOffice conversion output.',
      cause,
    );
  }
  if (bytes.length === 0) {
    throw generationError('candidate PDF is empty', 'Inspect LibreOffice conversion output.');
  }
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw generationError(
      'candidate PDF has a malformed signature',
      'Inspect LibreOffice conversion output.',
    );
  }
  if (!bytes.subarray(Math.max(0, bytes.length - 2048)).includes(Buffer.from('%%EOF'))) {
    throw generationError(
      'candidate PDF is missing its trailing EOF marker',
      'Inspect LibreOffice conversion output.',
    );
  }
  return Object.freeze({ size: bytes.length });
}

async function atomicRestore(path, bytes) {
  const temporary = resolve(dirname(path), `.${basename(path)}.${randomUUID()}.restore`);
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function promoteDocumentPair(options = {}) {
  const keys = ['docx', 'pdf'];
  const status = {};
  const hashes = {};
  const originals = {};
  const replacementFiles = {};
  const changed = [];
  for (const key of keys) {
    const candidateHash = await sha256(options.candidates[key]);
    const committedExists = await exists(options.committed[key]);
    const oldHash = committedExists ? await sha256(options.committed[key]) : null;
    status[key] = oldHash === candidateHash ? 'unchanged' : oldHash ? 'updated' : 'new';
    hashes[key] = Object.freeze({ old: oldHash, new: candidateHash });
    if (status[key] !== 'unchanged') {
      changed.push(key);
      originals[key] = committedExists ? await readFile(options.committed[key]) : null;
      replacementFiles[key] = resolve(
        dirname(options.committed[key]),
        `.${basename(options.committed[key])}.${randomUUID()}.candidate`,
      );
      await copyFile(options.candidates[key], replacementFiles[key]);
    }
  }
  if (changed.length === 0) {
    return Object.freeze({
      status: Object.freeze(status),
      hashes: Object.freeze(hashes),
    });
  }

  const promoted = [];
  try {
    for (const key of changed) {
      await options.beforePromote?.(key);
      await rename(replacementFiles[key], options.committed[key]);
      promoted.push(key);
    }
  } catch (cause) {
    for (const key of promoted.reverse()) {
      if (originals[key] === null) {
        await rm(options.committed[key], { force: true });
      } else {
        await atomicRestore(options.committed[key], originals[key]);
      }
    }
    throw cause;
  } finally {
    await Promise.all(Object.values(replacementFiles).map((path) => rm(path, { force: true })));
  }
  return Object.freeze({
    status: Object.freeze(status),
    hashes: Object.freeze(hashes),
  });
}

export async function generateDocuments(options = {}) {
  const inputs = await validateGenerationInputs(options);
  const python = options.tooling?.python;
  const libreOffice = options.tooling?.libreOffice;
  if (!python?.executable || !libreOffice?.executable) {
    throw generationError(
      'validated Python and LibreOffice commands are required',
      'Run the Phase 2 generation tooling preflight first.',
    );
  }
  const generatedDir = resolve(inputs.repoRoot, '.tmp/docs-user-guide/generated');
  const profileDir = resolve(inputs.repoRoot, '.tmp/docs-user-guide/libreoffice-profile');
  const scriptPath = resolve(inputs.repoRoot, 'scripts/generate-sales-appointment-user-guide.py');
  const candidates = {
    docx: resolve(generatedDir, DOCUMENT_FILENAMES.docx),
    pdf: resolve(generatedDir, DOCUMENT_FILENAMES.pdf),
  };
  const committed = {
    docx: resolve(inputs.guideDir, DOCUMENT_FILENAMES.docx),
    pdf: resolve(inputs.guideDir, DOCUMENT_FILENAMES.pdf),
  };
  const run = options.run ?? runCommand;
  await rm(generatedDir, { recursive: true, force: true });
  await rm(profileDir, { recursive: true, force: true });
  await mkdir(generatedDir, { recursive: true });
  await mkdir(profileDir, { recursive: true });
  try {
    let result;
    try {
      result = await run(
        python.executable,
        [
          ...(python.prefixArgs ?? []),
          scriptPath,
          '--source', inputs.sourcePath,
          '--screenshots-json', inputs.screenshotMetadataPath,
          '--screenshot-dir', inputs.screenshotDir,
          '--output-dir', generatedDir,
          '--libreoffice', libreOffice.executable,
          '--profile-dir', profileDir,
        ],
        {
          cwd: inputs.repoRoot,
          shell: false,
          timeoutMs: options.timeoutMs ?? 180_000,
          maxOutputBytes: options.maxOutputBytes ?? 1024 * 1024,
          env: {
            ...process.env,
            ...(options.env ?? {}),
            LANG: 'en_AU.UTF-8',
            LC_ALL: 'en_AU.UTF-8',
          },
        },
      );
    } catch (cause) {
      throw generationError(
        cause.message.includes('timed out')
          ? 'Python/LibreOffice generation timed out'
          : 'Python generator could not be executed',
        'Check the selected tools and retry.',
        cause,
      );
    }
    if (result.exitCode !== 0) {
      const diagnostic = (result.stderr || result.stdout).trim();
      throw generationError(
        `Python generator exited with code ${result.exitCode}${diagnostic ? `: ${diagnostic}` : ''}`,
        'Correct the generator or LibreOffice failure and retry.',
        new Error(diagnostic || `Exit code ${result.exitCode}`),
      );
    }
    await validateDocxCandidate(candidates.docx, {
      metadata: inputs.metadata,
      screenshotCount: inputs.screenshotNames.length,
    });
    await validatePdfCandidate(candidates.pdf);
    const promotion = await promoteDocumentPair({ candidates, committed });
    return Object.freeze({
      candidates: Object.freeze(candidates),
      committed: Object.freeze(committed),
      promotion,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } finally {
    await rm(generatedDir, { recursive: true, force: true });
    await rm(profileDir, { recursive: true, force: true });
  }
}
