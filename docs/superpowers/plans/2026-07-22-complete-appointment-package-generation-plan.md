# Complete Appointment Package Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee that every successful final-generation operation returns and retains one valid combined PDF and one valid ZIP from the same appointment snapshot.

**Architecture:** Add a validated, revision-bound `lastAppointmentPackage` cache and one `buildAppointmentPackage()` orchestration function inside the existing application module. Preserve existing generation primitives and UI action meanings, but route final generation, downloads, native Share, and mailto fallback through the complete package result.

Concurrent calls for one revision share a single in-flight package promise. Async renderers must verify their captured revision before publishing artifacts, and appointment-mode or staff changes invalidate generated state before reuse.

**Tech Stack:** Browser JavaScript, Blob/File APIs, existing canvas PDF generator, existing Store ZIP writer, Node test runner, Playwright-based browser tests.

## Global Constraints

- Keep application version `2.7.0-alpha.1`.
- Advance service-worker cache from `v2.7.0-alpha.13` to `v2.7.0-alpha.14`.
- Preserve PDF content, page order, overlay coordinates, EOI/IA rules, signatures, email content, storage shapes, and UI action design.
- Add no dependency, backend, storage persistence, new button, or server action.
- Do not push, merge, deploy, or restart the RC server.

---

### Task 1: Characterize the Existing Artifact Pipeline

**Files:**
- Create: `tests/complete-appointment-package.test.mjs`
- Inspect: `js/app.js`

**Interfaces:**
- Consumes: existing browser `_testState`, `buildPdf()`, `buildIndividualPdfs()`, `buildZip()`, download/share actions.
- Produces: failing behavioral assertions for the complete package contract.

- [ ] **Step 1: Add a deterministic browser fixture** that loads test data, selects Contract Due Date TBC, and captures generated downloads, Files, ZIP entries, and generation call counts.
- [ ] **Step 2: Assert one operation returns `combinedPdfBlob`, `combinedPdfFile`, `zipBlob`, `zipFile`, `individualPdfs`, `generatedAt`, `filenames`, and `revision`.**
- [ ] **Step 3: Assert Blob signatures, MIME types, non-zero sizes, File names/types, one shared timestamp, unique exact ZIP entries, and stable filenames.**
- [ ] **Step 4: Assert sanitisation for `John / Jane : Smith`, `Unit 4\\Example? Street`, `../Unsafe`, blank values, leading dots, and repeated whitespace.**
- [ ] **Step 5: Assert invalid/incomplete cache cases are rejected:** ZIP-only, PDF-only, empty individual array, zero-byte PDF/ZIP, duplicate entries, and stale revision.
- [ ] **Step 6: Assert reuse without edits and regeneration after a field edit using observable build counters.**
- [ ] **Step 7: Assert Generate, Download PDF, Download Package, Share/native Share, and fallback all obtain the shared complete result without changing Prompt 3 email content.**
- [ ] **Step 8: Run `node tests/complete-appointment-package.test.mjs` and verify RED because the shared package API/result does not exist and ZIP-only failure remains possible.**

### Task 2: Add Complete-Package Validation and Revision State

**Files:**
- Modify: `js/app.js` near generated-state declarations and `clearGenerated()`
- Test: `tests/complete-appointment-package.test.mjs`

**Interfaces:**
- Produces: `validPdfBlob(blob)`, `validZipBlob(blob)`, `validIndividualPdfs(pdfs)`, `validAppointmentPackage(result)`, `documentRevision`, and `lastAppointmentPackage`.

- [ ] **Step 1: Add explicit asynchronous signature validators** for `%PDF-` and ZIP `PK` bytes plus MIME/size validation.
- [ ] **Step 2: Add complete synchronous structure validation** for Files, timestamp, filenames, unique entries, and revision, after signature validation marks construction complete.
- [ ] **Step 3: Increment `documentRevision` and clear complete/partial package state in `clearGenerated()` without changing storage or UI behavior.**
- [ ] **Step 4: Expose narrow test accessors for validation, revision, and cache injection.**
- [ ] **Step 5: Run the focused test and confirm validation/cache cases pass while orchestration cases remain RED.**

### Task 3: Implement the Shared Generation Pipeline

**Files:**
- Modify: `js/app.js` around `buildPdf`, `buildIndividualPdfs`, and `buildZip`
- Test: `tests/complete-appointment-package.test.mjs`

**Interfaces:**
- Produces: `buildAppointmentPackage()` returning the authoritative package result.
- Preserves: `buildPdf(generatedAt)`, `buildIndividualPdfs()`, `buildZip(pdfs, name)` as generation primitives.

- [ ] **Step 1: Change `buildPdf` to accept one operation timestamp** and reuse it for `currentGeneratedAt` instead of capturing a separate time.
- [ ] **Step 2: Harden standalone-PDF reuse** so only a non-empty array of valid, uniquely named PDF entries is accepted.
- [ ] **Step 3: Implement `buildAppointmentPackage()`** to capture/reuse one timestamp, build missing valid parts, construct both Files, validate signatures and the complete result, cache it, and return it.
- [ ] **Step 4: Ensure PDF failure and ZIP failure reject the operation** and never store `lastAppointmentPackage`; retain only safe partial state for retry at the same revision.
- [ ] **Step 5: Run the focused test and confirm artifact, timestamp, cache, failure, and call-count cases pass.**

### Task 4: Route All Final-Generation Entry Points

**Files:**
- Modify: `js/app.js` functions `generatePdfOnly`, `downloadPdf`, `sharePdf`, and `downloadPackage`
- Test: `tests/complete-appointment-package.test.mjs`
- Test: `tests/mobile-rc-defects-v2.test.mjs`
- Test: `tests/prepared-email-rewrite.test.mjs`

**Interfaces:**
- Consumes: `buildAppointmentPackage()` complete result.
- Preserves: action IDs, download meanings, native Share payload, fallback downloads, and Prompt 3 email contract.

- [ ] **Step 1: Route Generate through the complete package** and retain the existing combined-PDF preview/status semantics.
- [ ] **Step 2: Route Download PDF through the complete package** but download only `combinedPdfBlob` under the existing action.
- [ ] **Step 3: Route Download Package through the complete package** and download both Files only after both exist.
- [ ] **Step 4: Route native Share/fallback through the complete package**, pass both Files to native Share, and keep the existing two-download compatibility fallback.
- [ ] **Step 5: Remove ZIP-error swallowing and PDF-only package success messages.**
- [ ] **Step 6: Run focused package, mobile Share, prepared-email, Contract Due Date, and conveyancer tests; confirm GREEN.**

### Task 5: Harden Filename Sanitisation and Cache Version

**Files:**
- Modify: `js/app.js` function `safePart`
- Modify: `service-worker.js`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`
- Test: `tests/complete-appointment-package.test.mjs`

**Interfaces:**
- Produces: safe readable filename components with traversal and hidden-dot prevention.

- [ ] **Step 1: Extend `safePart`** to replace invalid/path characters, eliminate `..`, collapse whitespace, trim edge punctuation, prevent dotfiles, preserve readable content, and fall back safely.
- [ ] **Step 2: Verify all touched filename helpers use `safePart` for dynamic components and preserve approved templates.**
- [ ] **Step 3: Advance `CACHE_VERSION` to `v2.7.0-alpha.14` and update upgrade tests from `v2.7.0-alpha.13`.**
- [ ] **Step 4: Run focused filename and service-worker tests; confirm GREEN.**

### Task 6: Full Verification and Focused Commit

**Files:**
- Verify all modified files.

**Interfaces:**
- Produces: one verified local commit with no temporary artifacts.

- [ ] **Step 1: Run syntax and whitespace checks:** `node --check js/app.js`, `node --check service-worker.js`, and `git diff --check`.
- [ ] **Step 2: Run every `tests/*.mjs` suite**, including package, PDF/ZIP, IA overlay, PDF visual smoke, Contract Due Date, conveyancer, email, mobile, landing/workspace, and service-worker suites.
- [ ] **Step 3: Run `node test-smoke/phase5-regression.js`** and require 61/61.
- [ ] **Step 4: Run deterministic manual-smoke cases** for full in-person, Zoom, reuse, invalidation, incomplete cache, and hostile filename inputs; record exact artifact names and entries.
- [ ] **Step 5: Remove only generated smoke artifacts and confirm the RC server on port 8766 was not started.**
- [ ] **Step 6: Confirm application/cache versions and clean scope diff.**
- [ ] **Step 7: Stage the specification, plan, runtime, cache, and tests; commit locally as `fix: generate complete appointment package`.**
- [ ] **Step 8: Re-run the focused package test and Phase 5 after commit, then confirm a clean worktree.**
