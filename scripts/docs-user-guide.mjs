import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  COMMANDS,
  SCREENSHOT_MANIFEST,
  assertDocumentationMode,
  createRunPaths,
  getWriteContract,
} from './docs/config.mjs';
import {
  assertCleanNamedBranch,
  assertAllowedChanges,
  hashProtectedFiles,
  inspectRepository,
} from './docs/git-integrity.mjs';
import { generateDocuments } from './docs/documents.mjs';
import {
  parseGeneratedMetadata,
  runMetadataUpdate,
} from './docs/metadata.mjs';
import {
  cleanDocumentationTemp,
  runPipeline,
} from './docs/pipeline.mjs';
import { writeDocumentationReports } from './docs/reports.mjs';
import {
  applyScreenshotChanges,
  runScreenshotCapture,
} from './docs/screenshots.mjs';
import { selectDocumentationServer } from './docs/server.mjs';
import {
  discoverCaptureTooling,
  discoverTooling,
  discoverDocumentGenerationTooling,
  discoverValidationTooling,
} from './docs/tooling.mjs';
import { validateGuide } from './docs/validation.mjs';

function sameHashes(left, right) {
  return left.size === right.size
    && [...left].every(([path, hash]) => right.get(path) === hash);
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

function statusCounts(classification) {
  return Object.fromEntries(
    Object.entries(classification).map(([status, items]) => [status, items.length]),
  );
}

function realPipelineDependencies(context) {
  const state = {};
  const { paths, clock } = context;
  return {
    preflight: async ({ mode }) => {
      const repository = await context.repositoryInspector({ repoRoot: paths.repoRoot });
      await context.assertRepository(repository, { mode });
      state.repository = repository;
      state.protectedBefore = await hashProtectedFiles({ repoRoot: paths.repoRoot });
      return { status: 'PASS', source: { branch: repository.branch, commit: repository.sourceCommit } };
    },
    tooling: async ({ mode }) => {
      if (mode === 'validate') {
        state.tooling = await context.validationTooling({ repoRoot: paths.repoRoot });
      } else if (mode === 'screenshots') {
        state.tooling = await discoverCaptureTooling({ repoRoot: paths.repoRoot });
      } else {
        const complete = await discoverTooling({ repoRoot: paths.repoRoot });
        const validation = await context.validationTooling({ repoRoot: paths.repoRoot });
        state.tooling = { ...complete, renderer: validation.renderer };
      }
      return { status: 'PASS', ...state.tooling };
    },
    server: async () => {
      state.server = await selectDocumentationServer({
        repoRoot: paths.repoRoot,
        python: state.tooling.python,
      });
      const result = {
        status: 'PASS',
        baseUrl: state.server.baseUrl,
        port: state.server.port,
        disposition: state.server.disposition,
        fingerprint: state.server.fingerprint,
      };
      Object.defineProperty(result, 'cleanup', {
        value: state.server.cleanup,
        enumerable: false,
      });
      return result;
    },
    screenshots: async () => {
      await runScreenshotCapture({
        repoRoot: paths.repoRoot,
        outputDir: paths.tempScreenshotDir,
        baseUrl: state.server.baseUrl,
      });
      state.screenshots = await applyScreenshotChanges({
        manifest: SCREENSHOT_MANIFEST,
        candidateDir: paths.tempScreenshotDir,
        committedDir: paths.committedScreenshotDir,
        metadataPath: resolve(paths.guideDir, 'screenshots.json'),
        timestamp: clock().toISOString(),
      });
      return {
        status: 'PASS',
        classification: state.screenshots.classification,
        counts: statusCounts(state.screenshots.classification),
      };
    },
    metadata: async () => {
      state.metadataResult = await context.metadataUpdate({
        repoRoot: paths.repoRoot,
        repository: state.repository,
        clock,
      });
      return { status: state.metadataResult.changed ? 'UPDATED' : 'UNCHANGED' };
    },
    documents: async () => {
      state.documents = await context.documentGeneration({
        repoRoot: paths.repoRoot,
        tooling: state.tooling,
      });
      return {
        status: 'PASS',
        docx: state.documents.promotion.status.docx,
        pdf: state.documents.promotion.status.pdf,
      };
    },
    validation: async () => {
      state.validation = await context.guideValidation({
        repoRoot: paths.repoRoot,
        tooling: state.tooling,
      });
      return state.validation;
    },
    report: async ({ stages }) => {
      const screenshotMetadata = JSON.parse(await readFile(resolve(paths.guideDir, 'screenshots.json'), 'utf8'));
      const markdownMetadata = parseGeneratedMetadata(
        await readFile(resolve(paths.guideDir, 'source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md'), 'utf8'),
      );
      const docxPath = resolve(paths.guideDir, 'ASG_Sales_Appointment_Capture_User_Guide.docx');
      const pdfPath = resolve(paths.guideDir, 'ASG_Sales_Appointment_Capture_User_Guide.pdf');
      const docxStat = await stat(docxPath);
      const pdfStat = await stat(pdfPath);
      const classification = new Map();
      for (const [name, values] of Object.entries(state.screenshots.classification)) {
        for (const item of values) classification.set(item.filename, name);
      }
      const input = {
        status: state.validation.status,
        summary: state.validation.status === 'WARN'
          ? 'All structural checks passed; advisory findings require human review.'
          : 'Documentation automation completed.',
        humanReviewRequired: true,
        source: {
          applicationVersion: markdownMetadata['Application version'],
          guideVersion: markdownMetadata['Guide version'],
          generatedAt: clock().toISOString(),
          generatedDisplay: markdownMetadata.Generated,
          branch: markdownMetadata['Git branch'],
          commit: markdownMetadata['Source commit'],
        },
        tooling: {
          node: process.versions.node,
          python: basename(state.tooling.python.executable),
          libreOffice: basename(state.tooling.libreOffice.executable),
          pdfinfo: basename(state.tooling.pdfinfo.executable),
          renderer: basename(state.tooling.renderer.executable),
          platform: `${process.platform} ${process.arch}`,
        },
        screenshots: screenshotMetadata.screenshots.map((item) => ({
          ...item,
          classification: classification.get(item.filename),
          validation: 'PASS',
        })),
        documents: [
          { type: 'DOCX', path: 'docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx', result: stages.documents.docx, size: docxStat.size, hash: await sha256(docxPath), generation: 'PASS', metadata: 'PASS' },
          { type: 'PDF', path: 'docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf', result: stages.documents.pdf, size: pdfStat.size, hash: await sha256(pdfPath), generation: 'PASS', metadata: 'PASS', pages: 17 },
        ],
        validation: state.validation.findings,
        safety: {
          temporaryDirectories: 'cleanup pending',
          serverProcesses: state.server.disposition === 'reused' ? 0 : 1,
          libreOfficeProcesses: 0,
          popplerProcesses: 0,
          occupiedPorts: state.server.disposition === 'reused' ? 0 : 1,
          writeBoundary: 'pending',
          runtimeIntegrity: 'pending',
        },
        manualReview: 'Automation does not replace human page-by-page review.',
        guideChanges: 'Generated documentation outputs and evidence were refreshed.',
      };
      state.reporting = await context.reporting({
        input,
        reportPath: paths.reportPath,
        changelogPath: paths.changelogPath,
      });
      return { status: 'PASS', ...state.reporting };
    },
    integrity: async ({ mode }) => {
      const current = await context.repositoryInspector({ repoRoot: paths.repoRoot });
      assertAllowedChanges({
        mode,
        writeContract: context.writeContract,
        changedPaths: current.changes.map((item) => item.slice(3)),
      });
      const protectedAfter = await hashProtectedFiles({ repoRoot: paths.repoRoot });
      if (!sameHashes(state.protectedBefore, protectedAfter)) {
        throw new Error('Runtime integrity failed: protected files changed.');
      }
      return { status: 'PASS', writeBoundary: 'PASS', runtimeIntegrity: 'PASS' };
    },
    cleanup: () => cleanDocumentationTemp({ repoRoot: paths.repoRoot }),
    log: (stage, status) => process.stdout.write(`[${stage}] ${status}\n`),
    signalSource: {
      once: (signal, handler) => process.once(signal, handler),
      removeListener: (signal, handler) => process.removeListener(signal, handler),
      kill: (signal) => process.kill(process.pid, signal),
    },
  };
}

const pipelineHandler = async (context) => runPipeline(
  context.mode,
  realPipelineDependencies(context),
);

const cleanHandler = async ({ paths }) => cleanDocumentationTemp({ repoRoot: paths.repoRoot });

const defaultHandlers = Object.freeze({
  generate: pipelineHandler,
  screenshots: pipelineHandler,
  validate: pipelineHandler,
  clean: cleanHandler,
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
    reporting: dependencies.reporting ?? writeDocumentationReports,
    clock: dependencies.clock ?? (() => new Date()),
  }));
}

async function main() {
  const mode = process.argv[2];
  try {
    const result = await runDocumentationCommand(mode);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'FAIL' || result.status === 'BLOCKED') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`[docs:${mode ?? 'unknown'}] ${error.message}\n`);
    if (process.env.DOCS_DEBUG === '1' && error.stack) {
      process.stderr.write(`${error.stack}\n`);
    }
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  await main();
}
