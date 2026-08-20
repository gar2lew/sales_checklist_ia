# Verified Offline Support and User Guide v1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a physically verified same-device offline appointment workflow and a truthful, field-ready Sales Appointment Capture User Guide version `1.1.0`.

**Architecture:** Keep the existing static PWA, service worker, single application runtime and documentation orchestrator. Harden the current device-local draft boundary, add observable offline readiness/recovery, preserve fully local package generation, and extend the existing deterministic Markdown → DOCX/PDF documentation pipeline.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Service Worker/Cache Storage, Web Storage and optional Web Storage capability APIs, Canvas/FileReader/Pointer events, Node.js tests, Playwright, Python document generation, LibreOffice, Poppler.

## Global Constraints

- Do not begin runtime implementation until every HIGH audit finding has an approved disposition.
- Preserve appointment business rules, IDs, validation, PDF layout/output, email content, storage keys and existing draft shape unless a separately reviewed migration is explicitly approved.
- Do not add cloud sync, background email, cross-device drafts, offline authentication or automatic sending.
- Use fictional data in every test, screenshot and report.
- Application version remains `2.7.0-alpha.1` unless a later release decision explicitly changes it.
- Change the service-worker cache version only in a phase that changes cached runtime assets.
- Target guide version is `1.1.0`; the guide page count is approved from the canonical v1.1 artifact rather than forced to 17.
- Each phase is test-first, produces one focused local commit and stops for review.
- Do not push, merge or deploy during implementation phases.

---

## Pre-Implementation Approval Gate

- [x] Seven-day retention with automatic expiry, explicit timestamps and manual deletion (approved 24 July 2026).
- [x] New Appointment: three-way choice (Continue, Start New + Keep Draft, Delete and Start New) with explicit confirmation (approved 24 July 2026).
- [x] localStorage-to-IndexedDB migration with transactional saves, schema versioning and quota handling (approved 24 July 2026).
- [x] Corrupt-draft recovery: guarded parsing, quarantine, explicit deletion, no silent overwrite (approved 24 July 2026).
- [x] Specification amended to reflect approved dispositions (24 July 2026).
- [x] Branch, HEAD and clean working tree recorded.

**Stop condition:** All approval-gate items are now resolved (24 July 2026). Implementation is **GO** for Phase 1 (test harness) and subsequent approved phases.

## Dependency Map

| Phase | Depends on | Can proceed independently |
|---|---|---|
| 1. Harness and fixtures | Approval gate | Test-only fixture design can be reviewed independently |
| 2. Service worker/readiness | Phase 1 | No |
| 3. Draft persistence/recovery | Phase 1 + approved product decisions | Can be developed separately from Phase 2 after interfaces are fixed |
| 4. Offline status/message UI | Phases 2–3 | No |
| 5. Package-generation assessment | Phases 1–4 | No |
| 6. Installation screenshots | Approved physical test environment | Can run alongside Phase 5 after runtime stabilizes |
| 7. Offline workflow screenshots | Phases 2–5 + physical approval | No |
| 8. Guide source rewrite | Approved wording/policies + Phases 6–7 | No |
| 9. Document generation/validation | Phase 8 | No |
| 10. Regression/physical handoff | All prior phases | No |

## Phase 1: Offline Test Harness and Baseline Fixtures

**Purpose:** Turn research observations into authoritative, deterministic acceptance tests before runtime changes.

**Files:**

- Modify: `tests/offline-capability-research.test.mjs`
- Create: `tests/helpers/offline-fixtures.mjs`
- Create: `tests/fixtures/offline-draft-v2.7.0-alpha.1.json`
- Create: `tests/offline-draft-persistence.test.mjs`
- Create: `tests/offline-readiness.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`
- No change: `js/app.js`, `service-worker.js`, canonical guide artifacts

**Interfaces:**

- Produces `buildFictionalOfflineDraft(overrides = {})` in a test-only helper exported from `tests/helpers/offline-fixtures.mjs`.
- Produces matrix result shape `{ scenario, status, expected, actual, dataLossRisk }`.
- Establishes complete legacy-draft fixture used by Phases 2–3.

**Dependencies:** Approved product decisions are not required for test-only characterization, but are required before Phase 2 or 3.

**Expected tests:**

- [ ] Extract fictional data and persistent-context helpers without changing assertions.
- [ ] Add dedicated assertions for staff, mode, Client 2, EOI, IA, contract due date, signatures, photos, whiteboard vectors/pages and summary state.
- [ ] Add first-load, online reload, offline refresh, close/reopen, reconnect and uncached-route cases.
- [ ] Add complete draft preservation across `v2.7.0-alpha.21` upgrade.
- [ ] Add cache-cleared/storage-retained, storage-cleared/cache-retained, corrupt and quota cases.
- [ ] Assert fixture strings contain only `.invalid`, “Fictional”, “Test” and approved synthetic addresses/names.
- [ ] Run each new test before runtime changes and record expected PASS/PARTIAL failures.

**Commands:**

```powershell
node tests/offline-capability-research.test.mjs
node tests/offline-draft-persistence.test.mjs
node tests/offline-readiness.test.mjs
node tests/service-worker-browser-upgrade.test.mjs
git diff --check
```

**Risks:** Browser profiles can leak between cases; downloads can leave artifacts; tests can overstate device support.

**Mitigation:** Unique temp profiles, `finally` cleanup, test-owned download directories, explicit `AUTOMATED ONLY` labels, no physical PASS claims.

**Acceptance criteria:**

- deterministic repeatable matrix;
- full fictional draft fixture committed;
- every known gap has a failing or explicit PARTIAL assertion;
- no runtime file changed.

**Commit:** `test: establish offline appointment acceptance harness`

**Review gate:** Stop and approve the authoritative failing baseline.

## Phase 2: Service Worker and Offline Readiness

**Purpose:** Prove the exact required cache is complete and prevent disruptive mixed-version operation.

**Files:**

- Modify: `service-worker.js`
- Modify: `js/app.js`
- Modify: `index.html` only if a status target/accessible semantics cannot reuse an existing element
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`
- Modify: `tests/offline-readiness.test.mjs`

**Interfaces:**

- Service worker accepts `{ type: 'GET_OFFLINE_READINESS' }`.
- It replies `{ type: 'OFFLINE_READINESS', cacheVersion, ready, missingAssets }`.
- Application helper `requestOfflineReadiness()` returns the reply or `{ ready: false, reason: 'uncontrolled' | 'timeout' }`.
- Update policy must be explicit: do not activate a new shell over an active unsaved/saved draft without the approved safe transition.

**Tests first:**

- [ ] Assert every required asset path exists and is cached after install.
- [ ] Assert failed atomic install does not delete the previous complete cache.
- [ ] Assert readiness is false with a missing template and lists only non-sensitive paths.
- [ ] Assert active full legacy draft survives upgrade.
- [ ] Assert no mixed old/new CSS, JS and templates are served.
- [ ] Assert navigation with path/query falls back and unrelated caches remain.
- [ ] Assert offline package still succeeds with a complete cache.

**Implementation steps:**

- [ ] Introduce the narrow message handler and reuse `APP_SHELL` as the authoritative asset set.
- [ ] Implement the approved activation/update behaviour without polling.
- [ ] Keep non-GET requests unmanaged and preserve the existing fetch strategy.
- [ ] Advance cache version once, in this phase, because cached JS/SW assets change.

**Commands:**

```powershell
node --check service-worker.js
node --check js/app.js
node tests/service-worker-upgrade.test.mjs
node tests/service-worker-browser-upgrade.test.mjs
node tests/offline-readiness.test.mjs
git diff --check
```

**Risks:** A waiting-worker change can strand users on old code; activation can interrupt live appointments.

**Acceptance criteria:** Complete cache is queryable, old complete cache remains safe on failed update, full draft survives upgrade, offline reload/package tests pass.

**Commit:** `fix: verify offline app readiness and safe updates`

**Review gate:** Stop for service-worker architecture review.

## Phase 3: IndexedDB Migration, Draft Persistence, Retention and Recovery

**Purpose:** Migrate draft storage from localStorage to IndexedDB with schema versioning, implement seven-day retention with automatic expiry, approved New Appointment semantics, corrupt-draft recovery and post-handover cleanup. Meet the minimum guarantee without false save confidence or silent data loss.

**Files:**

- Modify: `js/app.js`
- Modify: `index.html` only for approved recovery controls/messages
- Modify: `css/app.css` only for existing-design-system recovery states
- Modify: `tests/offline-draft-persistence.test.mjs`
- Modify: `tests/zoom-timeline-whiteboard.test.mjs`
- Create: `tests/offline-draft-recovery.test.mjs`

**Interfaces:**

- `serializeDraftForStorage()` remains the single source of the current persisted shape.
- `measureSerializedDraft(serialized)` returns UTF-16 storage bytes and configured warning/block classification.
- `persistDraftSafely(serialized)` returns `{ ok, reason: 'saved' | 'quota' | 'unavailable' | 'verify-failed', bytes }`.
- `inspectStoredDraft(raw)` returns `{ status: 'valid', draft }`, `{ status: 'corrupt', raw }` or `{ status: 'missing' }`.
- `deleteStoredDraft({ confirmed: true })` remains the only destructive path.
- Existing `salesAppointmentDraft` key remains unchanged.

**Tests first:**

- [ ] Save/read-back success and exact persisted-shape characterization.
- [ ] Warning/hard boundary cases from the approved capacity policy.
- [ ] Quota exception preserves live form and cannot show saved.
- [ ] Malformed/oversized/partially missing draft is contained without overwrite.
- [ ] Explicit corrupt-draft deletion requires confirmation.
- [ ] Approved New Appointment behaviour is exact.
- [ ] Manual save, autosave, refresh, rotation and `pagehide` characterization.
- [ ] Full legacy fixture restores without migration.
- [ ] Saved Zoom pages rebuild once, in order, without duplicate listeners/thumbnails.

**Implementation steps:**

- [ ] Extract only narrow persistence helpers from existing save/load code.
- [ ] Add verified save/read-back without changing field ownership.
- [ ] Add approved capacity messaging/guard.
- [ ] Add non-destructive corruption handling and explicit deletion.
- [ ] Implement approved New Appointment semantics.
- [ ] Fix saved whiteboard thumbnail restoration.
- [ ] Add lifecycle persistence only if tests prove it necessary and it reuses the same serializer.

**Risks:** Storage-shape drift, synchronous large-string work, accidental deletion, duplicate whiteboard setup.

**Acceptance criteria:** No false save, complete legacy/current round trip, safe corruption path, approved deletion semantics, visible whiteboard pages restored, no business/PDF changes.

**Commit:** `feat: migrate to IndexedDB with retention, recovery and approved draft semantics`

**Review gate:** Stop for storage/privacy review.

## Phase 4: Offline State and User Messaging

**Purpose:** Give truthful, accessible feedback without treating network presence as cache readiness.

**Files:**

- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Create: `tests/offline-status-presentation.test.mjs`
- Modify: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**

- `resolveOfflineStatus({ online, readiness, draftState, generationState })` returns stable presentation-only `{ code, message, tone }`.
- Existing live-region/status elements announce transitions.
- Network `online`/`offline` listeners are registered once and cleaned up with the application lifecycle.

**Tests first:**

- [ ] Ready, preparing, offline, save-failed, missing-template, reconnected and update states.
- [ ] `navigator.onLine === true` with incomplete cache never reports ready.
- [ ] Status text and ARIA update together and do not rely on colour.
- [ ] Repeated mode/navigation changes do not duplicate listeners/mutations.
- [ ] Existing draft/PDF confidence states remain correct.

**Implementation:** Reuse existing ASG tokens/status components, add only narrow presentation helpers and actionable text approved in the specification.

**Risks:** Noisy announcements, status conflicts, excessive DOM updates.

**Acceptance criteria:** Accurate status after every tested transition, keyboard/screen-reader compatibility, no layout regression at seven approved viewports.

**Commit:** `feat: add truthful offline appointment status`

**Review gate:** Stop for UX/accessibility approval.

## Phase 5: Offline Package Generation Assessment

**Purpose:** Preserve the bonus fully local generation path and improve only proven recovery defects.

**Files:**

- Modify only if a failing test requires it: `js/app.js`
- Modify: `tests/complete-appointment-package.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`
- Create: `tests/offline-package-generation.test.mjs`

**Tests first:**

- [ ] In-person and Zoom packages generate offline with complete cache.
- [ ] Combined PDF and ZIP download with current exact filenames/content.
- [ ] Prepared email recipient/CC/subject/body remain unchanged.
- [ ] Missing template blocks generation, keeps draft, and identifies reconnection.
- [ ] Interrupted generation does not mark output ready or delete draft.
- [ ] Reconnection and retry succeeds.

**Implementation:** If all bonus tests pass after Phases 2–4, make no generation change. If a narrow failure exists, fix only missing-resource recovery/status; do not alter PDF layout, ZIP contents or email copy.

**Risks:** Scope creep into PDF/email behaviour and large memory use.

**Acceptance criteria:** Existing output bytes/visual smoke remain within current contracts; draft safety is unchanged; bonus is documented with limitations.

**Commit:** `test: verify offline appointment package handover` if test-only, otherwise `fix: recover offline package generation safely`

**Review gate:** Stop for PDF/handover regression review.

## Phase 6: Installation Research and Screenshots

**Purpose:** Capture current, approved physical installation paths without outdated or simulated platform chrome.

**Files:**

- Modify: `tests/user-guide-screenshots.spec.mjs` only for app-controlled deterministic states
- Modify: `docs/user-guides/screenshots.json`
- Add approved images under `docs/user-guides/screenshots/`
- Create: `docs/testing/offline-installation-evidence.md`

**Tests/manual work:**

- [ ] Verify official Google/Apple guidance URLs and review date.
- [ ] Capture Windows Chrome, Android Chrome, iPhone Safari and iPad Safari physical installation evidence.
- [ ] Redact notifications/account/device identifiers; use fictional app data.
- [ ] Verify standalone launch, icon/name and offline cold start.
- [ ] Hash/classify screenshots through `npm run docs:screenshots`.

**Risks:** Menu drift, copyrighted source screenshots, personal information, nondeterministic OS chrome.

**Acceptance criteria:** Every published platform instruction has physical evidence and an official source; no platform is marked PASS from emulation.

**Commit:** `docs: capture verified application installation`

**Review gate:** Stop for platform/content/privacy review.

## Phase 7: Offline Workflow Screenshots

**Purpose:** Produce deterministic app screenshots for readiness, save/load, recovery and handover.

**Files:**

- Modify: `tests/user-guide-screenshots.spec.mjs`
- Modify: `docs/user-guides/screenshots.json`
- Add/update: `docs/user-guides/screenshots/*.png`
- Create or modify a small annotation utility only if the existing pipeline lacks one: `scripts/docs/annotations.mjs`
- Add focused tests to `tests/documentation-automation.test.mjs`

**Tests first:**

- [ ] Fixed locale/timezone/date, colour scheme, reduced motion, loaded fonts, scale factor and hidden caret.
- [ ] Deterministic fictional Save Draft, Load Draft, readiness, offline, package and whiteboard states.
- [ ] Annotation positions remain inside image bounds and do not cover control labels.
- [ ] Hash metadata is stable on identical rerun.

**Acceptance criteria:** Required 13-state screenshot plan is covered; unchanged images remain unchanged; visual heuristics produce reviewed warnings only.

**Commit:** `docs: capture offline appointment workflow`

**Review gate:** Stop for screenshot approval.

## Phase 8: Canonical User Guide v1.1 Rewrite

**Purpose:** Convert the current feature manual into the approved 25-section field handbook.

**Files:**

- Modify: `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`
- Modify: `docs/user-guides/README.md`
- Modify: `scripts/generate-sales-appointment-user-guide.py`
- Modify tests: `tests/documentation-generation.test.mjs`, `tests/user-guide-artifacts.test.mjs`

**Tests first:**

- [ ] Required 25 headings and ordering.
- [ ] Guide version `1.1.0`, application version unchanged.
- [ ] Cover contains no branch/full source commit.
- [ ] Callout labels and accessible non-colour styling.
- [ ] In-person/Zoom comparison and email handover sequence.
- [ ] Required Common Mistakes, privacy warning, no invented retention period.
- [ ] One-page quick reference and final checklist.
- [ ] Technical provenance appears only in metadata/technical section/report.

**Implementation:** Rewrite canonical Markdown, extend generator styles/TOC support only as necessary, and embed approved screenshots/annotations. Do not generate final artifacts until Phase 9.

**Risks:** Unsupported guarantee, staff overload, generator layout drift.

**Acceptance criteria:** Content review maps every statement to verified behaviour/policy; all 25 sections exist; cover/provenance contract passes.

**Commit:** `docs: rewrite sales appointment field guide v1.1`

**Review gate:** Stop for business/content approval.

## Phase 9: DOCX/PDF Generation and Validation

**Purpose:** Generate and validate canonical v1.1 artifacts without retaining the obsolete fixed 17-page contract.

**Files:**

- Modify: `scripts/docs/validation.mjs`
- Modify: `scripts/docs-user-guide.mjs`
- Modify if needed: `scripts/docs/documents.mjs`, `scripts/docs/config.mjs`
- Modify: `tests/documentation-validation.test.mjs`
- Modify: `tests/documentation-orchestration.test.mjs`
- Modify: `tests/documentation-pipeline.integration.test.mjs`
- Regenerate: canonical DOCX/PDF, `documentation-report.md`, `changelog.md`
- Modify: `docs/user-guides/screenshots.json` only if Phase 7-approved hashes require it

**Interfaces:**

- `validatePdfArtifact({ path, expectedPages })` receives the approved v1.1 page count from guide configuration/metadata.
- Report records actual and expected pages; mismatch remains a failure.

**Tests first:**

- [ ] Fixed 17-page constant removed.
- [ ] Approved v1.1 expected count passes; ±1 drift fails.
- [ ] DOCX headings, links, properties and image relationships validate.
- [ ] PDF A4, unencrypted, exact approved count, non-blank and no clipping warnings.
- [ ] Contents links validated where format/tooling supports them.

**Commands:**

```powershell
npm run docs:user-guide
npm run docs:validate
node tests/documentation-validation.test.mjs
node tests/user-guide-artifacts.test.mjs
git diff --check
```

**Risks:** LibreOffice pagination varies, clickable links differ by output, warnings are mistaken for approval.

**Acceptance criteria:** Deterministic structure/order, approved exact page count, artifact/hash validation, human DOCX/PDF review, no runtime changes during generation.

**Commit:** `docs: generate and validate user guide v1.1`

**Review gate:** Stop for canonical artifact approval.

## Phase 10: Complete Regression and Physical-Device Handoff

**Purpose:** Prove no application regression and hand off an evidence-complete physical RC gate.

**Files:**

- Modify: `docs/testing/2.7.0-alpha.1-physical-device-rc-checklist.md`
- Create: `docs/testing/offline-appointment-physical-uat.md`
- Modify release-readiness documentation only after physical evidence and explicit authorization
- No runtime changes unless a separately approved defect phase is opened

**Automated commands:**

```powershell
node --check js/app.js
node --check service-worker.js
Get-ChildItem tests -Filter *.test.mjs | ForEach-Object { node $_.FullName }
node tests/ia-pdf-visual-smoke.mjs
node test-smoke/phase5-regression.js
npm run docs:screenshots
npm run docs:validate
python -m py_compile scripts/generate-sales-appointment-user-guide.py
git diff --check
git status --short
```

**Manual checks:**

- [ ] Windows Chrome installed app.
- [ ] Android Chrome installed app.
- [ ] iPhone Safari Home Screen app.
- [ ] iPad Safari Home Screen app, portrait/landscape.
- [ ] Airplane-mode cold launch and same-device draft reopen.
- [ ] Touch signature, camera/file input and whiteboard saved pages.
- [ ] Keyboard, safe area, rotation, browser chrome.
- [ ] Complete active-draft service-worker upgrade and offline reload.
- [ ] Reconnect, PDF/ZIP downloads, secure-context mail handoff.
- [ ] Approved deletion/retention procedure.

**Risks:** Environment-only failures, browser storage eviction, physical results diverge from emulation.

**Acceptance criteria:** Zero unresolved release-blocking defects, evidence for every supported platform, no HIGH privacy/durability finding unresolved, all automated gates pass, guide claims match physical evidence.

**Commit:** `test: complete offline appointment release validation`

**Review gate:** Stop for explicit GO/NO-GO. Do not push, merge or deploy automatically.

## Rollback Strategy

1. Stop at the failing phase; do not continue to dependent phases.
2. Preserve the previous reviewed commit and working artifacts.
3. Use `git revert <phase-commit>` for an already committed local phase; do not reset or rewrite history.
4. For uncommitted work, inspect `git diff` and remove only files created by that phase after confirming no user-owned changes overlap.
5. Never clear a real browser profile or device draft during rollback; tests use isolated fictional profiles.
6. Retain the last known complete service-worker cache during failed update tests.
7. Regenerate canonical guide outputs only from the last approved Markdown/screenshots/metadata state.

## Final Validation Gate

- [ ] Audit, specification and this plan are approved.
- [ ] All blocking product/policy decisions are recorded.
- [ ] Application and guide version contracts are correct.
- [ ] Every phase has its own reviewed commit.
- [ ] Complete automated suite passes with exact counts recorded.
- [ ] Physical supported-device matrix passes.
- [ ] No temporary browser, server, LibreOffice or Poppler process/artifact remains.
- [ ] Working tree is clean.
- [ ] Integration, push and deployment each receive separate authorization.

## Expected Deliverables

### New

- `js/db.js` (IndexedDB wrapper)
- `tests/helpers/offline-fixtures.mjs`
- `tests/fixtures/offline-draft-v2.7.0-alpha.1.json`
- `tests/offline-draft-persistence.test.mjs`
- `tests/offline-draft-recovery.test.mjs`
- `tests/offline-draft-retention.test.mjs`
- `tests/offline-draft-migration.test.mjs`
- `tests/offline-readiness.test.mjs`
- `tests/offline-status-presentation.test.mjs`
- `tests/offline-package-generation.test.mjs`
- `docs/testing/offline-installation-evidence.md`
- `docs/testing/offline-appointment-physical-uat.md`
- approved installation/offline screenshots
- optional `scripts/docs/annotations.mjs` only if existing tooling cannot annotate safely

### Modified

- `service-worker.js`
- `js/app.js`
- `index.html` and `css/app.css` only where approved status/recovery UI requires them
- existing service-worker, whiteboard, package, UX and documentation tests
- `tests/user-guide-screenshots.spec.mjs`
- `docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`
- `docs/user-guides/screenshots.json`
- canonical DOCX/PDF, report and changelog during Phase 9
- documentation generator/validation modules required for TOC, callouts and page-count contract
- physical RC checklists

### Unchanged unless separately approved

- appointment field IDs, business rules and validation;
- PDF layouts, overlay coordinates and filename/business rules;
- storage keys;
- prepared-email recipient/content rules;
- application version;
- cloud/server/deployment architecture.

## Plan Self-Review

- **Specification coverage:** All offline contract, platform, installation, persistence, service-worker, messaging, privacy, guide, screenshot, validation and physical gates map to a phase.
- **Dependency safety:** Runtime work cannot start before HIGH findings are resolved; guide claims wait for runtime and physical evidence.
- **Scope:** No cloud sync, auth, background email or PDF redesign was introduced.
- **Test-first:** Every runtime/document phase begins with focused failing or characterization tests.
- **Rollback:** Every phase is independently revertible without history rewriting.
- **Completeness:** Every implementation action has an exact file, interface, test, command and acceptance result.
- **Current decision:** **NO-GO for implementation** until the Pre-Implementation Approval Gate is complete.
