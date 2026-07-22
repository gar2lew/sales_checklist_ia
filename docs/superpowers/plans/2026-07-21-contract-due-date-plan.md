# Contract Due Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared Contract Due Date/TBC control whose blank state is draftable but blocks final generation, while exposing a resolver for later email integration.

**Architecture:** Extend the existing `index.html` appointment-information card and the existing flat `fields` draft path. Keep interaction, resolver, restoration presentation, and validation narrowly contained in `js/app.js`; reuse existing validation and CSS patterns without changing email or PDF rendering.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Playwright browser regression tests, Node assertion tests, existing service worker.

## Global Constraints

- Keep application version `2.7.0-alpha.1`.
- Advance only service-worker cache `v2.7.0-alpha.10` to `v2.7.0-alpha.11`.
- Preserve `salesAppointmentDraft` and the existing flat draft object; no migration.
- Do not change prepared-email wording, Contract Issued, attachment wording, PDF layout/overlays, conveyancer controls, permissions, or unrelated workflows.
- Do not push, merge, deploy, or restart the RC server.
- Deliver one local commit: `feat: add contract due date selection`.

---

### Task 1: Focused Contract Due Date behavior tests

**Files:**
- Create: `tests/contract-due-date.test.mjs`

**Interfaces:**
- Consumes: existing landing flow, draft buttons, generation buttons, `salesAppointmentDraft`, and validation classes.
- Produces: executable behavior contract for IDs `contractDueDate`, `contractDueDateTbc`, and `contractDueDateField`; resolver `resolveContractDueDate()` returning `{ valid:boolean, value:string }`.

- [ ] Add a Playwright test that verifies one shared control after Appointment Date, unique IDs, native `type=date`, blank initial state, labelled checkbox, 44px targets, and visibility in both modes.
- [ ] Add interaction assertions: date clears TBC; TBC clears/disables date; unchecking re-enables without restoring the date; viewport resize and mode rerender preserve state.
- [ ] Add draft assertions for a date, TBC, and a legacy draft missing both fields.
- [ ] Add final-generation assertions that blank Save Draft succeeds but Generate PDF stops with `aria-invalid`, `.fieldError`, and no ready PDF; date and TBC each permit the existing generation path.
- [ ] Add source/behavior assertions for `resolveContractDueDate()`: date → `DD/MM/YYYY`, TBC → `To Be Confirmed`, blank → `{valid:false,value:''}`; assert the prepared-email template strings remain unchanged.
- [ ] Run `node tests/contract-due-date.test.mjs` and confirm RED because the IDs/resolver are absent.

### Task 2: Shared control, exclusivity, resolver, and draft restoration

**Files:**
- Modify: `index.html` near `#date` in `#appointmentInfoSection`
- Modify: `css/app.css` only if existing form/toggle rules cannot supply the approved layout/touch targets
- Modify: `js/app.js` field list and form helpers

**Interfaces:**
- Produces: `contractDueDate` ISO string, `contractDueDateTbc` boolean, `syncContractDueDateState()`, and `resolveContractDueDate()`.

- [ ] Add a shared `contractDueDateField` form group immediately after the Appointment Date control, containing `<input id="contractDueDate" type="date">`, `<input id="contractDueDateTbc" type="checkbox">`, explicit labels, and an `aria-describedby` relationship for inline guidance.
- [ ] Add both IDs to `fields` without changing any existing order/value semantics.
- [ ] Implement `syncContractDueDateState()` so TBC clears/disables the date and unchecked TBC enables it; bind date input/change to clear TBC when a nonblank date is selected.
- [ ] Implement `resolveContractDueDate()` using `formatDisplayDate`: valid selected date returns Australian text, checked TBC returns the literal label, blank returns invalid with an empty value.
- [ ] Call state synchronization after event changes, `setDraft()`, `refreshAllUI()`, and reset paths; legacy drafts remain blank/unchecked/enabled.
- [ ] Run the focused test and resolve only UI, interaction, resolver, and draft failures.

### Task 3: Final-generation validation boundary

**Files:**
- Modify: `js/app.js` in `validateBeforePdf(plan)` and validation presentation
- Test: `tests/contract-due-date.test.mjs`

**Interfaces:**
- Consumes: `resolveContractDueDate()`.
- Produces: inline message `Select a Contract Due Date or choose To Be Confirmed.` on final generation only.

- [ ] Add the resolver failure to both Zoom and in-person `validateBeforePdf(plan)` error collections, targeting `contractDueDate` and the shared field group.
- [ ] Preserve Save Draft/autosave behavior with blank state.
- [ ] Ensure `buildPdf()` remains the common validation boundary used by Generate PDF, package creation, and sharing; do not modify email text or PDF drawing.
- [ ] Ensure either a date or TBC clears the due-date validation and allows the pre-existing readiness/generation rules to continue.
- [ ] Run the focused test until GREEN, then run mobile/accessibility and draft/share regression tests.

### Task 4: Cache contract and authoritative verification

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`
- Modify only if required by the new mandatory final-generation input: existing test fixtures that generate PDFs/packages

**Interfaces:**
- Produces: cache `v2.7.0-alpha.11`; unchanged app version `2.7.0-alpha.1`.

- [ ] Advance the cache constant and update upgrade tests from alpha.10 to alpha.11 without changing cache strategy/assets.
- [ ] Update existing generation fixtures to select explicit TBC where the tested behavior is unrelated to Contract Due Date; do not weaken new blank-state tests.
- [ ] Run syntax checks, `git diff --check`, all tests under `tests/*.mjs`, and `node test-smoke/phase5-regression.js` expecting 61/61.
- [ ] Confirm prepared-email wording, Contract Issued, attachment wording, PDF overlay coordinates, conveyancer controls, app version, storage key, and legacy draft shape remain unchanged.
- [ ] Remove temporary test artifacts and verify a clean diff contains only Prompt 1 files.

### Task 5: Focused local commit

**Files:**
- Include: plan, HTML/CSS if needed, runtime JS, service worker, and directly affected tests.

- [ ] Stage only Prompt 1 changes and run `git diff --cached --check`.
- [ ] Commit locally with `feat: add contract due date selection`.
- [ ] Reconfirm HEAD, clean working tree, app/cache versions, and no RC server listener.

## Self-review

- Every approved UI, interaction, draft, resolver, validation, accessibility, version, and regression requirement maps to a task.
- The plan never adds Contract Due Date to email wording or PDF rendering.
- Blank is explicitly accepted by draft paths and rejected only by `buildPdf()` final-generation validation.
- The resolver cannot infer TBC from blank.
- Existing IDs, storage key, flat draft structure, Contract Issued, attachment wording, and conveyancer behavior are protected.
- No placeholders, alternative names, or unresolved implementation decisions remain.
