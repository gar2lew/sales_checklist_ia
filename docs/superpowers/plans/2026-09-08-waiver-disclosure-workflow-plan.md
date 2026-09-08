# Waiver & Disclosure Workflow — Implementation Plan

**Date:** 08/09/2026  
**Application:** Sales Appointment Capture v2.7.0-alpha.1  
**Status:** Test-First Plan — Ready for Design Review  
**Depends On:** `docs/superpowers/specs/2026-09-08-waiver-disclosure-workflow-design.md`

---

## Overview

Test-first implementation divided into 12 focused phases. Each phase:
1. Adds failing tests first
2. Implements minimal code to pass
3. Runs verification commands
4. Commits with conventional message
5. Stop/review gate before next phase

**No runtime changes until design review approval.**

---

## Phase 1: Waiver Template Characterisation & PDF Field/Render Tests

**Objective:** Characterise the authoritative Waiver & Disclosure template and establish PDF rendering test infrastructure.

### Files
- `tests/waiver-template-characterisation.test.mjs` (new)
- `js/app.js` — `drawWaiverPage()` stub

### Failing Tests First
```javascript
// Template loads and has expected page count (6)
// Page dimensions: 595.32 × 841.92 pts (A4)
// No AcroForm fields present
// Page 6 contains exactly 3 fill-in fields: CLIENT'S NAME, CLIENT'S SIGNATURE, DATE
// Verified coordinates for each field
// Generated PDF is valid (PDF header, correct page count)
// Filename format matches specification
```

### Minimal Implementation
- Add `ASG-Disclosure-Waiver-2026.pdf` to `templates/` and `APP_SHELL` in `service-worker.js`
- Implement `drawWaiverPage()` with calibrated coordinates (verified from PDF)
- Add `ensureWaiverImage()` loader
- Register in `outputPlan()` / `zoomOutputPlan()`

### Verification Commands
```bash
npm test -- tests/waiver-template-characterisation.test.mjs
# All tests pass
```

### Acceptance Criteria
- [ ] Template loads offline (cached in service worker)
- [ ] Page count = 6, dimensions = A4 (595.32 × 841.92)
- [ ] No AcroForm fields detected
- [ ] Page 6 field coordinates verified:
    - Client 1 Name: label x=54, value x=59, y=599.71, width~301
    - Client 1 Signature: label x=54, value x=59, y=537.55, width~307
    - Client 1 Date: label x=54, value x=54, y=475.51, width~116
- [ ] 2 signatures render correctly (Client 1, Client 2) — reusing existing `sig`/`sig2` canvases
- [ ] PDF validates via `validPdfBlob()`
- [ ] Single page output (template page 6 only)

### Commit Message
```
test: characterise waiver and disclosure template
```

### Stop/Review Gate
Template characterised and coordinate tests passing. Product decisions on date behavior and Client 2 labels resolved.

---

## Phase 2: Landing Screen Third Option

**Objective:** Add "Waiver & Disclosure" as third mode card on landing screen.

### Files
- `index.html` — landing screen mode cards
- `js/app.js` — `updateContinueButtonText()`, `checkForRecentDraft()`, `enterAppointment()`
- `tests/landing-waiver-option.test.mjs` (new)

### Failing Tests First
```javascript
// Three mode cards render in order: In-Person, Zoom, Waiver & Disclosure
// Third card has data-mode="waiverOnly" and 📋 icon
// Hint text updates: "Standalone Waiver & Disclosure — no appointment forms"
// Continue button: "Start Waiver & Disclosure" when waiverOnly selected
// Recent draft card shows "Waiver & Disclosure" for waiver drafts
```

### Minimal Implementation
1. Add third `<button class="mode-card" data-mode="waiverOnly">` in `index.html`
2. Update `updateContinueButtonText()` for waiverOnly case
3. Update `checkForRecentDraft()` to detect `appointmentMode === 'waiverOnly'`
4. Update `enterAppointment()` to handle `waiverOnly` mode
5. Add `waiver-only` CSS class handling in `applyAppointmentMode()`

### Verification Commands
```bash
npm test -- tests/landing-waiver-option.test.mjs
# Visual: open index.html, verify three cards, hints, button text
```

### Acceptance Criteria
- [ ] Three cards render correctly
- [ ] Selection state persists
- [ ] Continue button text correct per mode
- [ ] Recent draft card shows waiver type
- [ ] No regression on In-Person/Zoom cards

### Commit Message
```
feat: add Waiver & Disclosure landing screen option
```

### Stop/Review Gate
Visual review of landing screen on mobile and desktop viewports.

---

## Phase 3: Waiver-Only Workflow Shell

**Objective:** Implement the simplified 3-stage Waiver-Only workflow (Client Details → Waiver & Disclosure → Ready).

### Files
- `index.html` — three new sections with `waiver-only` class
- `js/app.js` — timeline, validation, generation for waiver-only
- `css/app.css` — `.waiver-only` visibility rules
- `tests/waiver-only-workflow.test.mjs` (new)

### Failing Tests First
```javascript
// When appointmentMode === 'waiverOnly':
// - Only 3 timeline steps render (Client Details, Waiver, Ready)
// - In-Person/Zoom sections hidden
// - Client 1 required, Client 2 optional
// - No EOI/IA/Photos/Checklist/Whiteboard in DOM or timeline
// - outputPlan() returns waiver-only page plan (1 page)
// - validateBeforePdf() uses waiver-only rules (Client 1 name/sig/date required; Client 2 conditional)
// - buildPdf() generates single waiver PDF
// - Filename: "{date} - {Client Names} - Waiver and Disclosure.pdf"
// - Prepare Email uses waiver-specific template
// - No ZIP generated
```

### Minimal Implementation
1. Add three `waiver-only` sections to `index.html`:
   - `waiverClientDetailsSection`
   - `waiverDetailsCard`
   - `waiverReadySection`
2. Add `waiver-only` to timeline HTML (3 steps)
3. Extend `applyAppointmentMode()` for `waiverOnly` class
4. Implement `waiverOutputPlan()` returning single waiver page
5. Extend `validateBeforePdf()` with waiver-only validation
6. Add `waiverOnlyPdfFileName()` generator
7. Add `buildWaiverOnlyEmailContent()` 
9. Wire Ready section buttons (Generate, Download, Prepare Email)

### Verification Commands
```bash
npm test -- tests/waiver-only-workflow.test.mjs
# Visual: complete waiver-only flow end-to-end
```

### Acceptance Criteria
- [ ] Clean 3-step timeline
- [ ] No irrelevant sections visible
- [ ] Validation matches spec (Client 1 req, Client 2 opt)
- [ ] Single PDF generates with correct filename
- [ ] Prepare Email opens with waiver template
- [ ] No ZIP button or generation
- [ ] Draft save/load works

### Commit Message
```
feat: implement Waiver & Disclosure only workflow shell
```

### Stop/Review Gate
Full end-to-end waiver-only flow verified on mobile and desktop.

---

## Phase 4: Optional Include Waiver in In-Person

**Objective:** Add "Include Waiver & Disclosure" checkbox to In-Person workflow with conditional timeline stage.

### Files
- `index.html` — checkbox in Appointment Info, waiver timeline step, waiver section
- `js/app.js` — `updateWaiverDetails()`, timeline, validation, outputPlan
- `tests/inperson-waiver-option.test.mjs` (new)

### Failing Tests First
```javascript
// Checkbox "Include Waiver & Disclosure" appears in Appointment Info
// Default OFF — no waiver UI, no validation, no output impact
// When checked:
  // - Waiver timeline step appears at position 4 (after IA, before ID Docs)
  // - Waiver section renders with pre-filled fields (Client 1/2 name, date)
  // - waiverReadiness() validation runs (Client 1 name/sig/date required; Client 2 conditional)
  // - Generation fails if waiver incomplete
  // - Combined PDF includes waiver after IA (single page 6)
  // - ZIP includes standalone waiver PDF
  // - Draft save/restore preserves waiver state
// When unchecked after data entry:
  // - Waiver data preserved in draft (per spec)
  // - No validation, no output
```

### Minimal Implementation
1. Add checkbox `#includeWaiver` in Appointment Info section (`index.html`)
2. Add `waiverDetailsCard` section (in-person-only) with waiver fields:
   - Client 1 Name (pre-filled from `clientName`)
   - Client 1 Signature (uses existing `sig` canvas)
   - Client 1 Date (defaults to appointment `date`)
   - Client 2 Name (pre-filled from `client2Name`, conditional)
   - Client 2 Signature (uses existing `sig2` canvas, conditional)
   - Client 2 Date (defaults to appointment `date`, conditional)
3. Add waiver timeline step (position 4) in `timelineInPerson`
4. Implement `updateWaiverDetails()` toggling section visibility
5. Implement `waiverReadiness()` validation function
6. Extend `outputPlan()` to include waiver page when `includeWaiver` checked
7. Extend `validateBeforePdf()` and `structuredReadinessCheck()`
8. Extend `getDraft()`/`setDraft()` for waiver object
9. Add `individualWaiverFilename()` generator
10. Update email builder to mention waiver

### Verification Commands
```bash
npm test -- tests/inperson-waiver-option.test.mjs
# Visual: toggle checkbox, verify timeline, validation, generation
```

### Acceptance Criteria
- [ ] Checkbox default OFF, no side effects
- [ ] Checked → timeline inserts waiver stage correctly
- [ ] Fields pre-fill from appointment data
- [ ] Validation blocks generation when enabled
- [ ] Draft round-trip preserves all waiver state
- [ ] Combined PDF order: EOI → IA → Waiver → Photos
- [ ] ZIP includes waiver PDF with correct name
- [ ] Email mentions waiver
- [ ] Unchecked preserves data (spec: "preserve entered waiver data")

### Commit Message
```
feat: add optional Waiver & Disclosure to In-Person workflow
```

### Stop/Review Gate
Complete In-Person + Waiver flow verified with draft save/reopen offline.

---

## Phase 5: Optional Include Waiver in Zoom

**Objective:** Add "Include Waiver & Disclosure" checkbox to Zoom Outputs section with conditional timeline stage.

### Files
- `index.html` — checkbox in `zoomOutputsSection`, waiver timeline step, waiver section
- `js/app.js` — `zoomOutputPlan()`, zoom timeline, validation
- `tests/zoom-waiver-option.test.mjs` (new)

### Failing Tests First
```javascript
// Checkbox appears in Zoom Outputs section alongside EOI/IA checkboxes
// Default OFF — no waiver UI, no validation, no output impact
// When checked:
  // - Waiver timeline step appears before Ready (position 8)
  // - Waiver section renders (zoom-only)
  // - zoomOutputPlan() includes waiver page
  // - Combined booklet includes waiver at end (single page 6)
  // - ZIP includes standalone waiver PDF
  // - Draft save/restore preserves waiver state
```

### Minimal Implementation
1. Add `#zoomIncludeWaiver` checkbox in `zoomOutputsSection`
2. Add `zoomWaiverDetailsCard` section (zoom-only) with same fields as Phase 4
3. Add waiver timeline step in `timelineZoom` (before Ready)
4. Extend `zoomOutputPlan()` for waiver page
5. Extend zoom validation in `validateBeforePdf()` / `structuredReadinessCheck()`
6. Add `zoomWaiverFilename()` generator
7. Ensure draft persistence works (reuses waiver object from Phase 4)

### Verification Commands
```bash
npm test -- tests/zoom-waiver-option.test.mjs
# Visual: toggle checkbox, verify timeline, booklet, ZIP
```

### Acceptance Criteria
- [ ] Checkbox in Outputs section, default OFF
- [ ] Checked → timeline inserts waiver before Ready
- [ ] Zoom booklet order: Cover → FC → CR → EOI → IA → Whiteboard → Waiver
- [ ] ZIP includes waiver PDF
- [ ] Draft round-trip works
- [ ] No regression on existing Zoom checkboxes

### Commit Message
```
feat: add optional Waiver & Disclosure to Zoom workflow
```

### Stop/Review Gate
Complete Zoom + Waiver flow verified with draft save/reopen offline.

---

## Phase 6: Draft/Offline Persistence

**Objective:** Ensure waiver data fully integrates with IndexedDB draft system, offline save/load, 7-day expiry, New Appointment protection, corrupt draft handling.

### Files
- `js/db.js` — schema version bump to 2 (optional, backward compatible)
- `js/app.js` — `getDraft()`, `setDraft()`, `loadDraft()` handling
- `tests/waiver-draft-persistence.test.mjs` (new)

### Failing Tests First
```javascript
// Waiver object saved in draft for all three modes
// Draft load restores: included, mode, fields, signatures
// 7-day expiry applies to waiver drafts
// New Appointment dialog shows for waiver drafts
// Corrupt waiver draft handled by existing quarantine logic
// Offline: save, close, reopen, verify waiver state intact
// Reconnection: draft loads, generation works
```

### Minimal Implementation
1. Bump `DB_VERSION` to 2 in `js/db.js` (signals new structure)
2. `getDraft()`: include full `waiver` object with fields and signatures
3. `setDraft()`: restore `waiver` object, handle missing gracefully
4. `loadDraft()`: existing logic handles schema version, expiry
5. Verify `removeExpiredDrafts()` works with waiver drafts
6. Test offline: save → disconnect → reopen → verify → reconnect → generate

### Verification Commands
```bash
npm test -- tests/waiver-draft-persistence.test.mjs
npm test -- tests/offline-capability-research.test.mjs (existing)
# Manual: offline save/load/reconnect cycle
```

### Acceptance Criteria
- [ ] Waiver data persists across all three modes
- [ ] Schema version 2 handles legacy drafts (no waiver object)
- [ ] 7-day expiry enforced
- [ ] New Appointment dialog protects waiver drafts
- [ ] Corrupt draft quarantine works
- [ ] Offline save/load/reopen verified
- [ ] Reconnection generation works

### Commit Message
```
feat: integrate Waiver & Disclosure with draft persistence and offline
```

### Stop/Review Gate
Offline capability audit re-run with waiver drafts — all matrix scenarios pass.

---

## Phase 7: PDF Generation

**Objective:** Complete PDF rendering for waiver in all contexts.

### Files
- `js/app.js` — `drawWaiverPage()`, `drawOutputPage()` dispatch, `buildIndividualPdfs()`
- `tests/waiver-pdf-generation.test.mjs` (new)

### Failing Tests First
```javascript
// drawWaiverPage() renders all fields at verified coordinates
// 2 signatures render (Client 1, Client 2) — reusing existing sig/sig2 canvases
// Combined PDF (In-Person): waiver after IA, before photos (single page 6)
// Combined PDF (Zoom): waiver at end of booklet (single page 6)
// Standalone waiver PDF: single page 6, correct filename
// Individual waiver PDF in ZIP: correct filename
// validPdfBlob() passes for all waiver PDFs
// Preview refresh shows waiver page
// Client 2 block renders at offset Y position when Client 2 present
```

### Minimal Implementation
1. Complete `drawWaiverPage()` with calibrated template coordinates:
   - Load page 6 of `ASG-Disclosure-Waiver-2026.pdf` as template
   - Overlay Client 1 fields at: Name (x=59, y=599.71), Signature (x=59, y=537.55), Date (x=54, y=475.51)
   - If Client 2 present: overlay Client 2 fields at offset Y (e.g., y≈410 for Name, y≈350 for Signature, y≈285 for Date)
   - Draw signatures from `sig`/`sig2` canvases scaled to signature line width (~307pts)
   - Add generated footer
2. Add waiver dispatch in `drawOutputPage()` for both modes
3. Ensure `buildIndividualPdfs()` includes waiver group
4. Verify preview works for waiver pages
5. Test all filename generators

### Verification Commands
```bash
npm test -- tests/waiver-pdf-generation.test.mjs
# Visual: preview all waiver pages, download PDFs, verify content
```

### Acceptance Criteria
- [ ] Waiver page renders correctly in all contexts
- [ ] Signatures align with template underscore lines
- [ ] Combined PDF page order correct
- [ ] Standalone PDF generates for waiver-only
- [ ] Individual waiver PDF in ZIP
- [ ] Preview navigation includes waiver pages
- [ ] Client 2 block appears only when Client 2 name entered

### Commit Message
```
feat: complete Waiver & Disclosure PDF generation
```

### Stop/Review Gate
PDF output visually verified against authoritative template.

---

## Phase 8: Combined PDF / ZIP Integration

**Objective:** Verify Combined PDF and ZIP packaging with waiver included.

### Files
- `js/app.js` — `buildAppointmentPackageForRevision()`, `buildZip()`, filename arrays
- `tests/waiver-zip-integration.test.mjs` (new)

### Failing Tests First
```javascript
// Combined PDF (In-Person + Waiver) includes waiver page
// Combined PDF (Zoom + Waiver) includes waiver page
// ZIP contains no duplicate Combined PDF
// ZIP entry names unique (uniquePackageEntryNames)
// ZIP filename unchanged
// Individual waiver PDF in ZIP has correct name
// validZipBlob() passes
// isValidAppointmentPackage() passes with waiver
```

### Minimal Implementation
1. Verify `buildOutputGroups()` includes waiver group
2. Verify `zoomOutputPlan()` groups include waiver
3. Verify `uniquePackageEntryNames()` handles waiver filename
4. Test ZIP structure: existing docs + waiver PDF only
5. Test Combined PDF includes waiver in correct position

### Verification Commands
```bash
npm test -- tests/waiver-zip-integration.test.mjs
# Manual: Download Package, unzip, verify contents
```

### Acceptance Criteria
- [ ] Combined PDF correct in both modes
- [ ] ZIP contains all individual docs + waiver (no duplicate Combined)
- [ ] Filenames unique and correct
- [ ] ZIP validates
- [ ] Package validation passes

### Commit Message
```
feat: integrate Waiver & Disclosure into Combined PDF and ZIP
```

### Stop/Review Gate
Download Package verified on multiple appointments with/without waiver.

---

## Phase 9: Email Handover

**Objective:** Implement email templates for standalone waiver and combined appointment with waiver.

### Files
- `js/app.js` — `buildWaiverOnlyEmailContent()`, `buildShareEmailContent()` update
- `tests/waiver-email-handover.test.mjs` (new)

### Failing Tests First
```javascript
// Standalone waiver email:
  // - To: CONFIG.share.to
  // - CC: staff email or fallback
  // - Subject: "Waiver & Disclosure | {Client Names} | {date}"
  // - Body: plain English, instructs manual PDF attachment
  // - No ZIP reference
// Combined appointment email with waiver:
  // - Existing structure preserved
  // - One added line: "Waiver & Disclosure: Included"
// Prepare Email button works in waiver-only Ready section
```

### Minimal Implementation
1. Implement `buildWaiverOnlyEmailContent()`
2. Add waiver mention to `buildShareEmailContent()` when `waiver.included`
3. Wire `prepareReadyEmail()` for waiver-only mode (reuse existing button)
4. Test mailto: link construction

### Verification Commands
```bash
npm test -- tests/waiver-email-handover.test.mjs
# Manual: Prepare Email, verify mailto: content
```

### Acceptance Criteria
- [ ] Standalone email template correct
- [ ] Combined email adds waiver line only when included
- [ ] No automatic attachment claim
- [ ] Plain English language throughout
- [ ] CC resolution works

### Commit Message
```
feat: add Waiver & Disclosure email handover templates
```

### Stop/Review Gate
Email content reviewed for compliance with plain-English requirement.

---

## Phase 10: Full Regression

**Objective:** Complete regression suite covering all existing functionality.

### Files
- `tests/phase5-regression.js` (existing) — extend
- `tests/waiver-regression.test.mjs` (new)

### Failing Tests First
```javascript
// All existing Phase 5 regression tests pass
// In-Person without waiver: identical behaviour to pre-waiver
// Zoom without waiver: identical behaviour to pre-waiver
// Package generation: identical when waiver not included
// Offline: all existing scenarios pass
// User guide generation: unchanged
// Service worker upgrade: unchanged
// New: waiver-specific regression scenarios
```

### Minimal Implementation
1. Run existing regression suite
2. Fix any regressions introduced
3. Add waiver-specific regression tests

### Verification Commands
```bash
npm test -- tests/phase5-regression.js
npm test -- tests/waiver-regression.test.mjs
# Full test suite pass
```

### Acceptance Criteria
- [ ] All existing tests pass
- [ ] No behavioural regression in In-Person
- [ ] No behavioural regression in Zoom
- [ ] Offline matrix passes
- [ ] Service worker upgrade passes

### Commit Message
```
test: full regression suite for Waiver & Disclosure workflow
```

### Stop/Review Gate
Full test suite green. Manual spot-check of critical paths.

---

## Phase 11: Field Guide Update

**Objective:** Document required changes to Sales Appointment Capture Field Guide v1.1.0.

### Files
- `docs/waiver-disclosure/FIELD_GUIDE_CHANGES.md` (new) — documents required changes only
- `USER_GUIDE.md` — NOT modified in this task
- `scripts/docs/` — NOT modified in this task

### Required Changes (Documentation Only)

| Section | Change |
|---------|--------|
| 1. Overview | Add "Waiver & Disclosure" as third appointment type |
| 2. Getting Started | Landing screen: three options, updated screenshot |
| 3. Step-by-Step | New "Waiver & Disclosure Only" workflow subsection |
| 3. In-Person | Add "Include Waiver & Disclosure" checkbox description |
| 3. Zoom | Add "Include Waiver & Disclosure" checkbox in Outputs |
| 4. Auto-Fill | Waiver fields pre-fill from appointment data |
| 6. Sharing | Standalone waiver email: attach PDF manually |
| 7. Drafts | Waiver data included in draft save/load |
| 8. Settings | No new settings required |
| 9. Troubleshooting | Waiver validation messages |
| Screenshots | Landing (3 cards), In-Person checkbox, Waiver section, Waiver-only timeline, Ready section |
| Quick Reference | Add waiver row |
| Final Checklist | Add waiver verification items |

### Acceptance Criteria
- [ ] `FIELD_GUIDE_CHANGES.md` complete and accurate
- [ ] No changes to canonical guide in this task
- [ ] Screenshot plan documented

### Commit Message
```
docs: document Field Guide v1.1 changes for Waiver & Disclosure
```

### Stop/Review Gate
Documentation lead reviews change list.

---

## Phase 12: Physical-Device Handoff

**Objective:** Prepare for physical device testing (not executed in this task).

### Files
- `docs/waiver-disclosure/PHYSICAL_HANDOFF_CHECKLIST.md` (new)

### Checklist Content
- [ ] Windows Chrome installed app: cold launch, waiver flow, save, restart, load, generate, download, email
- [ ] Android Chrome: camera signatures, touch waiver fields, offline save, restart, generate
- [ ] iPhone Safari: safe areas, waiver signatures, Add to Home Screen, offline
- [ ] iPad Safari: landscape waiver layout, whiteboard (N/A), file handling
- [ ] Service worker upgrade with active waiver draft
- [ ] Storage quota test with waiver + photos + signatures
- [ ] Corrupt waiver draft recovery on each platform

### Acceptance Criteria
- [ ] Checklist document complete
- [ ] No physical testing in this task

### Commit Message
```
docs: add physical-device handoff checklist for Waiver & Disclosure
```

---

## Test Strategy Summary

| Test File | Phase | Scope |
|-----------|-------|-------|
| `waiver-template-characterisation.test.mjs` | 1 | Template PDF, field coordinates, signatures |
| `landing-waiver-option.test.mjs` | 2 | Landing screen 3-mode selection |
| `waiver-only-workflow.test.mjs` | 3 | Standalone waiver 3-stage flow |
| `inperson-waiver-option.test.mjs` | 4 | In-Person + Waiver integration |
| `zoom-waiver-option.test.mjs` | 5 | Zoom + Waiver integration |
| `waiver-draft-persistence.test.mjs` | 6 | IndexedDB, offline, expiry, corrupt |
| `waiver-pdf-generation.test.mjs` | 7 | PDF rendering, combined, standalone |
| `waiver-zip-integration.test.mjs` | 8 | ZIP packaging, filenames, validation |
| `waiver-email-handover.test.mjs` | 9 | Email templates, mailto: content |
| `waiver-regression.test.mjs` | 10 | Full regression, no regressions |
| Existing `phase5-regression.js` | 10 | Pre-existing functionality |

---

## Commit Strategy

| Commit | Message | Phase |
|--------|---------|-------|
| 1 | `test: characterise waiver and disclosure template` | 1 |
| 2 | `feat: add Waiver & Disclosure landing screen option` | 2 |
| 3 | `feat: implement Waiver & Disclosure only workflow shell` | 3 |
| 4 | `feat: add optional Waiver & Disclosure to In-Person workflow` | 4 |
| 5 | `feat: add optional Waiver & Disclosure to Zoom workflow` | 5 |
| 6 | `feat: integrate Waiver & Disclosure with draft persistence and offline` | 6 |
| 7 | `feat: complete Waiver & Disclosure PDF generation` | 7 |
| 8 | `feat: integrate Waiver & Disclosure into Combined PDF and ZIP` | 8 |
| 9 | `feat: add Waiver & Disclosure email handover templates` | 9 |
| 10 | `test: full regression suite for Waiver & Disclosure workflow` | 10 |
| 11 | `docs: document Field Guide v1.1 changes for Waiver & Disclosure` | 11 |
| 12 | `docs: add physical-device handoff checklist for Waiver & Disclosure` | 12 |

**No pushes.** All commits local until design review approval.

---

## Validation Gates

Before each commit:
```bash
git status
git diff --check
# Syntax check on new test files
node --check tests/<new-test>.mjs
# Run relevant test suite
npm test -- tests/<phase-test>.test.mjs
```

Final validation after Phase 10:
```bash
npm test
# Full suite passes
git status
# Working tree clean (only docs and test files added)
```

---

## GO/NO-GO for Implementation

**Current Status: NO-GO** — Design review required before implementation.

**Required for GO:**
1. ✅ Research complete (authoritative template verified)
2. ✅ Specification complete
3. ✅ Implementation plan complete
4. ✅ Authoritative template provided and characterised (`templates/ASG-Disclosure-Waiver-2026.pdf`)
5. ❌ Design review approved
6. ❌ Product decisions resolved:
   - Date field behavior (auto-fill vs manual)
   - Client 2 labels on page 6
   - Legal review of clause 18 with two clients

**Recommendation:** Proceed to design review with current deliverables. Implementation begins after design review approval and product decisions resolved.