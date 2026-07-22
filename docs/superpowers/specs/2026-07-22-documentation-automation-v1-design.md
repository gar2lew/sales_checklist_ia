# Documentation Automation v1 Design

## Status

Approved design for implementation planning. This specification defines a documentation-only automation pipeline for Sales Appointment Capture. It does not authorise runtime application changes, pushing, merging or deployment.

## Objective

Provide one reliable command that regenerates the complete staff user-guide artifact set after UI or workflow changes:

```powershell
npm run docs:user-guide
```

The pipeline extends the existing Playwright screenshot capture, canonical Markdown guide, Python DOCX/PDF generator and artifact tests. It does not replace those components.

## Scope

Documentation Automation v1 will:

- validate Git and tooling preconditions;
- start or safely reuse a local server for the current checkout;
- capture deterministic, fictional-data screenshots;
- classify screenshots by SHA-256 content hash;
- update only changed screenshot files;
- maintain deterministic screenshot metadata;
- update a generated metadata block in the canonical Markdown;
- regenerate DOCX and PDF artifacts;
- validate screenshots, Markdown, DOCX, PDF and README contracts;
- generate a documentation report and changelog entry;
- preserve runtime source integrity; and
- clean pipeline-owned temporary artifacts.

The pipeline will not:

- modify runtime application behaviour or workflows;
- modify the application version or service worker;
- modify generated appointment documents or package logic;
- use real staff or customer information;
- automatically approve visual quality;
- remove committed guide outputs;
- stop a server it did not start;
- push, merge or deploy.

## Architecture

### Single Node orchestrator

`scripts/docs-user-guide.mjs` is the only public orchestration entry point. It accepts a command argument and coordinates existing scripts and focused helper modules. Node owns Git inspection, tool preflight, HTTP readiness, server lifecycle, hashing, metadata, reports, changelog updates, subprocess execution and final integrity checks.

The orchestrator exposes four command modes through `package.json`:

| NPM command | Orchestrator mode | Responsibility |
|---|---|---|
| `npm run docs:user-guide` | `generate` | Run the complete preflight, screenshot, document, validation and reporting pipeline. |
| `npm run docs:screenshots` | `screenshots` | Run preflight, server lifecycle, capture, hash comparison, screenshot update and metadata/report generation. |
| `npm run docs:validate` | `validate` | Validate committed guide artifacts without capturing or regenerating them. |
| `npm run docs:clean` | `clean` | Remove pipeline-owned temporary documentation artifacts only. |

Internal implementation may use focused modules under `scripts/docs/` so pure operations can be tested without starting browsers or subprocesses. These modules are not additional user-facing entry points.

### Existing components retained

- `tests/user-guide-screenshots.spec.mjs` remains the Playwright capture implementation. It will accept pipeline-provided output and base URL values rather than owning committed-file replacement.
- `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md` remains canonical content.
- `scripts/generate-sales-appointment-user-guide.py` remains the DOCX/PDF generator. It will consume generated metadata already written to the canonical Markdown.
- `tests/user-guide-artifacts.test.mjs` remains the artifact contract and will be extended by focused automation tests.

## Repository Outputs

The committed documentation structure will be:

```text
docs/user-guides/
  ASG_Sales_Appointment_Capture_User_Guide.docx
  ASG_Sales_Appointment_Capture_User_Guide.pdf
  README.md
  changelog.md
  documentation-report.md
  screenshots.json
  screenshots/
    01-appointment-type-selection.png
    ...
  source/
    SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md
```

Existing committed screenshots under `docs/user-guides/source/screenshots/` will be migrated to `docs/user-guides/screenshots/` in the implementation commit. Markdown image links and artifact tests will be updated atomically. No duplicate committed screenshot set will remain.

Pipeline temporary data will live under `.tmp/docs-user-guide/`. This directory will contain capture candidates, server-fingerprint material and transient validation renders. It will be ignored by Git and is the only directory removed by `docs:clean`.

## Git Preconditions and Integrity

### Branch verification

The pipeline accepts any named branch and records that branch. It rejects detached HEAD with a friendly message explaining how to switch to a branch.

### Clean-tree verification

All modes except `clean` require a clean Git working tree before work starts. Clean means `git status --porcelain` returns no tracked, untracked, staged or unstaged paths. This prevents generated outputs from being mixed with unrelated local work.

The complete pipeline intentionally makes expected documentation outputs dirty. It records the initial commit and a baseline hash map of runtime-protected files before generation. At completion it allows changes only in the explicit documentation-output allowlist, `package.json`, documentation automation scripts/tests and the temporary directory. Any unexpected path fails the pipeline.

### Runtime-protected files

Runtime integrity is verified using SHA-256 before and after generation. The protected set includes:

- `index.html`;
- `css/`;
- `js/`;
- `icons/`;
- runtime template and image assets;
- `manifest.webmanifest`;
- `service-worker.js`;
- `vercel.json`; and
- appointment PDF source/template assets tracked by Git.

The implementation will derive this set from tracked paths and explicit runtime roots, not modification timestamps. Any added, removed or changed protected file fails generation and is listed in the final report. The pipeline does not revert files automatically.

## Tool Preflight

Before capture or generation, the orchestrator verifies:

1. the running Node version and executable;
2. a usable Python executable with `python-docx` and Pillow;
3. the repository Playwright package;
4. a launchable Chromium browser for the installed Playwright version;
5. LibreOffice for PDF export; and
6. required repository files and generator scripts.

Missing tooling produces a non-zero exit and specific remediation. Examples include the repository install command for Node packages, `npx playwright install chromium` for the browser, and the configured Python/LibreOffice requirement for document export. The pipeline never installs dependencies automatically.

Python discovery checks, in order:

1. `DOCS_PYTHON` when explicitly set;
2. `python` on `PATH`;
3. `py -3` on Windows; and
4. the existing Codex workspace Python runtime when present.

The selected interpreter must successfully import `docx` and `PIL` before it is accepted.

## Server Lifecycle and Checkout Fingerprint

### Fingerprint contract

HTTP 200 alone is insufficient for reuse. Before server selection, the orchestrator builds a checkout fingerprint from SHA-256 hashes of stable served runtime files:

- `index.html`;
- `css/app.css`;
- `js/app.js`;
- `manifest.webmanifest`; and
- `service-worker.js`.

For an existing candidate server, the orchestrator fetches those exact paths with cache-busting query parameters, requires HTTP 200 for each, hashes the response bytes and compares every value with the local checkout. Reuse is allowed only on a complete match.

An HTTP 200 server with any missing or mismatched file is rejected as a different checkout. The pipeline reports the mismatched paths and selects another available port for its own server; it never terminates or alters the pre-existing process.

### Pipeline-owned server

If no matching server is reusable, the orchestrator starts the existing approved static-server workflow from the repository root, bound to `127.0.0.1` on an available documentation port. It waits by polling the application URL until HTTP 200 and fingerprint equality are both observed, subject to a bounded timeout. It does not use arbitrary fixed sleeps.

The child process handle is retained. A `finally` block terminates only that child process and removes only pipeline-owned temporary files, whether generation succeeds or fails. Reused servers are never stopped.

## Deterministic Screenshot Capture

The existing Playwright flow continues to:

- clear and seed local storage with fictional demonstration configuration;
- use Test User, John Smith, Jenny Smith and fictional contact/property details;
- block service workers during capture;
- navigate both in-person and Zoom workflows;
- exercise the whiteboard and package-ready states; and
- capture the approved desktop and mobile views.

Fixed-delay waits will be removed. Before every capture, Playwright will assert the required locator exists, is visible and has a non-zero bounding box. State transitions use DOM conditions, accessible state, application status text, network readiness or browser animation-frame stability. A missing required control fails with the screenshot name, selector and expected state.

Candidate PNGs are written to `.tmp/docs-user-guide/screenshots/`. Capture never writes directly to the committed screenshot directory.

## Screenshot Hashing and Metadata

### Classification

The orchestrator compares candidate and committed screenshots by SHA-256:

- **UNCHANGED:** filename exists in both sets and hashes match. The committed file and its `lastGenerated` value are untouched.
- **UPDATED:** filename exists in both sets and hashes differ. The candidate replaces the committed file.
- **NEW:** filename exists only in the candidate set. It is copied to the committed directory.
- **REMOVED:** filename exists only in committed metadata/directory. It is reported and removed only when the capture manifest no longer declares it.

The capture manifest is authoritative for expected screenshot names. Unexpected candidate files fail validation rather than being committed silently.

### `screenshots.json`

Metadata uses this schema:

```json
{
  "schemaVersion": 1,
  "screenshots": [
    {
      "filename": "01-appointment-type-selection.png",
      "viewport": { "width": 1440, "height": 900, "deviceScaleFactor": 2 },
      "page": "Landing",
      "description": "Appointment type and staff selection",
      "hash": "sha256 hexadecimal value",
      "lastGenerated": "ISO 8601 UTC timestamp"
    }
  ]
}
```

Entries are sorted by filename. Object key order is fixed as shown. The file uses two-space indentation and one trailing newline. `lastGenerated` is preserved for unchanged entries and updated only for NEW or UPDATED entries. A single generation timestamp is reused for every changed entry in one run.

## Canonical Markdown Metadata

The guide body remains hand-authored canonical content. Automation updates only the delimited generated block immediately below the title:

```markdown
<!-- docs-automation:metadata:start -->
**Application version:** 2.7.0-alpha.1<br>
**Guide version:** 1.0.0<br>
**Generated:** 22 July 2026<br>
**Git branch:** example/branch<br>
**Git commit:** abcdef0123456789
<!-- docs-automation:metadata:end -->
```

The application version is read from the runtime's authoritative version constant. Guide version `1.0.0` is stored in the orchestrator configuration for Documentation Automation v1. The date uses the local `Australia/Perth` calendar date rendered in Australian long-date form. The full Git commit is recorded. The metadata replacement requires exactly one start and one end marker; missing or duplicate markers fail without rewriting the guide.

DOCX and PDF inherit this metadata from Markdown through the existing generator. The cover and footer will display application version and guide version; the document properties or metadata page will include generation date, branch and full commit.

## Document Generation

For `generate`, orchestration order is:

1. Git and tool preflight;
2. runtime baseline hashing;
3. server reuse/start and readiness verification;
4. temporary screenshot capture;
5. screenshot classification and committed update;
6. `screenshots.json` update;
7. canonical Markdown metadata update;
8. Python DOCX generation;
9. LibreOffice PDF export through the existing Python generator;
10. validation;
11. documentation report generation;
12. changelog update;
13. runtime integrity and output-allowlist verification; and
14. final console summary.

Failure at any step prevents later dependent steps. The final cleanup still runs. Existing committed artifacts are not deleted on failure.

## Validation

### Structural validation

Validation must confirm:

- every screenshot declared in `screenshots.json` exists;
- no undeclared committed screenshot exists;
- every PNG has a valid signature, expected dimensions and matching SHA-256;
- screenshot metadata follows schema, ordering and timestamp rules;
- all local Markdown image and document links resolve;
- no `TODO`, `TBD`, placeholder copy or forbidden local/LAN URLs appear;
- DOCX is a readable ZIP package with required document parts and guide text;
- PDF has a valid header, opens with the repository PDF tooling and contains an allowed page count;
- Markdown, DOCX and PDF contain matching application version, guide version, generation date and Git commit;
- no expected image is missing from DOCX/PDF generation inputs;
- README documents all four NPM commands, software requirements, hash behaviour, outputs and troubleshooting; and
- runtime-protected hashes remain unchanged.

### Visual heuristics

PNG analysis produces warnings for:

- blank or near-blank images based on luminance variance and dominant-colour ratio;
- excessive whitespace based on near-background pixel coverage;
- likely edge clipping when non-background content contacts capture boundaries; and
- dimensions or aspect ratios outside the declared capture contract.

Warnings are recorded in reports and do not fail generation unless the image is unreadable, empty, corrupt or dimensionally invalid. Reports explicitly state that heuristic checks do not replace human page-by-page visual review.

## Reports and Changelog

### `documentation-report.md`

Each generation overwrites a deterministic current-run report containing:

- branch and full commit;
- application and guide versions;
- generation timestamp and elapsed duration;
- UNCHANGED, UPDATED, NEW and REMOVED screenshot lists/counts;
- generated file list;
- validation results;
- visual warnings;
- server disposition (`reused` or `pipeline-owned`);
- runtime-integrity result; and
- the human-review limitation.

### `changelog.md`

Successful full generations prepend one entry containing:

- local generation date and time;
- branch and full commit;
- application and guide versions;
- changed screenshot names by classification;
- generated artifact names; and
- warnings.

Repeated generation for the same commit with identical screenshot classifications replaces that commit's existing entry instead of adding a duplicate. This keeps the changelog deterministic for reruns of the same source state.

## Cleanup

`npm run docs:clean` resolves `.tmp/docs-user-guide/` to an absolute path, confirms it is inside the repository and removes only that directory. It does not require a clean tree because cleanup is a recovery operation. It never removes:

- committed screenshots;
- `screenshots.json`;
- Markdown, DOCX or PDF artifacts;
- reports or changelog; or
- unrelated temporary directories.

## Error Handling

Every failure uses a non-zero exit code and a concise stage-prefixed message. Messages identify the failed command, path, selector, URL or hash mismatch and provide a practical remediation when tooling or environment is responsible.

The final `finally` path always:

1. stops a pipeline-owned server if one exists;
2. leaves a reused server running;
3. removes pipeline-owned temporary capture files unless `DOCS_KEEP_TEMP=1`; and
4. reports cleanup failures without hiding the original error.

## Test Strategy

Implementation is test-first. Pure helpers will be exported from focused modules and tested with temporary Git repositories, HTTP servers and fixture files. Integration tests may inject executable paths, server commands, clocks and temporary directories so failure cases do not depend on the developer machine.

Required automated coverage:

### Git and tooling

- named clean branch accepted;
- detached HEAD rejected;
- dirty tree rejected, including untracked paths;
- unavailable Node reported;
- unavailable Python or missing Python imports reported;
- unavailable Playwright package/browser reported.

### Server lifecycle

- HTTP readiness waits for a real HTTP 200;
- reused-server fingerprint match accepted;
- reused-server fingerprint mismatch rejected without stopping that server;
- pipeline-owned server stopped after success and failure;
- existing matching server preserved.

### Screenshot management

- UNCHANGED, UPDATED, NEW and REMOVED classification;
- unchanged file bytes and timestamps are preserved;
- deterministic metadata ordering and formatting;
- `lastGenerated` changes only for NEW and UPDATED;
- missing screenshot rejected;
- malformed metadata rejected.

### Guide and visual validation

- broken Markdown links rejected;
- blank or near-blank image warning;
- excessive-whitespace warning;
- edge-clipping warning;
- readable DOCX accepted and corrupt DOCX rejected;
- readable PDF/page count accepted and corrupt PDF rejected;
- missing metadata markers rejected;
- README command and tooling contracts;
- runtime-file integrity after generation.

### Existing regression coverage

The existing user-guide artifact test and screenshot capture must pass. Documentation implementation must also run `node --check` for runtime JavaScript and the authoritative Phase 5 suite to prove no application behaviour changed.

## Acceptance Criteria

Documentation Automation v1 is complete when:

1. all four NPM commands work on Windows from the repository root;
2. `docs:user-guide` regenerates screenshots, Markdown metadata, DOCX, PDF, report and changelog from a clean named branch;
3. unchanged screenshots are not rewritten;
4. a mismatched pre-existing server is never reused or stopped;
5. pipeline-owned processes and temporary artifacts are cleaned after success and failure;
6. validation covers artifact integrity, links, metadata, versions and heuristic warnings;
7. runtime-protected files remain byte-identical;
8. tests demonstrate every required success and failure contract;
9. the application version and service-worker cache are unchanged; and
10. one local commit is created with message `docs: automate user guide pipeline`, with no push, merge or deployment.

## Known Limitations

- Visual heuristics can identify suspicious images but cannot confirm semantic correctness, legibility or design quality. Human visual review remains mandatory.
- A reused server can be proven to match the selected runtime fingerprint, but the pipeline cannot identify its owning process portably; it therefore never attempts to stop it.
- DOCX/PDF generation continues to require Python dependencies and LibreOffice already used by the project.
- The v1 command targets Windows-first project usage while keeping Node modules platform-neutral where practical.
