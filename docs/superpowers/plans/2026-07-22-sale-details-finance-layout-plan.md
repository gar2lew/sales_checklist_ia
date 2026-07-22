# Sale Details Finance Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the in-person Sale Details schedule layout and split its finance percentage into independent Client 1 and Client 2 fields without changing Zoom or unrelated workflows.

**Architecture:** Keep the existing controls and event pipeline, replacing the visible legacy finance select with two labelled selects and retaining a hidden legacy compatibility projection. Use narrow presentation/state helpers for Client 2 visibility and legacy draft restoration. Map only Client 1 to the existing single finance location in the standard EOI PDF; the approved templates provide no verified Client 2 finance target.

**Tech Stack:** Static HTML, CSS Grid, vanilla JavaScript, Node `.test.mjs` characterization tests, Playwright browser checks, service worker.

## Global Constraints

- Branch remains `fix/staff-dropdown-seeding-v2`; do not push, merge, or deploy.
- Application version remains `2.7.0-alpha.1`; cache advances from `v2.7.0-alpha.18` to `v2.7.0-alpha.19`.
- Preserve storage keys, appointment rules, Contract Due Date behavior, email wording, package structure, filenames, PDF geometry, and all unrelated controls.
- In-person alone receives the two finance controls and EOI date/time layout.
- Zoom retains Client Review Next Appointment Date beside Contract Due Date, with no new time or finance controls and no exposed EOI-only fields.

---

### Task 1: Characterize the new layout, finance state, and compatibility contract

**Files:**
- Create: `tests/sale-details-finance-layout.test.mjs`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: current DOM, draft helpers, generated standard EOI PDF source, Client 2 participation behavior.
- Produces: failing assertions for the two new IDs, order/wrappers, legacy mapping, independent persistence, output mapping, invalidation binding, Zoom boundary, and cache `.19`.

- [ ] Write source and browser-level tests asserting `client1FinancePercentage`, `client2FinancePercentage`, identical 10–90% options, in-person DOM order, single Contract Due Date group, mobile grid rules, Client 2 state, legacy `eoiFinancePercent` mapping only to Client 1, independent draft values, malformed-value rejection, Client 1 standard-PDF mapping, and unchanged Zoom schedule controls.
- [ ] Run `node tests/sale-details-finance-layout.test.mjs` and the service-worker tests; verify failures are caused by missing Hotfix 3 behavior and cache `.18`.

### Task 2: Implement the in-person Sale Details structure and responsive layout

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: existing `eoiNextApptDate`, `eoiNextApptTime`, and `contractDueDateField` controls.
- Produces: `.sale-finance-grid`, `.sale-schedule-grid`, `#inPersonNextAppointmentGroup`, `#client2FinancePercentageField`; mobile DOM order remains finance fields, date, time, Contract Due Date, TBC.

- [ ] Replace the visible legacy select with two labelled selects using the existing option set; keep `#eoiFinancePercent` as a hidden compatibility field.
- [ ] Move the existing in-person date/time controls into one logical left group and the unchanged Contract Due Date group into the right grid cell.
- [ ] Add CSS Grid rules: balanced two-column finance/schedule layout on wide screens and single-column stacking below the content-driven mobile breakpoint, with 44px controls and no overflow.
- [ ] Run the focused test and verify structural/layout assertions pass while runtime compatibility assertions remain red.

### Task 3: Implement finance state, draft compatibility, output mapping, and invalidation

**Files:**
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `hasClient2()`, `fields`, `getDraft()`, `setDraft(data)`, `applyPdfDefaults(force)`, `bindFieldEvents`, `placeContractDueDateField()`.
- Produces: `financePercentageOptions`, `normalizeFinancePercentage(value)`, `syncClient2FinanceState()`, and a legacy Client 1 projection.

- [ ] Add both new IDs to the existing field/event pipeline so changes invalidate packages and draft values remain independent.
- [ ] Synchronize the hidden legacy field from Client 1, map a valid legacy-only draft to Client 1 during restoration, never map it to Client 2, and reject unsupported values to blank.
- [ ] Apply the existing finance default to Client 1 only and update Load Test Data accordingly.
- [ ] Hide and natively disable Client 2 finance when `hasClient2()` is false; preserve its saved value in state but ignore it while Client 2 is absent, matching current non-destructive draft behavior.
- [ ] Keep in-person Contract Due Date after the complete date/time group; for Zoom, keep it after `#crNextAppointmentDate` without exposing either finance field or a time field.
- [ ] Map Client 1 to the existing single standard EOI PDF finance location; do not alter coordinates or La Vida overlays because no separate approved finance targets exist.
- [ ] Run the focused tests and related draft/PDF/package tests until green.

### Task 4: Update cache and RC documentation

**Files:**
- Modify: `service-worker.js`
- Modify: `docs/releases/2.7.0-alpha.1-rc-notes.md`
- Modify: `docs/releases/2.7.0-alpha.1-known-issues.md`
- Modify: `docs/testing/2.7.0-alpha.1-physical-device-rc-checklist.md`
- Modify: deployment checklist only if its current contract records the cache or RC checks.

**Interfaces:**
- Produces: cache `v2.7.0-alpha.19` and explicit unverified physical-device retest items.

- [ ] Advance only `CACHE_VERSION` to `.19` and update exact cache assertions.
- [ ] Document the in-person layout split, unchanged Zoom layout, legacy mapping, standard-PDF Client 1 limitation, and physical retest status without marking physical checks passed.
- [ ] Run service-worker install/upgrade/browser-upgrade/offline tests.

### Task 5: Full verification, browser validation, commit, and RC server restart

**Files:**
- Verify all changed files; create no committed screenshots or generated artifacts.

**Interfaces:**
- Produces: one local commit `feat: refine sale details finance layout` and a live RC server on `0.0.0.0:8766` only after every gate passes.

- [ ] Run `node --check js/app.js`, `node --check service-worker.js`, and `git diff --check`.
- [ ] Run every `tests/*.test.mjs`, `node tests/ia-pdf-visual-smoke.mjs`, and `node test-smoke/phase5-regression.js`; require `61/61 PASS`.
- [ ] Use Playwright against all ten required viewports to verify no overflow, correct in-person arrangement, unchanged Zoom arrangement, active controls, and package invalidation.
- [ ] Remove temporary screenshots and generated artifacts; confirm only intended files remain.
- [ ] Commit once with `git commit -m "feat: refine sale details finance layout"`.
- [ ] Stop only the stale process on port 8766, restart `python -m http.server 8766 --bind 0.0.0.0`, verify localhost and LAN HTTP 200 plus cache `.19`, and leave it running.

## Self-review

- Spec coverage: layout, in-person/Zoom distinction, finance persistence, compatibility, output limitation, invalidation, accessibility, responsive viewports, cache, docs, full verification, commit, and RC server are assigned above.
- Placeholder scan: no TBD/future implementation placeholders remain.
- Interface consistency: IDs and helper names are consistent across structure, runtime, tests, and documentation; the legacy ID remains a compatibility projection and is never used as a second authoritative value.
