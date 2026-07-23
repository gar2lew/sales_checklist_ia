import { createHash } from 'node:crypto';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

import { runCommand } from './process.mjs';

export const MINIMUM_NODE_MAJOR = 18;

export const REQUIRED_REPOSITORY_INPUTS = Object.freeze([
  'docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md',
  'tests/user-guide-screenshots.spec.mjs',
  'scripts/generate-sales-appointment-user-guide.py',
  'tests/user-guide-artifacts.test.mjs',
]);

function stageError(stage, requirement, remediation, cause) {
  return new Error(
    `${stage} preflight failed: ${requirement}. ${remediation}`,
    cause ? { cause } : undefined,
  );
}

export function assertNodeFeatures(environment = {}) {
  const nodeVersion = environment.nodeVersion ?? process.versions.node;
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(nodeVersion);
  if (!match) {
    throw stageError(
      'Node',
      `"${nodeVersion}" is not a valid Node version`,
      `Install Node ${MINIMUM_NODE_MAJOR} or newer and retry.`,
    );
  }
  if (Number(match[1]) < MINIMUM_NODE_MAJOR) {
    throw stageError(
      'Node',
      `Node ${nodeVersion} is unsupported`,
      `Install Node ${MINIMUM_NODE_MAJOR} or newer and retry.`,
    );
  }
  const suppliedOrDefault = (name, fallback) => (
    Object.hasOwn(environment, name) ? environment[name] : fallback
  );
  const features = [
    ['native fetch', suppliedOrDefault('fetch', globalThis.fetch)],
    ['AbortSignal.timeout', suppliedOrDefault('abortSignalTimeout', globalThis.AbortSignal?.timeout)],
    ['SHA-256 hashing', suppliedOrDefault('createHash', createHash)],
    ['ES modules', suppliedOrDefault('importMetaUrl', import.meta.url)],
  ];
  const missing = features.find(([, value]) => typeof value !== 'function' && typeof value !== 'string');
  if (missing) {
    throw stageError(
      'Node',
      `${missing[0]} is unavailable`,
      `Use a complete Node ${MINIMUM_NODE_MAJOR}+ installation.`,
    );
  }
}

function pythonCandidates(env, platform) {
  if (env.DOCS_PYTHON) {
    return [{ executable: env.DOCS_PYTHON, prefixArgs: [], explicit: true }];
  }
  const candidates = [{ executable: 'python', prefixArgs: [], explicit: false }];
  if (platform === 'win32') {
    candidates.push({ executable: 'py', prefixArgs: ['-3'], explicit: false });
  }
  return candidates;
}

async function validatePythonCandidate(candidate, run) {
  const invoke = (args) => run(
    candidate.executable,
    [...candidate.prefixArgs, ...args],
    { timeoutMs: 15_000 },
  );
  const version = await invoke(['--version']);
  if (version.exitCode !== 0) {
    throw stageError(
      'Python',
      `interpreter "${candidate.executable}" is unavailable`,
      'Set DOCS_PYTHON to a working Python executable or add Python to PATH.',
      new Error(version.stderr.trim() || 'Python executable did not start.'),
    );
  }
  for (const [moduleName, packageName] of [['docx', 'python-docx'], ['PIL', 'Pillow']]) {
    const imported = await invoke(['-c', `import ${moduleName}`]);
    if (imported.exitCode !== 0) {
      throw stageError(
        'Python',
        `required module ${moduleName} (${packageName}) is unavailable in "${candidate.executable}"`,
        `Install ${packageName} into that interpreter and retry.`,
        new Error(imported.stderr.trim() || `Unable to import ${moduleName}.`),
      );
    }
  }
  return Object.freeze({
    executable: candidate.executable,
    prefixArgs: Object.freeze([...candidate.prefixArgs]),
  });
}

export async function discoverPython(options = {}) {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const run = options.run ?? runCommand;
  const failures = [];
  for (const candidate of pythonCandidates(env, platform)) {
    try {
      return await validatePythonCandidate(candidate, run);
    } catch (error) {
      failures.push(error);
      if (candidate.explicit) throw error;
    }
  }
  throw stageError(
    'Python',
    'no usable approved interpreter with docx and PIL was found',
    'Set DOCS_PYTHON, or install python-docx and Pillow for `python`'
      + (platform === 'win32' ? ' or `py -3`.' : '.'),
    failures.at(-1),
  );
}

async function defaultFileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function defaultResolvePlaywright() {
  try {
    return await import('playwright');
  } catch {
    return null;
  }
}

async function defaultFindExecutable(name, options = {}) {
  const run = options.run ?? runCommand;
  const candidates = name === 'libreoffice'
    ? [
      'soffice.com',
      'soffice',
      'libreoffice',
      'C:\\Program Files\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.com',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ]
    : [name];
  for (const executable of candidates) {
    try {
      const versionArgs = name === 'pdfinfo' ? ['-v'] : ['--version'];
      const result = await run(executable, versionArgs, { timeoutMs: 10_000 });
      if (result.exitCode === 0) return { executable, prefixArgs: [] };
    } catch {
      // Continue through the finite approved candidates.
    }
  }
  return null;
}

export async function discoverDocumentGenerationTooling(options = {}) {
  assertNodeFeatures(options.nodeEnvironment);
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const python = await (options.discoverPythonCommand ?? discoverPython)(options);
  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const libreOffice = await findExecutable('libreoffice', options);
  if (!libreOffice) {
    throw stageError(
      'LibreOffice',
      'LibreOffice/soffice was not found',
      'Install LibreOffice or add soffice to PATH, then retry.',
    );
  }
  const fileExists = options.fileExists ?? defaultFileExists;
  for (const relativePath of [
    'docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md',
    'docs/user-guides/screenshots.json',
    'scripts/generate-sales-appointment-user-guide.py',
  ]) {
    if (!await fileExists(resolve(repoRoot, relativePath))) {
      throw stageError(
        'Repository input',
        `required file is missing: ${relativePath}`,
        'Restore the tracked documentation input and retry.',
      );
    }
  }
  return Object.freeze({
    nodeVersion: options.nodeEnvironment?.nodeVersion ?? process.versions.node,
    python,
    libreOffice: Object.freeze(libreOffice),
  });
}

function assertDirectExecutable(executable, label) {
  if (/\.(?:cmd|bat|ps1)$/i.test(executable)) {
    throw stageError(
      label,
      `directly executable binary required; "${executable}" is a wrapper`,
      `Set DOCS_${label === 'pdfinfo' ? 'PDFINFO' : 'PDF_RENDERER'} to a native executable.`,
    );
  }
}

async function validateDirectTool(candidate, label, run) {
  assertDirectExecutable(candidate, label);
  let result;
  try {
    result = await run(candidate, ['-v'], { timeoutMs: 10_000 });
  } catch (cause) {
    throw stageError(
      label,
      `"${candidate}" could not be executed`,
      `Install a native ${label} executable or set its DOCS_* override.`,
      cause,
    );
  }
  if (result.exitCode !== 0) {
    throw stageError(
      label,
      `"${candidate}" exited with code ${result.exitCode}`,
      `Install a working native ${label} executable or set its DOCS_* override.`,
    );
  }
  return Object.freeze({ executable: candidate, prefixArgs: Object.freeze([]) });
}

export async function discoverValidationTooling(options = {}) {
  assertNodeFeatures(options.nodeEnvironment);
  const env = options.env ?? process.env;
  const run = options.run ?? runCommand;
  const pdfinfo = await validateDirectTool(env.DOCS_PDFINFO ?? 'pdfinfo', 'pdfinfo', run);
  const renderer = await validateDirectTool(
    env.DOCS_PDF_RENDERER ?? 'pdftoppm',
    'PDF renderer',
    run,
  );
  return Object.freeze({ pdfinfo, renderer });
}

export async function discoverTooling(options = {}) {
  assertNodeFeatures(options.nodeEnvironment);
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const python = await (options.discoverPythonCommand ?? discoverPython)(options);
  const resolvePlaywright = options.resolvePlaywright ?? defaultResolvePlaywright;
  const playwright = await resolvePlaywright();
  if (!playwright?.chromium?.launch) {
    throw stageError(
      'Playwright',
      'the repository Playwright package is unavailable',
      'Run `npm install` from the repository root and retry.',
    );
  }
  let browser;
  try {
    browser = await playwright.chromium.launch({ headless: true });
    await browser.close();
  } catch (cause) {
    if (browser) await browser.close().catch(() => {});
    throw stageError(
      'Chromium',
      'the installed Playwright Chromium browser is not launchable',
      'Run `npx playwright install chromium` and retry.',
      cause,
    );
  }

  const findExecutable = options.findExecutable ?? defaultFindExecutable;
  const libreOffice = await findExecutable('libreoffice', options);
  if (!libreOffice) {
    throw stageError(
      'LibreOffice',
      'LibreOffice/soffice was not found',
      'Install LibreOffice or add soffice to PATH, then retry.',
    );
  }
  const pdfinfo = await findExecutable('pdfinfo', options);
  if (!pdfinfo) {
    throw stageError(
      'pdfinfo',
      'Poppler pdfinfo was not found',
      'Install Poppler and add pdfinfo to PATH, then retry.',
    );
  }

  const fileExists = options.fileExists ?? defaultFileExists;
  for (const relativePath of REQUIRED_REPOSITORY_INPUTS) {
    if (!await fileExists(resolve(repoRoot, relativePath))) {
      throw stageError(
        'Repository input',
        `required file is missing: ${relativePath}`,
        'Restore the tracked documentation input and retry.',
      );
    }
  }
  return Object.freeze({
    nodeVersion: options.nodeEnvironment?.nodeVersion ?? process.versions.node,
    python,
    playwright: 'available',
    chromium: 'launchable',
    libreOffice: Object.freeze(libreOffice),
    pdfinfo: Object.freeze(pdfinfo),
    requiredInputs: REQUIRED_REPOSITORY_INPUTS,
  });
}
