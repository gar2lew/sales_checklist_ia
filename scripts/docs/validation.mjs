import { createHash } from 'node:crypto';
import {
  mkdir,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { posix, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

import JSZip from 'jszip';

import { validateGenerationInputs } from './documents.mjs';
import { runCommand } from './process.mjs';

const STATUS_ORDER = Object.freeze({ PASS: 0, WARN: 1, FAIL: 2 });
export const EXPECTED_PDF_PAGES = 17;
export const PDF_RENDER_DPI = 96;
export const DEFAULT_VISUAL_THRESHOLDS = Object.freeze({
  blankWhiteRatio: 0.999,
  sparseWhiteRatio: 0.98,
  blackRatio: 0.995,
  edgeContentRatio: 0.2,
  whiteChannelMinimum: 250,
  blackChannelMaximum: 5,
});

function finding(status, stage, code, message, remediation, evidence = {}, path) {
  return Object.freeze({
    status,
    stage,
    code,
    message,
    remediation,
    evidence: Object.freeze({ ...evidence }),
    ...(path ? { path } : {}),
  });
}

function pass(stage, code, message, evidence = {}, path) {
  return finding('PASS', stage, code, message, 'No action required.', evidence, path);
}

function fail(stage, code, message, remediation, evidence = {}, path) {
  return finding('FAIL', stage, code, message, remediation, evidence, path);
}

function warn(stage, code, message, remediation, evidence = {}, path) {
  return finding('WARN', stage, code, message, remediation, evidence, path);
}

export function aggregateValidationFindings(findings) {
  const ordered = [...findings].sort((left, right) => (
    left.stage.localeCompare(right.stage)
    || left.code.localeCompare(right.code)
    || (left.path ?? '').localeCompare(right.path ?? '')
  ));
  const status = ordered.reduce(
    (current, item) => (
      STATUS_ORDER[item.status] > STATUS_ORDER[current] ? item.status : current
    ),
    'PASS',
  );
  return Object.freeze({
    status,
    findings: Object.freeze(ordered),
    humanReviewRequired: true,
    humanReviewStatement:
      'Automated heuristics detect obvious corruption only; human page-by-page visual review remains required.',
  });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function xmlAttribute(source, name) {
  return new RegExp(`${name}="([^"]+)"`).exec(source)?.[1] ?? null;
}

export async function validateDocxArtifact(options = {}) {
  const findings = [];
  let bytes;
  try {
    bytes = await readFile(options.path);
  } catch (cause) {
    return aggregateValidationFindings([
      fail('docx', 'DOCX_MISSING', 'The canonical DOCX is missing.', 'Regenerate the guide.', {
        cause: cause.message,
      }, options.path),
    ]);
  }
  if (bytes.length === 0 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return aggregateValidationFindings([
      fail('docx', 'DOCX_ZIP', 'The DOCX is not a readable ZIP package.', 'Regenerate the DOCX.', {}, options.path),
    ]);
  }
  let zip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch (cause) {
    return aggregateValidationFindings([
      fail('docx', 'DOCX_ZIP', 'The DOCX ZIP package is corrupt.', 'Regenerate the DOCX.', {
        cause: cause.message,
      }, options.path),
    ]);
  }
  const names = Object.keys(zip.files);
  if (names.some((name) => (
    name.startsWith('/')
    || name.startsWith('\\')
    || name.split(/[\\/]/).includes('..')
  ))) {
    findings.push(fail('docx', 'DOCX_TRAVERSAL', 'The DOCX contains a path traversal entry.', 'Remove unsafe ZIP entries.'));
  }
  const required = [
    '[Content_Types].xml',
    '_rels/.rels',
    'word/document.xml',
    'word/_rels/document.xml.rels',
    'docProps/core.xml',
    'docProps/app.xml',
  ];
  for (const name of required) {
    if (!zip.file(name)) {
      findings.push(fail('docx', 'DOCX_REQUIRED_ENTRY', `Required OOXML entry is missing: ${name}`, 'Regenerate the DOCX.', { entry: name }));
    }
  }
  const contentTypes = zip.file('[Content_Types].xml')
    ? await zip.file('[Content_Types].xml').async('string')
    : '';
  if (/macroEnabled|vbaProject/i.test(contentTypes) || names.some((name) => /vbaProject\.bin$/i.test(name))) {
    findings.push(fail('docx', 'DOCX_MACRO', 'The guide package contains macro-enabled content.', 'Use a macro-free DOCX package.'));
  }
  const relationships = zip.file('word/_rels/document.xml.rels')
    ? await zip.file('word/_rels/document.xml.rels').async('string')
    : '';
  for (const match of relationships.matchAll(/<Relationship\b[^>]*>/g)) {
    const target = xmlAttribute(match[0], 'Target');
    const targetMode = xmlAttribute(match[0], 'TargetMode');
    if (targetMode === 'External') {
      findings.push(fail('docx', 'DOCX_EXTERNAL_REL', `External relationship is not allowed: ${target}`, 'Embed guide resources inside the DOCX.'));
    } else if (target) {
      const normalized = target.replaceAll('\\', '/');
      const packageTarget = posix.normalize(posix.join('word', normalized));
      if (!zip.file(packageTarget)) {
        findings.push(fail('docx', 'DOCX_BROKEN_REL', `Broken relationship target: ${target}`, 'Regenerate the DOCX relationships.'));
      }
    }
  }
  const documentXml = zip.file('word/document.xml')
    ? await zip.file('word/document.xml').async('string')
    : '';
  if (!documentXml.includes('Sales Appointment Capture')) {
    findings.push(fail('docx', 'DOCX_TITLE', 'The guide title is missing.', 'Regenerate from canonical Markdown.'));
  }
  for (const [label, value] of Object.entries(options.metadata ?? {})) {
    if (!value || !documentXml.includes(value)) {
      findings.push(fail('docx', 'DOCX_METADATA', `DOCX metadata mismatch: ${label}`, 'Regenerate from the canonical metadata block.', { label }));
    }
  }
  if (/!\[[^\]]*]\([^)]+\)|\{\{[^}]+}}|\b(?:TODO|TBD)\b/i.test(documentXml)) {
    findings.push(fail('docx', 'DOCX_PLACEHOLDER', 'The DOCX contains unresolved source syntax or a placeholder.', 'Resolve the source content before generation.'));
  }
  const media = await Promise.all(names
    .filter((name) => /^word\/media\/[^/]+$/.test(name))
    .map(async (name) => ({ name, hash: sha256(await zip.file(name).async('nodebuffer')) })));
  const expectedHashes = new Set((options.expectedImages ?? []).map(({ hash }) => hash));
  for (const hash of expectedHashes) {
    if (!media.some((entry) => entry.hash === hash)) {
      findings.push(fail('docx', 'DOCX_SCREENSHOT_MISSING', 'An approved screenshot is missing from the DOCX.', 'Regenerate with all approved screenshots.', { hash }));
    }
  }
  const unexpectedCount = media.filter(({ hash }) => !expectedHashes.has(hash)).length;
  if (unexpectedCount > (options.allowedAdditionalMedia ?? 1)) {
    findings.push(fail('docx', 'DOCX_MEDIA_UNEXPECTED', 'The DOCX contains unexpected guide media.', 'Review and remove undeclared media.', { unexpectedCount }));
  }
  if (findings.length === 0) {
    findings.push(pass('docx', 'DOCX_VALID', 'DOCX structure, metadata, relationships, and media are valid.', {
      mediaCount: media.length,
    }, options.path));
  }
  return aggregateValidationFindings(findings);
}

export function parsePdfInfo(output) {
  const values = new Map();
  for (const line of output.split(/\r?\n/)) {
    const match = /^([^:]+):\s*(.*)$/.exec(line);
    if (match) values.set(match[1].trim(), match[2].trim());
  }
  const pages = Number(values.get('Pages'));
  const encryptedValue = values.get('Encrypted');
  const pageSize = values.get('Page size');
  if (!Number.isInteger(pages) || !encryptedValue || !pageSize) {
    throw new Error('Malformed pdfinfo output.');
  }
  if (pages !== EXPECTED_PDF_PAGES) {
    throw new Error(`PDF must contain exactly ${EXPECTED_PDF_PAGES} pages; found ${pages}.`);
  }
  if (!/^no\b/i.test(encryptedValue)) {
    throw new Error('PDF must not be encrypted.');
  }
  if (!/A4|595(?:\.\d+)?\s+x\s+841(?:\.\d+)?/i.test(pageSize)) {
    throw new Error(`PDF page size is not the approved A4 layout: ${pageSize}.`);
  }
  return Object.freeze({
    pages,
    encrypted: false,
    pageSize,
    pdfVersion: values.get('PDF version') ?? '',
  });
}

export async function validatePdfArtifact(options = {}) {
  let bytes;
  try {
    bytes = await readFile(options.path);
  } catch (cause) {
    return aggregateValidationFindings([
      fail('pdf', 'PDF_MISSING', 'The canonical PDF is missing.', 'Regenerate the guide.', { cause: cause.message }, options.path),
    ]);
  }
  if (bytes.length === 0 || bytes.subarray(0, 5).toString() !== '%PDF-') {
    return aggregateValidationFindings([
      fail('pdf', 'PDF_SIGNATURE', 'The PDF signature is invalid.', 'Regenerate the PDF.', {}, options.path),
    ]);
  }
  if (!bytes.subarray(Math.max(0, bytes.length - 2048)).includes(Buffer.from('%%EOF'))) {
    return aggregateValidationFindings([
      fail('pdf', 'PDF_EOF', 'The PDF trailing EOF marker is missing.', 'Regenerate the PDF.', {}, options.path),
    ]);
  }
  const run = options.run ?? runCommand;
  let result;
  try {
    result = await run(
      options.pdfinfo.executable,
      [...(options.pdfinfo.prefixArgs ?? []), options.path],
      { shell: false, timeoutMs: 30_000, maxOutputBytes: 1024 * 1024 },
    );
  } catch (cause) {
    return aggregateValidationFindings([
      fail('pdf', 'PDFINFO_EXECUTION', 'pdfinfo could not be executed.', 'Provide a directly executable pdfinfo binary.', { cause: cause.message }),
    ]);
  }
  if (result.exitCode !== 0) {
    return aggregateValidationFindings([
      fail('pdf', 'PDFINFO_EXIT', `pdfinfo exited with code ${result.exitCode}.`, 'Repair or regenerate the PDF.', {
        stderr: result.stderr,
      }),
    ]);
  }
  try {
    const info = parsePdfInfo(result.stdout);
    return aggregateValidationFindings([
      pass('pdf', 'PDF_VALID', 'PDF structure and Poppler metadata are valid.', info, options.path),
    ]);
  } catch (cause) {
    return aggregateValidationFindings([
      fail('pdf', 'PDFINFO_CONTRACT', cause.message, 'Regenerate the approved 17-page, unencrypted A4 PDF.'),
    ]);
  }
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

export function decodePng(bytes) {
  if (bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Invalid PNG signature.');
  }
  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  const compressed = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      compressed.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : null;
  if (!width || !height || bitDepth !== 8 || !channels || compressed.length === 0) {
    throw new Error('Unsupported or malformed PNG.');
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * channels);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[sourceOffset];
    sourceOffset += 1;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[sourceOffset + column];
      const target = row * stride + column;
      const left = column >= channels ? pixels[target - channels] : 0;
      const above = row > 0 ? pixels[target - stride] : 0;
      const upperLeft = row > 0 && column >= channels ? pixels[target - stride - channels] : 0;
      if (filter === 0) pixels[target] = value;
      else if (filter === 1) pixels[target] = (value + left) & 0xff;
      else if (filter === 2) pixels[target] = (value + above) & 0xff;
      else if (filter === 3) pixels[target] = (value + Math.floor((left + above) / 2)) & 0xff;
      else if (filter === 4) pixels[target] = (value + paeth(left, above, upperLeft)) & 0xff;
      else throw new Error(`Unsupported PNG filter: ${filter}`);
    }
    sourceOffset += stride;
  }
  return { width, height, data: pixels, channels };
}

export function analysePixelHeuristics(image, thresholds = DEFAULT_VISUAL_THRESHOLDS) {
  const findings = [];
  const count = image.width * image.height;
  let white = 0;
  let black = 0;
  let sum = 0;
  let sumSquares = 0;
  let edgeContent = 0;
  let edgeCount = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = index * image.channels;
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    sum += luminance;
    sumSquares += luminance * luminance;
    if (red >= thresholds.whiteChannelMinimum && green >= thresholds.whiteChannelMinimum && blue >= thresholds.whiteChannelMinimum) white += 1;
    if (red <= thresholds.blackChannelMaximum && green <= thresholds.blackChannelMaximum && blue <= thresholds.blackChannelMaximum) black += 1;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    if (x === 0 || y === 0 || x === image.width - 1 || y === image.height - 1) {
      edgeCount += 1;
      if (luminance < thresholds.whiteChannelMinimum) edgeContent += 1;
    }
  }
  const whiteRatio = white / count;
  const blackRatio = black / count;
  const variance = sumSquares / count - (sum / count) ** 2;
  if (whiteRatio >= thresholds.blankWhiteRatio && variance < 1) {
    findings.push(fail('visual', 'VISUAL_BLANK', 'Rendered page appears blank.', 'Inspect generation and page content.', { whiteRatio, variance }));
  } else if (whiteRatio >= thresholds.sparseWhiteRatio) {
    findings.push(warn('visual', 'VISUAL_SPARSE', 'Rendered page is unusually sparse.', 'Review the page manually.', { whiteRatio, variance }));
  }
  if (blackRatio >= thresholds.blackRatio) {
    findings.push(fail('visual', 'VISUAL_BLACK', 'Rendered page appears almost entirely black.', 'Inspect PDF rendering.', { blackRatio }));
  }
  const edgeRatio = edgeCount ? edgeContent / edgeCount : 0;
  if (edgeRatio >= thresholds.edgeContentRatio) {
    findings.push(warn('visual', 'VISUAL_EDGE', 'Content contacts a large portion of the page edge.', 'Review possible clipping manually.', { edgeRatio }));
  }
  return findings;
}

export async function renderPdfPages(options = {}) {
  const validationDir = resolve(options.validationDir);
  await rm(validationDir, { recursive: true, force: true });
  await mkdir(validationDir, { recursive: true });
  const prefix = resolve(validationDir, 'page');
  const run = options.run ?? runCommand;
  const cleanup = () => rm(validationDir, { recursive: true, force: true });
  try {
    const result = await run(
      options.renderer.executable,
      [...(options.renderer.prefixArgs ?? []), '-png', '-r', String(PDF_RENDER_DPI), options.pdfPath, prefix],
      { shell: false, timeoutMs: 120_000, maxOutputBytes: 1024 * 1024 },
    );
    if (result.exitCode !== 0) {
      await cleanup();
      return { ...aggregateValidationFindings([
        fail('render', 'RENDER_EXIT', `PDF renderer exited with code ${result.exitCode}.`, 'Verify Poppler and the PDF.', { stderr: result.stderr }),
      ]), pages: [], cleanup };
    }
    const names = (await readdir(validationDir))
      .filter((name) => /^page-\d+\.png$/.test(name))
      .sort((left, right) => left.localeCompare(right));
    if (names.length !== EXPECTED_PDF_PAGES) {
      await cleanup();
      return { ...aggregateValidationFindings([
        fail('render', 'RENDER_COUNT', `Expected ${EXPECTED_PDF_PAGES} rendered pages; found ${names.length}.`, 'Inspect the renderer output.'),
      ]), pages: [], cleanup };
    }
    const pages = [];
    const findings = [];
    const hashes = new Map();
    let dimensions;
    for (const name of names) {
      const path = resolve(validationDir, name);
      try {
        const bytes = await readFile(path);
        const image = decodePng(bytes);
        dimensions ??= { width: image.width, height: image.height };
        if (image.width !== dimensions.width || image.height !== dimensions.height) {
          findings.push(fail('render', 'RENDER_DIMENSIONS', 'Rendered page dimensions are inconsistent.', 'Render every page at the same DPI.', {
            expected: dimensions,
            actual: { width: image.width, height: image.height },
          }, path));
        }
        const hash = sha256(bytes);
        if (hashes.has(hash)) {
          findings.push(fail('render', 'RENDER_DUPLICATE', `Rendered page duplicates ${hashes.get(hash)}.`, 'Inspect PDF generation for duplicate pages.', {}, path));
        } else {
          hashes.set(hash, name);
        }
        findings.push(...analysePixelHeuristics(image).map((item) => Object.freeze({ ...item, path })));
        pages.push(Object.freeze({ name, path, hash, width: image.width, height: image.height }));
      } catch (cause) {
        findings.push(fail('render', 'RENDER_PNG', `Rendered page is not a valid PNG: ${name}`, 'Repair the renderer output.', { cause: cause.message }, path));
      }
    }
    if (!findings.some(({ status }) => status === 'FAIL')) {
      findings.push(pass('render', 'RENDER_COMPLETE', `All ${EXPECTED_PDF_PAGES} PDF pages rendered successfully.`, dimensions));
    }
    const aggregate = aggregateValidationFindings(findings);
    return { ...aggregate, pages: Object.freeze(pages), cleanup };
  } catch (cause) {
    await cleanup();
    return { ...aggregateValidationFindings([
      fail('render', 'RENDER_EXECUTION', 'PDF renderer could not be executed.', 'Provide a directly executable Poppler renderer.', { cause: cause.message }),
    ]), pages: [], cleanup };
  }
}

export async function validateGuide(options = {}) {
  const inputs = await validateGenerationInputs(options);
  const expectedImages = await Promise.all(inputs.screenshotNames.map(async (filename) => ({
    filename,
    hash: sha256(await readFile(resolve(inputs.screenshotDir, filename))),
  })));
  const docx = await validateDocxArtifact({
    path: resolve(inputs.guideDir, 'ASG_Sales_Appointment_Capture_User_Guide.docx'),
    metadata: inputs.metadata,
    expectedImages,
    allowedAdditionalMedia: 1,
  });
  const pdfPath = resolve(inputs.guideDir, 'ASG_Sales_Appointment_Capture_User_Guide.pdf');
  const pdf = await validatePdfArtifact({
    path: pdfPath,
    pdfinfo: options.tooling.pdfinfo,
    run: options.run,
  });
  const render = await renderPdfPages({
    pdfPath,
    validationDir: resolve(inputs.repoRoot, '.tmp/docs-user-guide/validation'),
    renderer: options.tooling.renderer,
    run: options.run,
  });
  const findings = [
    pass('markdown', 'MARKDOWN_VALID', 'Canonical Markdown metadata, links, screenshots, and hashes are valid.'),
    ...docx.findings,
    ...pdf.findings,
    ...render.findings,
  ];
  await render.cleanup();
  return aggregateValidationFindings(findings);
}
