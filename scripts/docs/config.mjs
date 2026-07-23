import { resolve } from 'node:path';

export const GUIDE_VERSION = '1.0.0';

export const SERVER_DEFAULTS = Object.freeze({
  host: '127.0.0.1',
  preferredPort: 8766,
  firstPort: 8766,
  lastPort: 8776,
  startupTimeoutMs: 15_000,
  pollIntervalMs: 200,
  requestTimeoutMs: 5_000,
  maxResponseBytes: 10 * 1024 * 1024,
  redirect: 'manual',
});

export const COMMANDS = Object.freeze([
  'generate',
  'screenshots',
  'validate',
  'clean',
]);

const screenshot = (filename, width, height, page, captureKey, description) => Object.freeze({
  filename,
  viewport: Object.freeze({ width, height, deviceScaleFactor: 2 }),
  page,
  captureKey,
  description,
});

export const SCREENSHOT_MANIFEST = Object.freeze([
  screenshot(
    '01-appointment-type-selection.png',
    1440,
    900,
    'Landing',
    'appointment-type-selection',
    'Appointment type and staff selection.',
  ),
  screenshot(
    '02-in-person-workspace.png',
    1440,
    900,
    'In-person',
    'in-person-workspace',
    'In-person header, timeline and summary.',
  ),
  screenshot(
    '03-sale-details-mobile.png',
    390,
    844,
    'In-person',
    'sale-details-mobile',
    'Mobile EOI sale details and contract due date.',
  ),
  screenshot(
    '04-zoom-workspace.png',
    844,
    390,
    'Zoom',
    'zoom-workspace',
    'Zoom header and eight-stage timeline.',
  ),
  screenshot(
    '05-zoom-whiteboard.png',
    844,
    390,
    'Zoom',
    'zoom-whiteboard',
    'Consultation whiteboard with deterministic stroke.',
  ),
  screenshot(
    '06-draft-controls.png',
    390,
    844,
    'In-person',
    'draft-controls',
    'Mobile Save Draft and Load Draft controls.',
  ),
  screenshot(
    '07-id-signatures.png',
    1440,
    900,
    'In-person',
    'id-signatures',
    'ID attachment areas and workflow context.',
  ),
  screenshot(
    '08-package-ready.png',
    390,
    844,
    'In-person',
    'package-ready',
    'Appointment Package Ready actions.',
  ),
  screenshot(
    '09-downloads-started.png',
    390,
    844,
    'In-person',
    'downloads-started',
    'Downloads-started handover message.',
  ),
]);

const contracts = Object.freeze({
  generate: Object.freeze({
    committed: Object.freeze(['docs/user-guides/']),
    temporary: Object.freeze(['.tmp/docs-user-guide/']),
    readOnly: false,
    cleanOnly: false,
  }),
  screenshots: Object.freeze({
    committed: Object.freeze([
      'docs/user-guides/screenshots/',
      'docs/user-guides/screenshots.json',
      'docs/user-guides/documentation-report.md',
    ]),
    temporary: Object.freeze(['.tmp/docs-user-guide/']),
    readOnly: false,
    cleanOnly: false,
  }),
  validate: Object.freeze({
    committed: Object.freeze([]),
    temporary: Object.freeze([]),
    readOnly: true,
    cleanOnly: false,
  }),
  clean: Object.freeze({
    committed: Object.freeze([]),
    temporary: Object.freeze(['.tmp/docs-user-guide/']),
    readOnly: false,
    cleanOnly: true,
  }),
});

export function assertDocumentationMode(mode) {
  if (!COMMANDS.includes(mode)) {
    throw new Error(`Unknown documentation mode: ${mode}`);
  }
  return mode;
}

export function getWriteContract(mode) {
  assertDocumentationMode(mode);
  return contracts[mode];
}

export function createRunPaths(repositoryRoot) {
  const repoRoot = resolve(repositoryRoot);
  const guideDir = resolve(repoRoot, 'docs/user-guides');
  const tempRoot = resolve(repoRoot, '.tmp/docs-user-guide');
  return Object.freeze({
    repoRoot,
    guideDir,
    committedScreenshotDir: resolve(guideDir, 'screenshots'),
    tempRoot,
    tempScreenshotDir: resolve(tempRoot, 'screenshots'),
    reportPath: resolve(guideDir, 'documentation-report.md'),
    changelogPath: resolve(guideDir, 'changelog.md'),
  });
}
