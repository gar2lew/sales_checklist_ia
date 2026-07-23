# Documentation Automation v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows-first, one-command documentation pipeline that safely regenerates the Sales Appointment Capture guide screenshots, metadata, DOCX, PDF, report and changelog without modifying runtime application behaviour.

**Architecture:** `scripts/docs-user-guide.mjs` is the only public orchestrator. Focused ES modules under `scripts/docs/` provide injectable Git/tooling preflight, server ownership, screenshot hashing, metadata, validation, reporting and cleanup services; the existing Playwright capture and Python DOCX/PDF generator remain the rendering engines.

**Tech Stack:** Node.js ES modules and built-in APIs, Playwright 1.61.1, Python 3 with `python-docx` and Pillow, LibreOffice, Poppler `pdfinfo`, Git, SHA-256, Windows PowerShell-compatible npm commands.

## Global Constraints

- Approved specification: `docs/superpowers/specs/2026-07-22-documentation-automation-v1-design.md` at commit `3afbc94d76cbef98d72bdf5e230bf5a10d75c172`; do not modify it.
- Accept any clean named Git branch and reject detached HEAD.
- `docs:user-guide`, `docs:screenshots` and `docs:validate` require a completely clean worktree before starting; `docs:clean` is the only exception.
- Documentation commands never stage or commit files.
- During command execution, committed changes are permitted only within each command's approved `docs/user-guides/**` allowlist; temporary changes are permitted only under `.tmp/docs-user-guide/**`.
- Any command-time modification to `package.json`, `scripts/**`, `tests/**`, runtime files or any other non-allowlisted path fails.
- Preserve application version `2.7.0-alpha.1` and service-worker cache `v2.7.0-alpha.21`.
- Do not change runtime application behaviour, workflows, generated appointment documents, package logic, service-worker strategy or production configuration.
- Use only fictional demonstration data in captures.
- Do not add dependencies; use existing Node/Playwright packages and external Python, LibreOffice and Poppler tooling.
- Create exactly one implementation commit after all verification: `docs: automate user guide pipeline`.
- Do not push, merge or deploy.

---

# Overview

## Overall architecture

The public Node orchestrator parses one of four modes, constructs an immutable run context, and delegates to narrow helpers. All helpers receive dependencies such as clocks, executable paths, fetch and spawn functions through explicit parameters so unit tests can exercise failure paths without changing the developer environment.

```text
package.json command
  -> scripts/docs-user-guide.mjs
     -> config.mjs
     -> preflight.mjs + git-integrity.mjs
     -> server.mjs
     -> existing Playwright capture
     -> screenshots.mjs
     -> metadata.mjs
     -> existing Python generator
     -> validation.mjs
     -> reports.mjs
     -> cleanup.mjs in finally
```

## Public commands

| Command | Mode | Write contract |
|---|---|---|
| `npm run docs:user-guide` | `generate` | Declared outputs under `docs/user-guides/**` and `.tmp/docs-user-guide/**` only. |
| `npm run docs:screenshots` | `screenshots` | Screenshot PNGs, `screenshots.json`, screenshot report data and temporary files only. |
| `npm run docs:validate` | `validate` | Read-only; before/after repository hashes must match. |
| `npm run docs:clean` | `clean` | Remove only the verified `.tmp/docs-user-guide/` tree. |

## Complete orchestration flow

1. Parse mode and environment.
2. For all modes except `clean`, verify named branch and clean worktree.
3. Record Source branch, Source commit and protected-file hashes.
4. Verify Node features and mode-specific external tools.
5. For capture modes, reuse a fingerprint-matching server or start an owned Python server.
6. Capture all manifest-declared screenshots into `.tmp/docs-user-guide/screenshots/`.
7. Validate the complete candidate set before changing committed screenshots.
8. Classify UNCHANGED, UPDATED, NEW and intentional REMOVED screenshots by SHA-256.
9. Apply the mode-specific screenshot and metadata writes.
10. For `generate`, update only the canonical Markdown metadata block and invoke the existing Python generator.
11. Validate screenshots, links, DOCX, PDF, metadata and runtime integrity.
12. Generate the permitted report data and, for `generate`, the changelog.
13. Enforce the command's final changed-path allowlist.
14. In `finally`, stop only an owned server and remove only owned temporary files.

## Retained existing components

- `tests/user-guide-screenshots.spec.mjs`: retains workflow navigation and image capture.
- `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`: remains canonical guide content.
- `scripts/generate-sales-appointment-user-guide.py`: retains DOCX construction and LibreOffice PDF export.
- `tests/user-guide-artifacts.test.mjs`: retains guide artifact and privacy contracts.

## New helper modules

- `scripts/docs/config.mjs`: constants, paths, screenshot manifest and command allowlists.
- `scripts/docs/process.mjs`: direct spawn/exec helpers with bounded output and injectable execution.
- `scripts/docs/git-integrity.mjs`: branch/tree preflight, Source revision and path/hash integrity.
- `scripts/docs/tooling.mjs`: Node feature, Python, Playwright, LibreOffice and `pdfinfo` discovery.
- `scripts/docs/server.mjs`: port discovery, fingerprints, readiness and owned process cleanup.
- `scripts/docs/screenshots.mjs`: candidate verification, hashing, classification, metadata and atomic replacement.
- `scripts/docs/metadata.mjs`: Markdown metadata parsing/replacement and version extraction.
- `scripts/docs/validation.mjs`: PNG, Markdown, DOCX, PDF, README and cross-artifact validation.
- `scripts/docs/reports.mjs`: deterministic report structure and defensive changelog replacement.
- `scripts/docs/cleanup.mjs`: real-path/lstat/reparse-safe temporary cleanup.

---

# Phase Breakdown

## Phase 1 — Foundation

### Purpose

Establish command routing, immutable configuration and authoritative screenshot declarations without changing existing capture or generation behaviour.

### Files

- Create `scripts/docs-user-guide.mjs`.
- Create `scripts/docs/config.mjs`.
- Create `scripts/docs/process.mjs`.
- Create `tests/documentation-automation.test.mjs`.
- Modify `package.json` only during implementation to add the four commands.
- Modify `.gitignore` only during implementation to ignore `.tmp/docs-user-guide/`.

### Interfaces

```js
// config.mjs
export const GUIDE_VERSION = '1.0.0';
export const COMMANDS = Object.freeze(['generate', 'screenshots', 'validate', 'clean']);
export const SCREENSHOT_MANIFEST: readonly ScreenshotManifestEntry[];
export function createRunPaths(repoRoot: string): RunPaths;
export function getWriteContract(mode: DocumentationMode): WriteContract;

// process.mjs
export async function runCommand(executable: string, args: string[], options?: RunOptions): Promise<CommandResult>;
export function spawnDirect(executable: string, args: string[], options?: SpawnOptions): ChildProcess;

// docs-user-guide.mjs
export async function runDocumentationCommand(mode: DocumentationMode, dependencies?: Dependencies): Promise<RunResult>;
```

Each screenshot manifest entry declares `filename`, `viewport`, `page`, `description` and capture key:

| Filename | Viewport | Page | Capture key | Description |
|---|---|---|---|---|
| `01-appointment-type-selection.png` | 1440×900 @2 | Landing | `appointment-type-selection` | Appointment type and staff selection. |
| `02-in-person-workspace.png` | 1440×900 @2 | In-person | `in-person-workspace` | In-person header, timeline and summary. |
| `03-sale-details-mobile.png` | 390×844 @2 | In-person | `sale-details-mobile` | Mobile EOI sale details and contract due date. |
| `04-zoom-workspace.png` | 844×390 @2 | Zoom | `zoom-workspace` | Zoom header and eight-stage timeline. |
| `05-zoom-whiteboard.png` | 844×390 @2 | Zoom | `zoom-whiteboard` | Consultation whiteboard with deterministic stroke. |
| `06-draft-controls.png` | 390×844 @2 | In-person | `draft-controls` | Mobile Save Draft and Load Draft controls. |
| `07-id-signatures.png` | 1440×900 @2 | In-person | `id-signatures` | ID attachment areas and workflow context. |
| `08-package-ready.png` | 390×844 @2 | In-person | `package-ready` | Appointment Package Ready actions. |
| `09-downloads-started.png` | 390×844 @2 | In-person | `downloads-started` | Downloads-started handover message. |

### Dependencies

None beyond the approved specification and current repository structure.

### Test-first steps

- [ ] Add failing tests that invalid modes are rejected, all four modes route to distinct handlers, paths resolve beneath the repository and manifest filenames are sorted and unique.
- [ ] Run `node tests/documentation-automation.test.mjs`; expect failure because `scripts/docs/config.mjs` and the orchestrator do not exist.
- [ ] Implement the exported constants, run-path resolver, write contracts and direct process helpers with bounded stdout/stderr capture.
- [ ] Add the four exact npm scripts, all invoking `node scripts/docs-user-guide.mjs <mode>`.
- [ ] Add `.tmp/docs-user-guide/` to `.gitignore` without ignoring other `.tmp` content.
- [ ] Re-run the focused test; expect all Phase 1 assertions to pass.

### Expected tests

- Public command mapping.
- Unknown mode failure.
- Stable screenshot manifest order and uniqueness.
- Safe path creation.
- Direct-spawn argument preservation without a shell.

### Risks and mitigation

- **Risk:** CommonJS package mode interferes with ES modules. **Mitigation:** use `.mjs` for every new Node module and import with explicit file extensions.
- **Risk:** Command allowlists drift. **Mitigation:** define them once in `config.mjs` and assert exact values.

### Acceptance criteria

- Four npm commands resolve to the one orchestrator.
- No command performs generation yet.
- Foundation tests pass without runtime file changes.

## Phase 2 — Git and Tooling Preflight

### Purpose

Reject unsafe repository state or unsupported tooling before any documentation output is written.

### Files

- Create `scripts/docs/git-integrity.mjs`.
- Create `scripts/docs/tooling.mjs`.
- Extend `tests/documentation-automation.test.mjs`.

### Interfaces

```js
export async function inspectRepository(options: RepositoryInspectionOptions): Promise<RepositoryContext>;
export async function assertCleanNamedBranch(context: RepositoryContext): Promise<void>;
export async function hashProtectedFiles(options: ProtectedHashOptions): Promise<Map<string, string>>;
export async function assertAllowedChanges(options: AllowedChangeOptions): Promise<void>;
export async function assertNodeFeatures(environment?: object): Promise<void>;
export async function discoverPython(options: PythonDiscoveryOptions): Promise<ToolCommand>;
export async function discoverTooling(options: ToolDiscoveryOptions): Promise<Tooling>;
```

Protected-file discovery uses `git ls-files -z`, explicit runtime roots and SHA-256 content hashes. It records missing, added and removed paths, not timestamps.

### Dependencies

Phase 1 process helpers and command configuration.

### Test-first steps

- [ ] Create temporary Git repositories in tests and write failing cases for named clean branch acceptance, detached HEAD, tracked/untracked dirt, and Source revision capture.
- [ ] Add failing cases for unsupported Node version/features, `DOCS_PYTHON`, `python`, Windows `py -3` precedence, missing `docx`/`PIL`, missing Playwright/Chromium, missing LibreOffice and missing `pdfinfo`.
- [ ] Add failing cases proving allowed documentation changes pass while modifications to `package.json`, `scripts/**`, `tests/**`, runtime roots and arbitrary paths fail.
- [ ] Run the focused test; expect missing-module failures.
- [ ] Implement Git inspection with NUL-delimited parsing and friendly stage-prefixed errors.
- [ ] Implement tool discovery with injected command execution and no Codex-runtime fallback.
- [ ] Implement protected hashes and command-specific final change enforcement.
- [ ] Re-run focused tests; expect all preflight and integrity cases to pass.

### Expected tests

- Named clean branch accepted.
- Detached HEAD rejected.
- Dirty tracked, staged and untracked paths rejected.
- Unsupported Node version and each missing feature rejected.
- Python precedence and import validation.
- Playwright browser launch validation.
- LibreOffice and Poppler validation.
- Runtime and non-allowlisted mutation detection.

### Risks and mitigation

- **Risk:** Git paths contain spaces or non-ASCII text. **Mitigation:** use `-z` output and Buffer-safe decoding.
- **Risk:** Windows `py -3` requires a prefix argument. **Mitigation:** represent tools as `{executable, prefixArgs}` rather than shell strings.
- **Risk:** validation mode accidentally writes. **Mitigation:** compare complete tracked/untracked snapshots before and after it.

### Acceptance criteria

- No capture/generation starts unless branch, tree and mode-specific tools pass.
- Source branch and full Source commit are available to downstream phases.
- Protected-file hashes detect byte changes.

## Phase 3 — Server Lifecycle

### Purpose

Safely reuse only a server that serves the current checkout, otherwise start and clean up a pipeline-owned server.

### Files

- Create `scripts/docs/server.mjs`.
- Extend `tests/documentation-automation.test.mjs`.
- Create `tests/documentation-pipeline.integration.test.mjs` for real HTTP/process tests.

### Interfaces

```js
export const FINGERPRINT_PATHS = Object.freeze([
  'index.html', 'css/app.css', 'js/app.js',
  'manifest.webmanifest', 'service-worker.js'
]);
export async function buildLocalFingerprint(options: FingerprintOptions): Promise<Map<string, string>>;
export async function fetchBounded(url: URL, options: BoundedFetchOptions): Promise<Buffer>;
export async function compareServerFingerprint(options: ServerFingerprintOptions): Promise<FingerprintResult>;
export async function selectDocumentationServer(options: ServerSelectionOptions): Promise<DocumentationServer>;
export async function waitForReady(options: ReadinessOptions): Promise<void>;
export async function stopOwnedServer(options: StopServerOptions): Promise<void>;
```

`selectDocumentationServer` returns `{baseUrl, disposition, child}` where disposition is `reused` or `pipeline-owned`. Defaults are port `8766`, range `8766..8776`, 15-second readiness timeout, 200-millisecond interval and 10 MiB per fingerprint response.

### Dependencies

Phases 1–2 process, paths and selected Python command.

### Test-first steps

- [ ] Add failing unit tests for `DOCS_BASE_URL`, `DOCS_PORT`, default range, invalid URL/port, redirects, oversized response and all fingerprint mismatch paths.
- [ ] Add failing integration tests using temporary local servers for delayed HTTP 200 readiness, matching reuse, mismatched-server preservation and range fallback.
- [ ] Add a child fixture process and failing tests proving success/failure cleanup stops an owned process while a reused process remains alive.
- [ ] Add a Windows-specific injected assertion for `taskkill.exe /PID <pid> /T /F`; do not kill an unrelated real process in tests.
- [ ] Run both automation test suites; expect missing server-module failures.
- [ ] Implement manual-redirect bounded fetching and cache-busting fingerprint comparisons.
- [ ] Implement direct Python server spawn from repository root and sequential readiness probes.
- [ ] Implement owned-process cleanup in a `finally`-compatible API.
- [ ] Re-run both suites; expect all server tests to pass and no child fixture left running.

### Expected tests

- HTTP 200 readiness without fixed startup sleeps.
- Redirect rejection.
- Response-size abort.
- Matching and mismatching fingerprints.
- Explicit environment precedence.
- Finite port exhaustion.
- Pipeline-owned process cleanup on success and failure.
- Reused process preservation.

### Risks and mitigation

- **Risk:** stale server returns HTTP 200. **Mitigation:** require all five byte hashes to match.
- **Risk:** Windows leaves a Python child behind. **Mitigation:** retain spawned PID and use direct `taskkill.exe /T /F` only for that PID.
- **Risk:** PID reuse. **Mitigation:** cleanup occurs while retaining the live ChildProcess handle and verifies handle identity/exit state before taskkill.
- **Risk:** malicious or accidental large response. **Mitigation:** abort streaming after 10 MiB regardless of headers.

### Acceptance criteria

- Reused server is fingerprint-proven and never stopped.
- Owned server is ready within the bounded contract and always stopped.
- No shell is used to spawn Python or cleanup commands.

## Phase 4 — Screenshot Pipeline

### Purpose

Make capture reproducible, validate the complete candidate set, and update only content-changed committed screenshots.

### Files

- Create `scripts/docs/screenshots.mjs`.
- Modify `tests/user-guide-screenshots.spec.mjs` to consume `DOCS_BASE_URL`, `DOCS_SCREENSHOT_OUTPUT` and the authoritative manifest.
- Move committed PNGs from `docs/user-guides/source/screenshots/` to `docs/user-guides/screenshots/` during implementation.
- Create `docs/user-guides/screenshots.json` during implementation.
- Extend both documentation automation test suites.

### Interfaces

```js
export function sha256File(path: string): Promise<string>;
export function classifyScreenshots(options: ScreenshotClassificationOptions): ScreenshotClassification;
export function buildScreenshotMetadata(options: MetadataBuildOptions): ScreenshotMetadata;
export async function applyScreenshotChanges(options: ScreenshotApplyOptions): Promise<void>;
export async function runScreenshotCapture(options: ScreenshotCaptureOptions): Promise<void>;
```

Playwright context options are exactly `locale: 'en-AU'`, `timezoneId: 'Australia/Perth'`, `colorScheme: 'light'`, `reducedMotion: 'reduce'`, `deviceScaleFactor: 2`, and `serviceWorkers: 'block'`. Install frozen time `2026-07-22T10:00:00+08:00` before application scripts. Add capture-only CSS for zero animation/transition duration, `scroll-behavior: auto` and hidden caret. Wait for fonts and exact DOM states, never `waitForTimeout`.

### Dependencies

Phases 1–3 manifest, process, preflight and server base URL.

### Test-first steps

- [ ] Add failing pure tests for SHA-256 classification of unchanged, updated, new and intentional removed files.
- [ ] Add failing tests that missing manifest candidates and unexpected candidates abort before committed files change.
- [ ] Add failing tests that unchanged file bytes/mtime and `lastGenerated` remain unchanged, while NEW/UPDATED share one injected ISO timestamp.
- [ ] Add failing tests for stable JSON key/order/indent/newline and malformed prior metadata.
- [ ] Add capture-contract tests that scan the Playwright script for all fixed context/time/CSS/font requirements and forbid `waitForTimeout`, unfrozen visible current dates and direct writes to committed screenshots.
- [ ] Run focused tests; expect failures against the current capture script and missing screenshot module.
- [ ] Implement temporary-output capture arguments and deterministic Playwright context/state waits.
- [ ] Implement deterministic whiteboard coordinates and fixture values.
- [ ] Implement candidate-set validation, hashing, classification, metadata and atomic changed-file replacement.
- [ ] Migrate the nine current PNGs and update Markdown/test paths atomically.
- [ ] Run `node tests/user-guide-screenshots.spec.mjs` against a pipeline-owned server; expect nine candidates and no privacy violations.
- [ ] Re-run focused tests; expect classification and deterministic capture contracts to pass.

### Expected tests

- Four hash classifications.
- Capture-failure preservation of committed images.
- Metadata stability and timestamp policy.
- Fixed browser environment.
- Required selector visibility and non-zero bounds.
- Nine deterministic fictional-data screenshots.

### Risks and mitigation

- **Risk:** browser/font rasterisation differs across machines. **Mitigation:** freeze browser context, load fonts fully, preserve unchanged files by hash and report updates for human review.
- **Risk:** legitimate manifest removal deletes an image after partial failure. **Mitigation:** require the complete declared candidate set before any removal.
- **Risk:** Playwright time freeze breaks app timers. **Mitigation:** freeze wall clock while allowing timers/animation frames required for state transitions; test both workflows.

### Acceptance criteria

- All manifest screenshots are captured to temporary storage first.
- Identical screenshots are not rewritten.
- Removal requires an intentional manifest deletion.
- Capture errors leave committed screenshots untouched.

## Phase 5 — Metadata

### Purpose

Update only the delimited Markdown metadata block and propagate Source provenance into generated documents.

### Files

- Create `scripts/docs/metadata.mjs`.
- Modify `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md` to add exactly one metadata block and update screenshot links.
- Modify `scripts/generate-sales-appointment-user-guide.py` to parse generated metadata instead of hard-coded publication values.
- Extend `tests/documentation-automation.test.mjs` and `tests/user-guide-artifacts.test.mjs`.

### Interfaces

```js
export function readApplicationVersion(appJsText: string): string;
export function formatPerthLongDate(date: Date): string;
export function replaceGeneratedMetadata(markdown: string, metadata: {
  applicationVersion, guideVersion, generatedDate,
  sourceBranch, sourceCommit
}): string;
export function parseGeneratedMetadata(markdown: string): GuideMetadata;
```

Python adds a `parse_generated_metadata(markdown: str) -> dict[str, str]` helper and uses its values for cover/footer text and document properties. It must fail if markers or required values are missing/duplicated.

### Dependencies

Phase 2 Source revision and Phase 4 screenshot paths.

### Test-first steps

- [ ] Add failing Node tests for exactly-one marker replacement, duplicate/missing markers, body byte preservation, application-version extraction and Perth date formatting.
- [ ] Add failing artifact tests requiring Application version, Guide version, Generated date and Source commit in Markdown, DOCX XML and PDF-extracted metadata/text.
- [ ] Run tests; expect failures because the metadata block and parser do not exist.
- [ ] Add the canonical metadata block without changing guide body wording.
- [ ] Implement Node replacement using injected clock/revision values.
- [ ] Implement Python metadata parsing and replace hard-coded guide cover/footer metadata.
- [ ] Re-run focused tests; expect cross-artifact metadata contracts to pass after generation fixtures run.

### Expected tests

- Single-marker safety.
- Source commit terminology and full hash.
- Guide version `1.0.0`.
- Application version `2.7.0-alpha.1` read from runtime source.
- Markdown body unchanged outside the block.
- DOCX/PDF inherited metadata.

### Risks and mitigation

- **Risk:** metadata rewrite changes canonical content. **Mitigation:** assert the prefix/suffix outside markers are byte-identical.
- **Risk:** Source commit confused with artifact commit. **Mitigation:** capture HEAD before writes and name every field `sourceCommit`.

### Acceptance criteria

- Only the metadata block is machine-updated.
- All three formats carry matching provenance.
- Runtime version constants remain unchanged.

## Phase 6 — Document Generation Integration

### Purpose

Invoke the retained Python/LibreOffice generator reliably from the orchestrator and protect existing artifacts on failure.

### Files

- Modify `scripts/docs-user-guide.mjs`.
- Modify `scripts/generate-sales-appointment-user-guide.py` only for metadata/path integration defined in Phase 5.
- Extend `tests/documentation-pipeline.integration.test.mjs`.

### Interfaces

```js
export async function generateDocuments(options: DocumentGenerationOptions): Promise<GeneratedDocuments>;
```

Generation uses the selected Python tool's executable and prefix arguments directly. The Python script continues to create DOCX and use LibreOffice headlessly for PDF export.

### Dependencies

Phases 1–5 tooling, metadata and committed screenshots.

### Test-first steps

- [ ] Add failing integration tests for successful generator invocation, Python non-zero exit, LibreOffice failure, missing output and preservation of pre-existing artifacts on failed generation.
- [ ] Run the integration test; expect missing orchestration behaviour.
- [ ] Implement a temporary-output strategy: generate into `.tmp/docs-user-guide/documents/`, validate existence/basic signatures, then replace committed DOCX/PDF only after success.
- [ ] Pass canonical Markdown and screenshot locations without duplicating generator logic in Node.
- [ ] Re-run integration tests; expect safe success/failure behaviour.

### Expected tests

- Direct Python argument vector.
- DOCX and PDF produced together.
- Failed generation does not delete valid committed artifacts.
- Temporary document outputs are cleaned.

### Risks and mitigation

- **Risk:** LibreOffice locks an existing output. **Mitigation:** use an isolated temporary output/profile and replace only after process exit.
- **Risk:** Python path contains spaces. **Mitigation:** pass direct argument arrays.
- **Risk:** partial pair replacement. **Mitigation:** validate both candidates before replacing either committed artifact.

### Acceptance criteria

- Node orchestrates but does not duplicate document rendering.
- Both artifacts are present and candidate-valid before committed replacement.
- Failure leaves prior committed outputs intact.

## Phase 7 — Validation

### Purpose

Provide structural, cross-artifact and heuristic validation with clear failure/warning boundaries.

### Files

- Create `scripts/docs/validation.mjs`.
- Extend `tests/documentation-automation.test.mjs`.
- Extend `tests/user-guide-artifacts.test.mjs`.

### Interfaces

```js
export async function validateScreenshots(options: ScreenshotValidationOptions): Promise<ValidationResult>;
export function validateMarkdownLinks(options: MarkdownValidationOptions): ValidationResult;
export async function validateDocx(options: DocxValidationOptions): Promise<ValidationResult>;
export async function validatePdf(options: PdfValidationOptions): Promise<ValidationResult>;
export function analysePngHeuristics(options: PngAnalysisOptions): ValidationWarning[];
export async function validateGuide(options: GuideValidationOptions): Promise<ValidationResult>;
```

PDF validation requires `%PDF-`, EOF/trailer readability, `pdfinfo` exit zero and parsed page count from 16 through 20 inclusive (current expected 17). PNG heuristics return warnings for near-blank, excessive-whitespace, likely edge clipping and aspect/dimension mismatch; corrupt/empty/invalid-size images fail.

### Dependencies

Phases 1–6 paths, manifest, metadata and tool discovery.

### Test-first steps

- [ ] Add failing tests for missing/undeclared screenshots, bad PNG signatures/dimensions/hashes and malformed metadata.
- [ ] Add failing tests for broken relative Markdown links and forbidden placeholders/local URLs.
- [ ] Add failing DOCX tests for corrupt ZIP/missing parts/missing guide metadata.
- [ ] Add failing PDF tests for bad header, missing EOF, `pdfinfo` failure and page counts 15 and 21; add passing boundary cases 16 and 20.
- [ ] Add warning-only image fixtures generated in memory for blank/near-blank, whitespace and edge clipping.
- [ ] Add README contract failures for each missing command/tool/hash/output/troubleshooting section.
- [ ] Run focused tests; expect missing validator failures.
- [ ] Implement validators with structured `{code, message, path}` failures and warnings.
- [ ] Re-run tests; expect all structural failures and warning boundaries to behave exactly as declared.

### Expected tests

- Missing screenshot and malformed metadata failures.
- Broken-link and placeholder failures.
- DOCX package validation.
- Poppler PDF validation and explicit page range.
- Visual warnings that do not claim human approval.
- Cross-format metadata equality.

### Risks and mitigation

- **Risk:** heuristic false positives. **Mitigation:** warnings only unless structural validity fails; report human-review limitation.
- **Risk:** naive PDF byte counting. **Mitigation:** use Poppler `pdfinfo` as the authoritative page parser.
- **Risk:** links escape repository. **Mitigation:** resolve and verify local targets remain within repository documentation paths.

### Acceptance criteria

- `docs:validate` is read-only and produces zero repository changes.
- Structural defects fail with actionable messages.
- Visual concerns appear as warnings, not automated approval.

## Phase 8 — Reports and Changelog

### Purpose

Generate ordered current-run reporting and a defensive, non-duplicating changelog entry.

### Files

- Create `scripts/docs/reports.mjs`.
- Create `docs/user-guides/documentation-report.md` through the pipeline.
- Create `docs/user-guides/changelog.md` through the pipeline.
- Extend `tests/documentation-automation.test.mjs`.

### Interfaces

```js
export function renderDocumentationReport(runResult: RunResult): string;
export function updateChangelog(existingMarkdown: string, entry: ChangelogEntry): string;
export function renderConsoleSummary(runResult: RunResult): string;
```

Structures sort screenshot names and generated files lexically. Variable timestamp, duration, environment paths and warnings are permitted values inside fixed sections. Changelog identity is `{sourceCommit, classificationSignature}`; replacement is defensive and does not bypass clean-tree preflight.

### Dependencies

All prior phase results, especially classifications and validation warnings.

### Test-first steps

- [ ] Add failing snapshot/string tests for fixed report headings, ordered screenshot groups, server disposition, runtime integrity and human-review limitation.
- [ ] Add failing changelog tests for prepend, same-key replacement, different-commit append and stable ordering.
- [ ] Add failing tests that `screenshots` mode changes only screenshot-related report sections and never changelog.
- [ ] Run focused tests; expect missing report module failures.
- [ ] Implement pure render/update functions with injected time/duration.
- [ ] Integrate report/changelog writes only after successful validation and integrity checks.
- [ ] Re-run focused tests; expect ordered report/changelog contracts to pass.

### Expected tests

- Deterministic structure/order, variable values allowed.
- Correct classifications and warnings.
- Defensive duplicate replacement.
- `docs:screenshots` report write boundary.

### Risks and mitigation

- **Risk:** report claims byte determinism. **Mitigation:** test structure/order only and explicitly label variable fields.
- **Risk:** duplicate changelog growth. **Mitigation:** replace only exact Source commit/classification key.

### Acceptance criteria

- Reports contain every required field and limitation.
- Changelog is updated only by successful full generation.
- No report operation stages or commits files.

## Phase 9 — Cleanup and Orchestrator Completion

### Purpose

Complete mode routing, enforce final write boundaries and make temporary cleanup resistant to symlink/junction/reparse escapes.

### Files

- Create `scripts/docs/cleanup.mjs`.
- Complete `scripts/docs-user-guide.mjs`.
- Extend both documentation automation test suites.

### Interfaces

```js
export async function assertSafeTemporaryTarget(options: SafeTargetOptions): Promise<SafeTarget>;
export async function cleanDocumentationTemporaryFiles(options: CleanupOptions): Promise<void>;
export async function runDocumentationCommand(mode: DocumentationMode, dependencies?: Dependencies): Promise<RunResult>;
```

The orchestrator owns a single `try/finally`. `finally` stops only `context.server.child`, preserves reused servers, and cleans the verified temporary target unless `DOCS_KEEP_TEMP=1`.

### Dependencies

Every previous helper module.

### Test-first steps

- [ ] Add failing cleanup tests for absent target, valid target, target equal to root/`.tmp`, outside path, symlink, junction/reparse fixture and linked parent.
- [ ] Add failing end-to-end mode tests for exact write allowlists and no Git staging.
- [ ] Add failure-injection tests at capture, generation, validation and reporting stages; every owned child/temp path must be cleaned and original error preserved.
- [ ] Run focused tests; expect missing cleanup/orchestrator completion failures.
- [ ] Implement `lstat`/realpath checks before deletion and never follow a link.
- [ ] Implement full mode flows, error formatting and final summaries.
- [ ] Re-run both suites; expect cleanup and write-boundary tests to pass.

### Expected tests

- Symlink/junction/reparse refusal.
- Missing temp directory no-op.
- Owned server/temp cleanup after every exit path.
- Reused server preservation.
- Exact command write boundaries.
- No staging or commits.

### Risks and mitigation

- **Risk:** recursive delete escapes repository on Windows. **Mitigation:** `lstat` each component, reject reparse points and verify strict real-path equality before removal.
- **Risk:** cleanup masks primary failure. **Mitigation:** retain primary error and attach cleanup diagnostics separately.

### Acceptance criteria

- All four commands execute their specified flow.
- Cleanup cannot target committed outputs or unrelated temp directories.
- Final integrity check catches every non-allowlisted change.

## Phase 10 — Documentation, Full Testing and Delivery

### Purpose

Document operation/troubleshooting, regenerate all artifacts through the new command and prove no runtime regression before the single implementation commit.

### Files

- Modify `docs/user-guides/README.md`.
- Modify `tests/user-guide-artifacts.test.mjs` for final paths/metadata/report contracts.
- Regenerate declared `docs/user-guides/**` outputs.
- Do not modify the approved specification.

### Dependencies

Phases 1–9 complete and focused tests green.

### Test-first steps

- [ ] Extend README contract tests first for all four commands, required software, environment variables, server/fingerprint behaviour, screenshot hashes, outputs, cleanup safety and troubleshooting.
- [ ] Run the README test; expect failure against the current README.
- [ ] Update README with exact commands and friendly remediation examples.
- [ ] Build a disposable named-branch integration repository under the test runner's OS temporary directory containing the complete candidate implementation, commit that disposable repository only, run `npm run docs:user-guide` there from a clean tree, and record elapsed time/example summary. Delete the disposable repository after evidence is captured; never alter the real branch to create this test fixture.
- [ ] In the real worktree, invoke the already-tested capture, metadata and document-generation components through their integration harness using Source branch `fix/staff-dropdown-seeding-v2` and Source commit `3afbc94d76cbef98d72bdf5e230bf5a10d75c172`, the clean application revision that precedes documentation-only implementation changes. This bootstrap step produces the declared guide outputs without weakening the public command's strict clean-tree contract.
- [ ] Inspect `git status --short`; confirm only planned implementation files plus declared `docs/user-guides/**` outputs changed, with no runtime changes.
- [ ] Run `npm run docs:validate` in the disposable clean integration repository; confirm success and zero before/after file changes.
- [ ] Run `npm run docs:screenshots` in the disposable clean integration repository; verify UNCHANGED screenshots are not rewritten.
- [ ] Run `npm run docs:clean`; confirm only `.tmp/docs-user-guide/` is absent afterward.
- [ ] Run every command listed in the Validation Gate below.
- [ ] Manually render and inspect every final PDF page; verify screenshot legibility, no clipping and metadata accuracy.
- [ ] Stage only planned implementation and guide-output files, review the staged diff, and create the single commit `docs: automate user guide pipeline`.

### Expected tests

- All new unit/integration suites.
- Existing guide capture and artifact tests.
- Runtime syntax and Phase 5 regression.
- Command smoke tests and manual PDF review.

### Risks and mitigation

- **Risk:** strict clean preflight conflicts with testing generated dirty output. **Mitigation:** use isolated temporary Git repositories for repeat-run tests and perform the authoritative full run from a clean implementation checkpoint before the final commit.
- **Risk:** generated binaries obscure review. **Mitigation:** validate hashes/metadata, inspect page renders and report file sizes/page count.

### Acceptance criteria

- All automation and existing regression tests pass.
- Final guide generation produces only approved outputs.
- Human visual inspection is recorded separately from heuristic warnings.
- One local implementation commit exists; no push, merge or deployment occurs.

---

# File-Level Work

## Create

| File | Rationale |
|---|---|
| `scripts/docs-user-guide.mjs` | Single public orchestration entry point. |
| `scripts/docs/config.mjs` | Immutable paths, manifest, constants and write contracts. |
| `scripts/docs/process.mjs` | Direct, testable child-process execution. |
| `scripts/docs/git-integrity.mjs` | Git preflight, Source revision and runtime/write integrity. |
| `scripts/docs/tooling.mjs` | Supported Node and external-tool discovery. |
| `scripts/docs/server.mjs` | Fingerprint-based server selection and ownership cleanup. |
| `scripts/docs/screenshots.mjs` | Hash classification, metadata and safe updates. |
| `scripts/docs/metadata.mjs` | Canonical metadata block parsing/replacement. |
| `scripts/docs/validation.mjs` | Artifact, link, metadata and visual heuristic validation. |
| `scripts/docs/reports.mjs` | Report, changelog and console summary rendering. |
| `scripts/docs/cleanup.mjs` | Reparse-safe temporary cleanup. |
| `tests/documentation-automation.test.mjs` | Pure/unit contract coverage. |
| `tests/documentation-pipeline.integration.test.mjs` | HTTP, child process and pipeline integration coverage. |
| `docs/user-guides/screenshots.json` | Deterministic screenshot metadata. |
| `docs/user-guides/documentation-report.md` | Current generation report. |
| `docs/user-guides/changelog.md` | Successful guide-generation history. |

## Modify

| File | Rationale |
|---|---|
| `package.json` | Add four npm documentation commands only. |
| `.gitignore` | Ignore only `.tmp/docs-user-guide/`. |
| `tests/user-guide-screenshots.spec.mjs` | Accept temporary output/base URL and enforce deterministic capture. |
| `scripts/generate-sales-appointment-user-guide.py` | Consume generated metadata and temporary output inputs. |
| `tests/user-guide-artifacts.test.mjs` | Validate new paths, metadata, reports, DOCX and PDF. |
| `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md` | Add generated metadata markers and migrated screenshot links; body remains unchanged. |
| `docs/user-guides/README.md` | Explain commands, tooling, hashes, environment, outputs and troubleshooting. |
| `docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx` | Regenerated output containing Source metadata. |
| `docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf` | Regenerated output containing Source metadata. |

## Move

| From | To | Rationale |
|---|---|---|
| `docs/user-guides/source/screenshots/*.png` | `docs/user-guides/screenshots/*.png` | Establish the approved committed screenshot directory without duplicates. |

## No Change

| Path | Rationale |
|---|---|
| `docs/superpowers/specs/2026-07-22-documentation-automation-v1-design.md` | Approved source of truth. |
| `index.html` | Runtime UI is out of scope. |
| `css/**` | Runtime presentation is out of scope. |
| `js/**` | Runtime behaviour is out of scope. |
| `service-worker.js` | Cache/version strategy is out of scope. |
| `manifest.webmanifest` | PWA behaviour is out of scope. |
| `icons/**` and runtime assets/templates | Runtime assets are protected. |
| `vercel.json` | Deployment is out of scope. |
| `package-lock.json` | No dependency change is required. |
| Existing appointment/PDF regression tests other than `tests/user-guide-artifacts.test.mjs` | They are verification inputs, not automation implementation targets. |

---

# Module Responsibilities

## `scripts/docs-user-guide.mjs`

- Parse `generate`, `screenshots`, `validate` or `clean`.
- Build one run context and call helpers in specification order.
- Own server/temp cleanup through one `finally` block.
- Format stage errors and set non-zero exit status.
- Never run Git staging or commits.

## `scripts/docs/*`

- `config.mjs`: no I/O; immutable declarations only.
- `process.mjs`: direct spawn/exec with explicit executable/arguments.
- `git-integrity.mjs`: Git state and before/after content evidence.
- `tooling.mjs`: capability discovery and remediation messages.
- `server.mjs`: bounded HTTP and process ownership.
- `screenshots.mjs`: content-addressed screenshot state transitions.
- `metadata.mjs`: delimited canonical metadata only.
- `validation.mjs`: failures versus warnings.
- `reports.mjs`: presentation of run evidence.
- `cleanup.mjs`: path safety and temporary deletion.

## Playwright integration

Retain current workflow actions and fictional values. Parameterise server/output, freeze environmental inputs, replace fixed waits with observable state, and write candidates only to the pipeline temp directory.

## Python generator integration

Retain document layout and LibreOffice export. Parse canonical metadata and allow isolated candidate output so Node can validate both artifacts before committed replacement.

## Validation

Return structured checks/warnings. Use JSZip for DOCX, Poppler `pdfinfo` for PDF pages, PNG parsing/Pillow-compatible pixel analysis for screenshot heuristics, filesystem resolution for Markdown links and Git/content hashes for integrity.

## Reports

Render fixed section order with sorted lists. Preserve variable timestamps/durations/warnings as evidence, and explicitly state that human visual review remains required.

## Cleanup

Resolve repository real path, lstat every relevant component, reject links/junctions/reparse points, require exact descendant target and remove nothing else.

---

# Testing Strategy

## Phase-by-phase verification matrix

| Phase | Unit tests | Integration tests | Failure-path tests | Manual verification | Expected output |
|---|---|---|---|---|---|
| 1 Foundation | Modes, paths, manifest, direct arguments | Invoke each routed handler with injected fakes | Unknown mode and unsafe path | Inspect npm command text and `.gitignore` scope | Four commands route through one entry point. |
| 2 Preflight | Git parsing, hashes, tool precedence, allowlists | Temporary Git repositories and executable fixtures | Detached/dirty Git, unsupported Node, missing tools, forbidden mutations | Run preflight on the approved worktree without writes | Source revision and verified tool records. |
| 3 Server | URL/port/fingerprint/size helpers | Real temporary HTTP servers and owned child fixture | Redirect, mismatch, timeout, range exhaustion, cleanup failure | Confirm reused server survives and owned server exits | Verified `{baseUrl, disposition, child}`. |
| 4 Screenshots | Hash classification and metadata | Real Playwright capture to temp | Missing/unexpected candidate, malformed metadata | Inspect all nine candidates and unchanged mtimes | Nine classified screenshots plus `screenshots.json`. |
| 5 Metadata | Marker parsing/replacement and date/version formatting | Python consumes updated canonical Markdown | Missing/duplicate marker and inconsistent metadata | Compare guide body before/after block update | Matching Source metadata in canonical inputs. |
| 6 Generation | Command argument and candidate-path construction | Real Python/LibreOffice generation | Python/LibreOffice failure, missing one artifact | Open candidate DOCX/PDF | Valid candidate DOCX/PDF pair. |
| 7 Validation | PNG/link/metadata/report checks | JSZip and real `pdfinfo` against artifacts | Corrupt files, bad pages, broken links | Review warning wording and PDF pages | Structured checks plus non-blocking warnings. |
| 8 Reports | Pure report/changelog rendering | Feed real run result | Duplicate key and missing required evidence | Read report/changelog for clarity | Ordered report and one Source entry. |
| 9 Cleanup | Path and reparse validation | Temp directories and child lifecycle | Escape attempts and cleanup-primary error pairing | Confirm unrelated temp/servers remain | Only owned processes/temp removed. |
| 10 Delivery | README contracts | Full disposable clean-repository pipeline | Full-run failure injection | Open DOCX, inspect every PDF page and staged diff | Verified outputs and one local commit. |

## Unit tests

- Pure manifest, path, hash, metadata, report and classification functions.
- Git porcelain parsing and write allowlists.
- Tool selection precedence and remediation.
- URL/port validation and response bounds.
- Cleanup path validation.
- PNG heuristic classifications.

## Integration tests

- Temporary Git repositories for clean/detached/dirty states.
- Temporary HTTP servers for readiness/fingerprints.
- Child fixture processes for ownership cleanup.
- Temporary screenshot/document directories for update safety.
- Real current DOCX/PDF artifacts for validator acceptance.
- Full orchestrator with injected fake capture/generator for write-boundary failures.

## Failure-path tests

- Missing tools/features.
- Server mismatch, redirect, oversized response and timeout.
- Capture misses a manifest file.
- Corrupt metadata, PNG, DOCX and PDF.
- Generator partial failure.
- Runtime/non-allowlisted mutation.
- Reparse-point cleanup escape.
- Cleanup error while another primary error exists.

## Manual verification

- Run complete generation from a clean named branch.
- Review console summary, report and changelog.
- Verify unchanged screenshot mtimes in an isolated repeat-run test.
- Render and inspect all PDF pages.
- Open DOCX in Word/LibreOffice.
- Confirm no server process remains when pipeline-owned.
- Confirm reused server remains reachable.

## Expected outputs

- Nine declared screenshots and matching metadata hashes.
- Canonical Markdown with one metadata block.
- Readable DOCX and 16–20-page PDF (currently 17).
- Report with classifications, validation and warnings.
- One changelog entry for the Source revision.
- Clean `.tmp/docs-user-guide/` after normal completion.

---

# Execution Order

1. Phase 1 foundation must precede all other work.
2. Phase 2 preflight and Phase 3 server lifecycle may be implemented independently after Phase 1 because both consume only process/config interfaces.
3. Phase 4 screenshot hashing may begin after Phase 1; Playwright integration waits for Phase 3 base URL and Phase 2 tool discovery.
4. Phase 5 metadata may proceed independently after Phase 1, but Python propagation waits for Phase 6 integration.
5. Phase 6 depends on tooling and metadata.
6. Phase 7 validators can be developed against fixtures after Phase 1, then integrated after Phases 4–6.
7. Phase 8 depends on classification and validation result schemas.
8. Phase 9 depends on every helper contract and completes orchestration.
9. Phase 10 begins only when all focused tests pass.

Parallel work is safe only for modules with no shared file edits: Git/tooling, server, screenshot pure helpers, metadata pure helpers and validation fixtures. Changes to `scripts/docs-user-guide.mjs`, `tests/documentation-automation.test.mjs`, `package.json`, canonical Markdown and generated outputs must be serialised to avoid conflicting edits.

No phase creates a commit. The implementation remains uncommitted until the complete verification gate passes, then one focused commit is created.

---

# Risk Register

| Category | Risk | Mitigation |
|---|---|---|
| Technical | Orchestrator becomes a monolith. | Keep orchestration declarative and move I/O responsibilities into narrow helpers. |
| Technical | Partial writes corrupt committed outputs. | Capture/generate in temp, validate complete candidate sets, then replace approved files. |
| Environment | Tool paths vary. | Ordered discovery, direct argument arrays and actionable errors. |
| Windows | Spaces and quoting break commands. | Never compose shell strings; use executable plus argument arrays. |
| Windows | Python child tree survives. | Retain owned PID and use `taskkill.exe /T /F` only for that child. |
| Windows | Junction/reparse cleanup escapes repository. | `lstat`, reparse rejection and strict real-path checks. |
| Playwright | Fonts/animations cause hash churn. | Fixed locale/timezone/theme/motion/scale, fonts-ready and capture CSS. |
| Playwright | Time freeze changes workflow readiness. | Freeze wall-clock values but retain timer progression; wait on real DOM state. |
| Git | Dirty work is overwritten. | Strict clean preflight; no automatic revert/staging/commit. |
| Git | Source commit is confused with artifact commit. | Capture before writes and consistently label Source commit. |
| Python | Required packages unavailable. | Ordered discovery plus import preflight; no automatic install. |
| LibreOffice | Headless export hangs or locks. | Isolated profile/output, bounded subprocess timeout and candidate replacement. |
| Poppler | `pdfinfo` absent or localised output differs. | Preflight executable and parse the `Pages:` field defensively with fixture tests. |
| Network | Wrong checkout server reused. | Five-file fingerprint, cache-busting, manual redirects and response bounds. |
| Validation | Visual heuristics overclaim quality. | Warning-only semantics and mandatory human review statement. |

---

# Rollback Strategy

If implementation or validation fails:

1. Stop; do not stage or commit partial work.
2. Allow orchestrator `finally` cleanup to stop only its owned server and remove its verified temp tree.
3. Preserve all existing committed guide artifacts; candidate-first replacement prevents deletion on partial capture/generation.
4. Inspect `git status --short` and the changed-path report.
5. Preserve any unrelated human-owned changes; do not use `git reset --hard`, `git clean`, checkout-overwrite or history rewriting.
6. Revert planned files only through an explicit reviewed patch or a new ordinary revert commit after an implementation commit exists.
7. If the single implementation commit was created but later rejected, use `git revert <commit>` to preserve history.
8. Never delete drafts, runtime data, normal screenshots or other worktrees as part of rollback.

---

# Validation Gate

Implementation may begin only when all items are true:

- [ ] Approved specification remains byte-identical to commit `3afbc94d76cbef98d72bdf5e230bf5a10d75c172`.
- [ ] This implementation plan is explicitly approved.
- [ ] Working tree is clean.
- [ ] Branch is confirmed as `fix/staff-dropdown-seeding-v2` unless the user explicitly selects another named branch.
- [ ] HEAD and worktree path are reported before editing.
- [ ] Implementation begins only after user approval.

Before the final implementation commit, run the direct tests in the implementation worktree and the strict-clean npm command in the disposable named-branch integration repository described in Phase 10:

```powershell
node tests/documentation-automation.test.mjs
node tests/documentation-pipeline.integration.test.mjs
node tests/user-guide-screenshots.spec.mjs
node tests/user-guide-artifacts.test.mjs
# Run inside the disposable clean integration repository:
npm.cmd run docs:validate
node --check js/app.js
node --check service-worker.js
npm.cmd run smoke
git diff --check
```

Required results:

- All documentation tests pass.
- Screenshot capture produces all manifest files with fictional data.
- Artifact validation reports a readable DOCX and 16–20-page PDF.
- Phase 5 regression reports `61 tests, 61 passed, 0 failed`.
- Application version remains `2.7.0-alpha.1`.
- Cache remains `v2.7.0-alpha.21`.
- Runtime-protected hashes are unchanged.
- Only planned implementation and `docs/user-guides/**` output files are staged.

---

# Deliverables

## New files

- `scripts/docs-user-guide.mjs`
- `scripts/docs/config.mjs`
- `scripts/docs/process.mjs`
- `scripts/docs/git-integrity.mjs`
- `scripts/docs/tooling.mjs`
- `scripts/docs/server.mjs`
- `scripts/docs/screenshots.mjs`
- `scripts/docs/metadata.mjs`
- `scripts/docs/validation.mjs`
- `scripts/docs/reports.mjs`
- `scripts/docs/cleanup.mjs`
- `tests/documentation-automation.test.mjs`
- `tests/documentation-pipeline.integration.test.mjs`
- `docs/user-guides/screenshots.json`
- `docs/user-guides/documentation-report.md`
- `docs/user-guides/changelog.md`
- `docs/user-guides/screenshots/*.png` at their migrated paths

## Modified files

- `package.json`
- `.gitignore`
- `tests/user-guide-screenshots.spec.mjs`
- `tests/user-guide-artifacts.test.mjs`
- `scripts/generate-sales-appointment-user-guide.py`
- `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`
- `docs/user-guides/README.md`
- `docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx`
- `docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf`

## Removed paths

- `docs/user-guides/source/screenshots/*.png`, only after the same nine files are safely migrated and validated under `docs/user-guides/screenshots/`.

## Unchanged files

- Approved specification.
- All runtime HTML, CSS, JavaScript, service-worker, manifest, icons, templates and deployment files.
- `package-lock.json`.
- Application and service-worker versions.

---

# Self-Review Checklist

- [ ] Every approved specification requirement maps to a phase and test.
- [ ] Phase dependencies and interfaces use consistent names.
- [ ] No task duplicates another module's responsibility.
- [ ] No runtime, workflow, application-version or cache change is planned.
- [ ] No command stages or commits files.
- [ ] Strict clean-tree behaviour is preserved.
- [ ] Same-Source changelog replacement is defensive only.
- [ ] Command write contracts are exact and tested.
- [ ] Server discovery and ownership values are exact.
- [ ] Screenshot determinism requirements are complete.
- [ ] Screenshot removal cannot occur after capture failure.
- [ ] Cleanup rejects symlink/junction/reparse escapes.
- [ ] PDF validation uses Poppler and the 16–20-page contract.
- [ ] Report structure/order is deterministic without claiming byte determinism.
- [ ] Rollback preserves history and human-owned work.
- [ ] Exactly one implementation commit is planned.

---

# Implementation Handoff

After this plan is approved, execute it test-first using `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Do not begin implementation from an unapproved plan, dirty tree or changed specification.
