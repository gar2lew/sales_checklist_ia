import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import { runDocumentationCommand } from '../scripts/docs-user-guide.mjs';
import {
  generateDocuments,
  promoteDocumentPair,
  validateDocxCandidate,
  validateGenerationInputs,
  validatePdfCandidate,
} from '../scripts/docs/documents.mjs';
import { discoverDocumentGenerationTooling } from '../scripts/docs/tooling.mjs';

const metadata = Object.freeze({
  'Application version': '2.7.0-alpha.1',
  'Guide version': '1.0.0',
  Generated: '22 July 2026',
  'Git branch': 'fix/staff-dropdown-seeding-v2',
  'Source commit': '6d926a19062d4c1ac80f76ef9f9eacdbcd710725',
});
const names = Object.freeze({
  docx: 'ASG_Sales_Appointment_Capture_User_Guide.docx',
  pdf: 'ASG_Sales_Appointment_Capture_User_Guide.pdf',
});

function metadataMarkdown(imageNames = ['01-guide.png']) {
  return [
    '# Sales Appointment Capture',
    '',
    '<!-- docs-automation:metadata:start -->',
    '**Application version:** 2.7.0-alpha.1<br>',
    '**Guide version:** 1.0.0<br>',
    '**Generated:** 22 July 2026<br>',
    '**Git branch:** fix/staff-dropdown-seeding-v2<br>',
    '**Source commit:** 6d926a19062d4c1ac80f76ef9f9eacdbcd710725',
    '<!-- docs-automation:metadata:end -->',
    '',
    ...imageNames.map((name) => `![Guide](../screenshots/${name})`),
    '',
  ].join('\n');
}

async function createInputFixture(t) {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-generation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const guideDir = resolve(root, 'docs/user-guides');
  const sourcePath = resolve(guideDir, 'source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md');
  const screenshotDir = resolve(guideDir, 'screenshots');
  await mkdir(resolve(sourcePath, '..'), { recursive: true });
  await mkdir(screenshotDir, { recursive: true });
  const image = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await writeFile(resolve(screenshotDir, '01-guide.png'), image);
  await writeFile(sourcePath, metadataMarkdown());
  await writeFile(resolve(guideDir, 'screenshots.json'), `${JSON.stringify({
    schemaVersion: 1,
    screenshots: [{
      filename: '01-guide.png',
      viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
      page: 'Guide',
      description: 'Guide fixture',
      hash: createHash('sha256').update(image).digest('hex'),
      lastGenerated: '2026-07-22T02:00:00.000Z',
    }],
  }, null, 2)}\n`);
  await mkdir(resolve(root, 'scripts'), { recursive: true });
  await writeFile(resolve(root, 'scripts/generate-sales-appointment-user-guide.py'), '# fixture\n');
  return { root, guideDir, sourcePath, screenshotDir };
}

async function createDocx(path, values = metadata, mediaCount = 1) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types/>');
  zip.file('_rels/.rels', '<Relationships/>');
  zip.file('word/_rels/document.xml.rels', '<Relationships/>');
  zip.file('word/document.xml', `<document>${Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}</document>`);
  for (let index = 0; index < mediaCount; index += 1) {
    zip.file(`word/media/image${index + 1}.png`, `image-${index}`);
  }
  await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
}

async function createPdf(path, valid = true) {
  await writeFile(path, valid ? '%PDF-1.7\nfixture\n%%EOF\n' : 'not a pdf');
}

test('generation inputs require one authoritative screenshot set with matching hashes and links', async (t) => {
  const fixture = await createInputFixture(t);
  const result = await validateGenerationInputs({ repoRoot: fixture.root });
  assert.deepEqual(result.metadata, metadata);
  assert.deepEqual(result.screenshotNames, ['01-guide.png']);

  await writeFile(resolve(fixture.screenshotDir, '01-guide.png'), 'changed');
  await assert.rejects(
    validateGenerationInputs({ repoRoot: fixture.root }),
    /screenshot hash.*01-guide\.png/i,
  );
  await rm(resolve(fixture.screenshotDir, '01-guide.png'));
  await assert.rejects(
    validateGenerationInputs({ repoRoot: fixture.root }),
    /missing screenshot.*01-guide\.png/i,
  );
  await writeFile(fixture.sourcePath, metadataMarkdown(['02-undeclared.png']));
  await assert.rejects(
    validateGenerationInputs({ repoRoot: fixture.root }),
    /not declared.*02-undeclared\.png/i,
  );
});

test('Phase 6 tooling selects Python and LibreOffice without requiring Poppler or Playwright', async () => {
  const calls = [];
  const result = await discoverDocumentGenerationTooling({
    repoRoot: resolve(import.meta.dirname, '..'),
    discoverPythonCommand: async () => {
      calls.push('python');
      return { executable: 'approved-python', prefixArgs: ['-3'] };
    },
    findExecutable: async (name) => {
      calls.push(name);
      return name === 'libreoffice'
        ? { executable: 'approved-soffice', prefixArgs: [] }
        : null;
    },
  });
  assert.deepEqual(result.python, { executable: 'approved-python', prefixArgs: ['-3'] });
  assert.deepEqual(result.libreOffice, { executable: 'approved-soffice', prefixArgs: [] });
  assert.deepEqual(calls, ['python', 'libreoffice']);
  assert.equal(Object.hasOwn(result, 'pdfinfo'), false);
  assert.equal(Object.hasOwn(result, 'playwright'), false);
});

test('Python generator passes an encoded isolated-profile URI to LibreOffice', async () => {
  const source = await readFile(
    resolve(import.meta.dirname, '../scripts/generate-sales-appointment-user-guide.py'),
    'utf8',
  );
  assert.match(source, /LIBREOFFICE_PROFILE\.as_uri\(\)/);
  assert.doesNotMatch(source, /file:\/\/\/\{LIBREOFFICE_PROFILE\.as_posix\(\)\}/);
  assert.match(source, /shell=False/);
});

test('generate command performs preflight, metadata, tooling, then documents without later phases', async () => {
  const calls = [];
  const repository = {
    repoRoot: resolve(import.meta.dirname, '..'),
    branch: 'fix/staff-dropdown-seeding-v2',
    sourceCommit: '6d926a19062d4c1ac80f76ef9f9eacdbcd710725',
    changes: [],
  };
  const tooling = {
    python: { executable: 'python', prefixArgs: [] },
    libreOffice: { executable: 'soffice', prefixArgs: [] },
  };
  const result = await runDocumentationCommand('generate', {
    repoRoot: repository.repoRoot,
    repositoryInspector: async () => {
      calls.push('preflight');
      return repository;
    },
    assertRepository: async () => calls.push('clean'),
    metadataUpdate: async () => {
      calls.push('metadata');
      return { changed: false };
    },
    generationTooling: async () => {
      calls.push('tooling');
      return tooling;
    },
    documentGeneration: async (options) => {
      calls.push('documents');
      assert.equal(options.repoRoot, repository.repoRoot);
      assert.equal(options.tooling, tooling);
      return { promotion: { status: { docx: 'unchanged', pdf: 'unchanged' } } };
    },
  });
  assert.deepEqual(calls, ['preflight', 'clean', 'metadata', 'tooling', 'documents']);
  assert.deepEqual(result.promotion.status, { docx: 'unchanged', pdf: 'unchanged' });
});

test('candidate validation accepts complete DOCX/PDF and rejects malformed or incomplete artifacts', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-candidates-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const docx = resolve(root, names.docx);
  const pdf = resolve(root, names.pdf);
  await createDocx(docx);
  await createPdf(pdf);
  assert.equal((await validateDocxCandidate(docx, { metadata, screenshotCount: 1 })).mediaCount, 1);
  assert.equal((await validatePdfCandidate(pdf)).size > 0, true);

  await writeFile(docx, 'invalid');
  await assert.rejects(validateDocxCandidate(docx, { metadata, screenshotCount: 1 }), /DOCX.*ZIP/i);
  await createDocx(docx, metadata, 0);
  await assert.rejects(validateDocxCandidate(docx, { metadata, screenshotCount: 1 }), /screenshot media/i);
  await createDocx(docx, { ...metadata, 'Source commit': '' });
  await assert.rejects(validateDocxCandidate(docx, { metadata, screenshotCount: 1 }), /metadata.*Source commit/i);
  await writeFile(pdf, '');
  await assert.rejects(validatePdfCandidate(pdf), /PDF.*empty/i);
  await createPdf(pdf, false);
  await assert.rejects(validatePdfCandidate(pdf), /PDF.*signature/i);
  await writeFile(pdf, '%PDF-1.7\nmissing eof');
  await assert.rejects(validatePdfCandidate(pdf), /PDF.*EOF/i);
});

test('document generation reuses selected Python/LibreOffice commands and preserves outputs on failure', async (t) => {
  const fixture = await createInputFixture(t);
  const committedDocx = resolve(fixture.guideDir, names.docx);
  const committedPdf = resolve(fixture.guideDir, names.pdf);
  await writeFile(committedDocx, 'old docx');
  await writeFile(committedPdf, 'old pdf');
  const calls = [];
  const tooling = {
    python: { executable: 'approved-python', prefixArgs: ['-3'] },
    libreOffice: { executable: 'approved-soffice', prefixArgs: [] },
  };
  const run = async (executable, args, options) => {
    calls.push({ executable, args, options });
    return { exitCode: 7, signal: null, stdout: 'bounded out', stderr: 'generator failed' };
  };
  await assert.rejects(
    generateDocuments({ repoRoot: fixture.root, tooling, run }),
    (error) => /Document generation.*code 7.*generator failed/si.test(error.message)
      && error.cause instanceof Error,
  );
  assert.equal(await readFile(committedDocx, 'utf8'), 'old docx');
  assert.equal(await readFile(committedPdf, 'utf8'), 'old pdf');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].executable, 'approved-python');
  assert.deepEqual(calls[0].args.slice(0, 2), ['-3', resolve(fixture.root, 'scripts/generate-sales-appointment-user-guide.py')]);
  assert.ok(calls[0].args.includes('--libreoffice'));
  assert.ok(calls[0].args.includes('approved-soffice'));
  assert.ok(calls[0].args.includes('--output-dir'));
  assert.ok(calls[0].args.includes('--profile-dir'));
  assert.equal(calls[0].options.cwd, fixture.root);
  assert.equal(calls[0].options.shell, false);
  assert.ok(calls[0].options.timeoutMs > 0);
  assert.ok(calls[0].options.maxOutputBytes > 0);
});

test('generation rejects missing candidates and cleans staging without touching committed artifacts', async (t) => {
  const fixture = await createInputFixture(t);
  const committedDocx = resolve(fixture.guideDir, names.docx);
  const committedPdf = resolve(fixture.guideDir, names.pdf);
  await writeFile(committedDocx, 'old docx');
  await writeFile(committedPdf, 'old pdf');
  await assert.rejects(
    generateDocuments({
      repoRoot: fixture.root,
      tooling: {
        python: { executable: 'python', prefixArgs: [] },
        libreOffice: { executable: 'soffice', prefixArgs: [] },
      },
      run: async () => ({ exitCode: 0, signal: null, stdout: '', stderr: '' }),
    }),
    /candidate DOCX.*missing/i,
  );
  assert.equal(await readFile(committedDocx, 'utf8'), 'old docx');
  assert.equal(await readFile(committedPdf, 'utf8'), 'old pdf');
  await assert.rejects(stat(resolve(fixture.root, '.tmp/docs-user-guide/generated')), /ENOENT/);
});

test('generation reports timeout with the original cause and cleans isolated profile staging', async (t) => {
  const fixture = await createInputFixture(t);
  const timeout = new Error('Command timed out after 180000 ms.');
  await assert.rejects(
    generateDocuments({
      repoRoot: fixture.root,
      tooling: {
        python: { executable: 'python', prefixArgs: [] },
        libreOffice: { executable: 'soffice', prefixArgs: [] },
      },
      run: async () => { throw timeout; },
    }),
    (error) => /generation timed out/i.test(error.message) && error.cause === timeout,
  );
  await assert.rejects(stat(resolve(fixture.root, '.tmp/docs-user-guide/generated')), /ENOENT/);
  await assert.rejects(
    stat(resolve(fixture.root, '.tmp/docs-user-guide/libreoffice-profile')),
    /ENOENT/,
  );
});

test('pair promotion replaces changed artifacts together and preserves byte-identical mtimes', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-promotion-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const committedDocx = resolve(root, 'committed.docx');
  const committedPdf = resolve(root, 'committed.pdf');
  const candidateDocx = resolve(root, 'candidate.docx');
  const candidatePdf = resolve(root, 'candidate.pdf');
  await writeFile(committedDocx, 'old docx');
  await writeFile(committedPdf, 'old pdf');
  await writeFile(candidateDocx, 'new docx');
  await writeFile(candidatePdf, 'new pdf');
  const changed = await promoteDocumentPair({
    candidates: { docx: candidateDocx, pdf: candidatePdf },
    committed: { docx: committedDocx, pdf: committedPdf },
  });
  assert.deepEqual(changed.status, { docx: 'updated', pdf: 'updated' });
  assert.equal(await readFile(committedDocx, 'utf8'), 'new docx');
  assert.equal(await readFile(committedPdf, 'utf8'), 'new pdf');

  await writeFile(candidateDocx, 'new docx');
  await writeFile(candidatePdf, 'new pdf');
  const beforeDocx = await stat(committedDocx);
  const beforePdf = await stat(committedPdf);
  const unchanged = await promoteDocumentPair({
    candidates: { docx: candidateDocx, pdf: candidatePdf },
    committed: { docx: committedDocx, pdf: committedPdf },
  });
  assert.deepEqual(unchanged.status, { docx: 'unchanged', pdf: 'unchanged' });
  assert.equal((await stat(committedDocx)).mtimeMs, beforeDocx.mtimeMs);
  assert.equal((await stat(committedPdf)).mtimeMs, beforePdf.mtimeMs);
});

test('pair promotion rolls both artifacts back when the second replacement fails', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-promotion-fail-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const committed = { docx: resolve(root, 'guide.docx'), pdf: resolve(root, 'guide.pdf') };
  const candidates = { docx: resolve(root, 'candidate.docx'), pdf: resolve(root, 'candidate.pdf') };
  await writeFile(committed.docx, 'old docx');
  await writeFile(committed.pdf, 'old pdf');
  await writeFile(candidates.docx, 'new docx');
  await writeFile(candidates.pdf, 'new pdf');
  let promotionCount = 0;
  await assert.rejects(
    promoteDocumentPair({
      candidates,
      committed,
      beforePromote: async () => {
        promotionCount += 1;
        if (promotionCount === 2) throw new Error('second replacement failed');
      },
    }),
    /second replacement failed/,
  );
  assert.equal(await readFile(committed.docx, 'utf8'), 'old docx');
  assert.equal(await readFile(committed.pdf, 'utf8'), 'old pdf');
  assert.deepEqual((await readdir(root)).sort(), [
    'candidate.docx',
    'candidate.pdf',
    'guide.docx',
    'guide.pdf',
  ]);
});

test('pair promotion leaves both originals intact when the first replacement is rejected', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-promotion-first-fail-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const committed = { docx: resolve(root, 'guide.docx'), pdf: resolve(root, 'guide.pdf') };
  const candidates = { docx: resolve(root, 'candidate.docx'), pdf: resolve(root, 'candidate.pdf') };
  await writeFile(committed.docx, 'old docx');
  await writeFile(committed.pdf, 'old pdf');
  await writeFile(candidates.docx, 'new docx');
  await writeFile(candidates.pdf, 'new pdf');
  await assert.rejects(
    promoteDocumentPair({
      candidates,
      committed,
      beforePromote: async () => { throw new Error('first replacement failed'); },
    }),
    /first replacement failed/,
  );
  assert.equal(await readFile(committed.docx, 'utf8'), 'old docx');
  assert.equal(await readFile(committed.pdf, 'utf8'), 'old pdf');
});
