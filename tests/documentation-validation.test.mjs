import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
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

import {
  DEFAULT_VISUAL_THRESHOLDS,
  aggregateValidationFindings,
  analysePixelHeuristics,
  parsePdfInfo,
  renderPdfPages,
  validateDocxArtifact,
  validatePdfArtifact,
} from '../scripts/docs/validation.mjs';
import { discoverValidationTooling } from '../scripts/docs/tooling.mjs';

const metadata = Object.freeze({
  'Application version': '2.7.0-alpha.1',
  'Guide version': '1.0.0',
  Generated: '22 July 2026',
  'Git branch': 'fix/staff-dropdown-seeding-v2',
  'Source commit': '9db1800ce947f634520bb391826ad44ded8a6b82',
});

function finding(status, stage, code, message = code) {
  return { status, stage, code, message, remediation: `Fix ${code}`, evidence: {} };
}

test('validation aggregation is deterministic and retains severity and remediation', () => {
  const result = aggregateValidationFindings([
    finding('WARN', 'visual', 'SPARSE'),
    finding('PASS', 'markdown', 'OK'),
    finding('FAIL', 'pdf', 'PAGES'),
  ]);
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.findings.map(({ code }) => code), ['OK', 'PAGES', 'SPARSE']);
  assert.equal(result.findings[1].remediation, 'Fix PAGES');
  assert.equal(aggregateValidationFindings([finding('PASS', 'a', 'OK')]).status, 'PASS');
  assert.equal(aggregateValidationFindings([
    finding('PASS', 'a', 'OK'),
    finding('WARN', 'b', 'REVIEW'),
  ]).status, 'WARN');
});

test('validation tooling rejects wrappers and resolves direct pdfinfo and renderer executables', async () => {
  const calls = [];
  const result = await discoverValidationTooling({
    env: {
      DOCS_PDFINFO: 'C:\\tools\\pdfinfo.exe',
      DOCS_PDF_RENDERER: 'C:\\tools\\pdftoppm.exe',
    },
    run: async (executable, args) => {
      calls.push([executable, args]);
      return { exitCode: 0, signal: null, stdout: 'version', stderr: '' };
    },
  });
  assert.equal(result.pdfinfo.executable, 'C:\\tools\\pdfinfo.exe');
  assert.equal(result.renderer.executable, 'C:\\tools\\pdftoppm.exe');
  assert.deepEqual(calls.map(([executable]) => executable), [
    'C:\\tools\\pdfinfo.exe',
    'C:\\tools\\pdftoppm.exe',
  ]);
  await assert.rejects(
    discoverValidationTooling({
      env: {
        DOCS_PDFINFO: 'pdfinfo.cmd',
        DOCS_PDF_RENDERER: 'pdftoppm.exe',
      },
      run: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    }),
    /directly executable.*pdfinfo\.cmd/i,
  );
});

async function createDocx(path, options = {}) {
  const zip = new JSZip();
  const contentTypes = options.macro
    ? '<Types>application/vnd.ms-word.document.macroEnabled.main+xml</Types>'
    : '<Types/>';
  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', '<Relationships/>');
  zip.file('docProps/core.xml', '<core/>');
  zip.file('docProps/app.xml', '<app/>');
  zip.file('customXml/item1.xml', '<item/>');
  zip.file('word/document.xml', `<document>Sales Appointment Capture ${Object.entries(metadata)
    .map(([key, value]) => `${key}: ${options.metadataMismatch === key ? 'wrong' : value}`)
    .join(' ')} ${options.placeholder ? '{{PLACEHOLDER}}' : ''}</document>`);
  zip.file('word/_rels/document.xml.rels', options.external
    ? '<Relationships><Relationship Id="rId1" Target="https://example.com/a.png" TargetMode="External"/></Relationships>'
    : '<Relationships><Relationship Id="rId1" Target="media/image1.png"/>'
      + '<Relationship Id="rId2" Target="../customXml/item1.xml"/></Relationships>');
  if (!options.missingImage) zip.file('word/media/image1.png', 'expected-image');
  if (options.unexpectedImage) zip.file('word/media/image2.png', 'unexpected-image');
  if (options.brokenRelationship) {
    zip.file('word/_rels/document.xml.rels', '<Relationships><Relationship Id="rId1" Target="media/missing.png"/></Relationships>');
  }
  if (options.traversal) zip.file('../escape.bin', 'bad');
  if (options.macro) zip.file('word/vbaProject.bin', 'macro');
  await writeFile(path, await zip.generateAsync({ type: 'nodebuffer' }));
}

test('deep DOCX validation accepts safe content and rejects package, relationship, media, metadata, and safety defects', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-validate-docx-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = resolve(root, 'guide.docx');
  await createDocx(path);
  assert.equal((await validateDocxArtifact({
    path,
    metadata,
    expectedImages: [{ hash: await import('node:crypto').then(({ createHash }) => createHash('sha256').update('expected-image').digest('hex')) }],
    allowedAdditionalMedia: 0,
  })).status, 'PASS');
  for (const [variant, pattern] of [
    [{ brokenRelationship: true }, /broken relationship/i],
    [{ external: true }, /external relationship/i],
    [{ missingImage: true }, /missing screenshot/i],
    [{ unexpectedImage: true }, /unexpected.*media/i],
    [{ metadataMismatch: 'Source commit' }, /metadata.*Source commit/i],
    [{ placeholder: true }, /placeholder/i],
    [{ traversal: true }, /path traversal/i],
    [{ macro: true }, /macro/i],
  ]) {
    await createDocx(path, variant);
    assert.equal((await validateDocxArtifact({
      path,
      metadata,
      expectedImages: [{ hash: '8a8f01c48199c6f5f5304e3882b43cf8f4f94c90e8f431dd8be9f6b16c3c9350' }],
      allowedAdditionalMedia: 0,
    })).status, 'FAIL', `expected failure matching ${pattern}`);
  }
  await writeFile(path, 'not zip');
  assert.equal((await validateDocxArtifact({ path, metadata, expectedImages: [] })).status, 'FAIL');
});

test('pdfinfo parsing enforces exact page count, A4 size, and encryption state', () => {
  const parsed = parsePdfInfo('Pages:          17\nPage size:      595.304 x 841.89 pts (A4)\nEncrypted:      no\nPDF version:    1.7\n');
  assert.equal(parsed.pages, 17);
  assert.equal(parsed.encrypted, false);
  assert.match(parsed.pageSize, /A4/);
  assert.throws(() => parsePdfInfo('Pages: unknown\nEncrypted: no\n'), /malformed pdfinfo/i);
  assert.throws(() => parsePdfInfo('Pages: 16\nPage size: A4\nEncrypted: no\n'), /exactly 17/i);
  assert.throws(() => parsePdfInfo('Pages: 17\nPage size: A4\nEncrypted: yes\n'), /encrypted/i);
});

test('PDF validation requires signature, EOF, successful pdfinfo, and exactly 17 pages', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-validate-pdf-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = resolve(root, 'guide.pdf');
  await writeFile(path, '%PDF-1.7\nfixture\n%%EOF\n');
  const validOutput = 'Pages: 17\nPage size: 595.304 x 841.89 pts (A4)\nEncrypted: no\nPDF version: 1.7\n';
  assert.equal((await validatePdfArtifact({
    path,
    pdfinfo: { executable: 'pdfinfo.exe', prefixArgs: [] },
    run: async () => ({ exitCode: 0, signal: null, stdout: validOutput, stderr: '' }),
  })).status, 'PASS');
  assert.equal((await validatePdfArtifact({
    path,
    pdfinfo: { executable: 'pdfinfo.exe', prefixArgs: [] },
    run: async () => ({ exitCode: 2, signal: null, stdout: '', stderr: 'bad pdf' }),
  })).status, 'FAIL');
  await writeFile(path, 'bad');
  assert.equal((await validatePdfArtifact({ path, pdfinfo: {}, run: async () => ({}) })).status, 'FAIL');
  await writeFile(path, '%PDF-1.7\nmissing eof');
  assert.equal((await validatePdfArtifact({ path, pdfinfo: {}, run: async () => ({}) })).status, 'FAIL');
});

test('pixel heuristics classify normal, blank, sparse, black, clipping, and threshold overrides', () => {
  const pixels = (width, height, rgb) => {
    const data = new Uint8Array(width * height * 3);
    for (let index = 0; index < data.length; index += 3) data.set(rgb, index);
    return { width, height, data, channels: 3 };
  };
  const normal = pixels(20, 20, [230, 230, 230]);
  for (let index = 0; index < normal.data.length; index += 15) normal.data.set([30, 40, 50], index);
  assert.equal(analysePixelHeuristics(normal).some(({ status }) => status === 'FAIL'), false);
  assert.equal(analysePixelHeuristics(pixels(20, 20, [255, 255, 255])).some(({ code }) => code === 'VISUAL_BLANK'), true);
  assert.equal(analysePixelHeuristics(pixels(20, 20, [0, 0, 0])).some(({ code }) => code === 'VISUAL_BLACK'), true);
  const sparse = pixels(20, 20, [255, 255, 255]);
  sparse.data.set([0, 0, 0], 30 * 3);
  assert.equal(analysePixelHeuristics(sparse).some(({ code }) => code === 'VISUAL_SPARSE'), true);
  const edge = pixels(20, 20, [255, 255, 255]);
  for (let x = 0; x < 20; x += 1) edge.data.set([0, 0, 0], x * 3);
  assert.equal(analysePixelHeuristics(edge).some(({ code }) => code === 'VISUAL_EDGE'), true);
  assert.equal(analysePixelHeuristics(sparse, {
    ...DEFAULT_VISUAL_THRESHOLDS,
    sparseWhiteRatio: 1,
  }).some(({ code }) => code === 'VISUAL_SPARSE'), false);
});

test('rendering requires exactly 17 ordered valid PNG pages and removes temporary output', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-render-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const validationDir = resolve(root, '.tmp/docs-user-guide/validation');
  const result = await renderPdfPages({
    pdfPath: resolve(root, 'guide.pdf'),
    validationDir,
    renderer: { executable: 'pdftoppm.exe', prefixArgs: [] },
    run: async (_executable, args) => {
      assert.deepEqual(args.slice(0, 3), ['-png', '-r', '96']);
      await mkdir(validationDir, { recursive: true });
      for (let page = 1; page <= 17; page += 1) {
        await writeFile(resolve(validationDir, `page-${String(page).padStart(2, '0')}.png`), createPng(20, 30, [230 - page, 230, 230]));
      }
      return { exitCode: 0, signal: null, stdout: '', stderr: '' };
    },
  });
  assert.equal(result.pages.length, 17);
  assert.equal(result.status, 'WARN');
  await result.cleanup();
  await assert.rejects(stat(validationDir), /ENOENT/);
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type);
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  typeBytes.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return result;
}

function createPng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) Buffer.from(rgb).copy(row, 1 + x * 3);
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
