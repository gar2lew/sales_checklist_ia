# Minimum Commercial UX Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement only the seven approved minimum commercial-polish recommendations from `docs/design/UX_POLISH_BACKLOG.md` without changing workflow, business rules, storage, generation, or field contracts.

**Architecture:** Keep layout and visual hierarchy in the existing ASG token system in `css/app.css`. Add only small status containers in `index.html` and narrow presentation helpers in `js/app.js` that read existing Client 2, draft, and generated-output state; they may update text, classes, visibility, and ARIA presentation but may not alter stored data or operational semantics.

**Tech Stack:** Static HTML, CSS design tokens, vanilla JavaScript, Node syntax checks, Playwright browser regression checks.

## Global Constraints

- Implement only H1, H2, H3, H5, H6/H7, H8, and H10 from `docs/design/UX_POLISH_BACKLOG.md`.
- Preserve the landing page, all field IDs, accessibility and keyboard behavior, workflow, validation, PDF generation, output invalidation, localStorage keys and object shapes, draft semantics, signatures, photos, downloads, packages, and sharing.
- JavaScript additions must be presentation-only and must reuse existing refresh/invalidation events.
- Use existing ASG tokens, semantic status colours, restrained bronze, one icon language, and subtle feedback.
- Do not bump version, merge, deploy, or commit screenshots.

## Files

- Modify: `index.html` — presentation-only status containers/classes; no ID removals or field changes.
- Modify: `css/app.css` — seven-item workspace polish using existing tokens; landing selectors remain unchanged.
- Modify: `js/app.js` — narrow Client 2 and draft/PDF presentation helpers only.
- Create: `tests/ux-polish-presentation.test.mjs` — focused DOM/state/interaction regression coverage.
- Modify: `docs/design/UX_POLISH_BACKLOG.md` — mark only the seven approved items complete and record evidence/limitations.
- Create without staging: `screenshots/ux-polish/` — per-item and final visual evidence.

---

### Task 1: Baseline Contracts and Focused Test Harness

**Files:**
- Create: `tests/ux-polish-presentation.test.mjs`
- Create without staging: `screenshots/ux-polish/baseline-*.png`

**Interfaces:**
- Consumes: current landing and workspace DOM, toolbar actions, existing `hasClient2`, draft, generated-output, and reset behavior.
- Produces: executable assertions for unchanged IDs/actions and the approved presentation states.

- [ ] Capture baseline workspace screenshots at 1920x1080, 1366x768, 768x1024, and 390x844 plus landing at 1366x768.
- [ ] Write focused browser assertions for all existing landing/workspace IDs, toolbar buttons, landing-to-workspace flow, and existing EOI/IA controls.
- [ ] Add failing assertions for H8: absent Client 2 shows visible text `Not required`; present Client 2 restores normal field/signature presentation immediately; removal restores `Not required`.
- [ ] Add failing assertions for H10: initial/reset is unsaved and not generated; Save Draft shows saved; field edit shows unsaved; Generate PDF shows ready; output-affecting edit shows generated output invalidated; Load Draft shows loaded-but-unsaved only if its loaded values differ from the last explicit save state.
- [ ] Add computed-style assertions for the approved H1/H2/H3/H5/H6/H7 class contracts and responsive footer touch targets.
- [ ] Run the focused test and verify it fails only because the approved presentation states/classes are absent.

### Task 2: H1 — One Readiness Model

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing `updateSummaryCard`, section badges, pending requirements, and header `#status` text.
- Produces: consistent `data-state`/semantic classes for neutral, attention, ready, saved, and invalidated presentation without changing readiness calculations.

- [ ] Verify the H1 readiness test fails against the baseline.
- [ ] Add semantic presentation classes/data attributes to existing readiness surfaces while preserving their text rules and ARIA behavior.
- [ ] Use ASG success, warning, danger, and neutral tokens; bronze remains an accent rather than a generic status colour.
- [ ] Run focused tests and capture `h1-readiness-1366x768.png`.
- [ ] Confirm no readiness calculation or validation list changed.

### Task 3: H8 — Optional Client 2 Presentation

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing `hasClient2()` result and existing refresh/update bindings.
- Produces: `updateClient2Presentation()` that changes only text, classes, visibility, and ARIA presentation on Client 2 summary/signature surfaces.

- [ ] Verify the three H8 state assertions fail at baseline.
- [ ] Add a stable presentation hook to the Client 2 summary column and signature count surface without changing existing field IDs.
- [ ] Implement `updateClient2Presentation()` to show explicit `Not required` text when absent and restore normal incomplete/complete presentation when present.
- [ ] Invoke it from existing summary/refresh paths so add/remove updates immediately.
- [ ] Run focused tests and capture absent/present comparison screenshots.
- [ ] Confirm Client 1, validation, PDF inclusion, and signature rules are unchanged.

### Task 4: H2 — Primary Action Hierarchy

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: unchanged toolbar/footer button IDs and event listeners.
- Produces: clear appointment-utility, output-sequence, and admin visual groups with one primary Generate action.

- [ ] Verify action-hierarchy class/style assertions fail at baseline.
- [ ] Add presentation-only group labels/classes where required; preserve button order, IDs, titles, and semantics.
- [ ] Align top and bottom button language to the existing primary/secondary/utility system without changing actions.
- [ ] Demote Load Test Data and Settings visually; keep them fully accessible.
- [ ] Run focused toolbar interaction tests and capture `h2-actions-1366x768.png` and `h2-actions-390x844.png`.

### Task 5: H10 — Persistent Draft and PDF Confidence

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing save/load success branches, `lastPdfBlob`, `lastPdfName`, `clearGenerated`, reset, and field input/change events.
- Produces: `updateDraftPresentation(state)` and `updateOutputPresentation(state)`; these set only visible text/classes/ARIA state and hold session-only presentation flags outside the saved draft object.

- [ ] Verify all H10 state assertions fail at baseline.
- [ ] Add compact persistent draft/output status elements with `role="status"` and `aria-live="polite"`.
- [ ] Update draft status only after successful save/load; mark unsaved after user edits; reset to neutral after New Appointment.
- [ ] Update PDF status only after successful generation; use existing `clearGenerated()` to show invalidated after a previously ready output is cleared by later edits; reset to neutral for a new appointment.
- [ ] Do not change localStorage calls, draft payloads, PDF functions, or invalidation triggers.
- [ ] Run focused state tests and capture saved/dirty/ready/invalidated screenshots.

### Task 6: H3 — Footer Obstruction and Responsive Touch Targets

**Files:**
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing fixed `.footerBar`, `.footerInner`, `.footerButtons`, and `.app` bottom padding.
- Produces: sufficient content clearance, safe-area-aware spacing, six-column/compact mobile layout, and minimum 44px touch targets without changing buttons.

- [ ] Verify footer clearance/touch-target assertions fail at baseline.
- [ ] Increase content bottom clearance using existing spacing tokens and safe-area inset.
- [ ] Prevent the six actions from wrapping into a hidden-label second row at supported phone widths; retain an understandable primary Generate treatment.
- [ ] Ensure each interactive target is at least 44px and filename remains readable/truncated without horizontal overflow.
- [ ] Run responsive tests and capture desktop/mobile footer comparisons.

### Task 7: H5 — Section Rhythm

**Files:**
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing `main > .card`, `.subsection`, headings, and grid structure.
- Produces: tokenised inter-card separation and consistent section-heading cadence without changing DOM order.

- [ ] Verify section-gap computed-style assertion fails at baseline.
- [ ] Add a single workspace-scoped card-flow rule using ASG spacing tokens; avoid per-card margins and duplicate selectors.
- [ ] Harmonise heading/helper spacing only within the workspace.
- [ ] Run focused tests and capture `h5-section-rhythm-1366x768.png`.

### Task 8: H6/H7 — Readability and Field Width

**Files:**
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing ASG type tokens and `.fields.two`/`.fields.three` grids.
- Produces: readable operational type floor and responsive two-column fallback for constrained workspace columns.

- [ ] Verify type-size and realistic-value width assertions fail at baseline.
- [ ] Raise summary/status/preview operational text with existing tokens instead of isolated pixel values.
- [ ] At constrained desktop/tablet widths, switch three-column workspace field groups to two columns while preserving mobile one-column behavior.
- [ ] Confirm long email/address/name values remain visually inspectable without horizontal overflow.
- [ ] Run focused tests and capture 1366x768 and 768x1024 comparisons.

### Task 9: Full Verification, Audit Update, and Commit

**Files:**
- Modify: `docs/design/UX_POLISH_BACKLOG.md`
- Create without staging: final screenshots under `screenshots/ux-polish/`

**Interfaces:**
- Consumes: completed seven-item presentation work.
- Produces: verified evidence, updated audit, and one requested branch commit.

- [ ] Capture final workspace screenshots at 1920x1080, 1366x768, 768x1024, and 390x844 plus landing at 1366x768.
- [ ] Verify landing screenshot/DOM against baseline and confirm landing styles are unchanged by this implementation.
- [ ] Run `node --check js/app.js`, `node --check service-worker.js`, `git diff --check`, existing tests, and the focused presentation-state test.
- [ ] Exercise every toolbar/footer action: Save Draft, Load Draft, Generate PDF, Download PDF, Download Package, Share fallback, Refresh Preview, New Appointment, landing flow, and EOI/IA toggles.
- [ ] Verify all pre-existing IDs remain present and no storage/PDF/service-worker/version contract changed.
- [ ] Mark only H1, H2, H3, H5, H6/H7, H8, and H10 complete in the audit; add implementation notes, screenshots, and residual limitations.
- [ ] Stage implementation/test/audit files only; explicitly exclude `screenshots/`.
- [ ] Commit on `polish/minimum-commercial-set` with `polish: implement minimum commercial ux set`.
