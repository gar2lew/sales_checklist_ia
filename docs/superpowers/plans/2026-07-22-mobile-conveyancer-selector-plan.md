# Mobile Conveyancer Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `#iaSolicitor` datalist interaction with a native three-option selector and deliberate custom-text mode while preserving one legacy-compatible resolved draft/PDF value.

**Architecture:** Keep the existing single-file runtime and dynamic `#solicitorControl` boundary. Add `#iaSolicitorOption` and `#iaSolicitorOther` as visible projections while retaining hidden `#iaSolicitor` as the authoritative resolved value consumed by drafts and PDFs. Synchronize locally on select/custom input events and reconstruct visible state from the resolved value during existing rerenders.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, Playwright-based Node tests, service-worker cache tests, Phase 5 browser regression suite.

## Global Constraints

- Exact options/order: `B.O.S.S Conveyancing`, `Natalie to Confirm`, `Other`.
- Fresh default: `B.O.S.S Conveyancing`.
- Preserve `salesAppointmentDraft` and its flat `iaSolicitor` field; no new storage key or migration.
- Preserve Contract Due Date, prepared email, Contract Issued, attachment wording, PDF layout/overlays, EOI, ZIP/package actions, and application workflow.
- Keep application version `2.7.0-alpha.1`.
- Advance only service-worker cache `v2.7.0-alpha.11` to `v2.7.0-alpha.12`.
- Do not push, merge, deploy, or restart the RC server.
- Deliver one local commit: `fix: improve mobile conveyancer selection`.

---

### Task 1: Characterize the approved selector contract

**Files:**
- Create: `tests/mobile-conveyancer-selector.test.mjs`
- Read: `tests/rc-email-conveyancer-zip-polish.test.mjs`
- Read: `tests/contract-due-date.test.mjs`

**Interfaces:**
- Consumes: the current rendered `#solicitorControl`, `salesAppointmentDraft`, `window._testState`, and existing PDF canvas capture conventions.
- Produces: failing behavior assertions for the new selector without modifying runtime code.

- [ ] Add a Playwright regression suite asserting exact option order, default selection/resolved value, B.O.S.S and Natalie selection, Other disclosure, no automatic focus, hidden custom input disabled/focus-excluded, accessible labels, and 44px control heights.
- [ ] Add draft assertions for custom round-trip and legacy restoration of B.O.S.S, Natalie, arbitrary custom text, and missing/blank values.
- [ ] Add resize/orientation assertions proving custom mode/value survive the existing `renderConfigurableFields()` path without focus or scroll jumps.
- [ ] Capture IA canvas text for standard and custom resolved values using the existing PDF smoke technique.
- [ ] Assert the Contract Due Date controls and resolver remain present and unchanged, application version stays `2.7.0-alpha.1`, and cache is expected to become `v2.7.0-alpha.12`.
- [ ] Run `node tests/mobile-conveyancer-selector.test.mjs` and confirm RED because `#iaSolicitorOption` and `#iaSolicitorOther` do not exist and the cache remains alpha.11.

### Task 2: Implement the native selector and synchronized resolved field

**Files:**
- Modify: `js/app.js` at `renderConfigurableControl`, solicitor state helpers, and test exposure only where needed
- Modify: `css/app.css` beside existing form-control styling

**Interfaces:**
- Consumes: `fieldText('iaSolicitor')`, `bindFieldEvents`, `clearGenerated`, existing draft restoration, and HTML escaping helpers.
- Produces: `resolveIaSolicitor()` returning the trimmed resolved string and a synchronized hidden `#iaSolicitor` for unchanged consumers.

- [ ] Define fixed semantic option values for B.O.S.S, Natalie, and Other without mutating Global Settings options or configuration architecture.
- [ ] Replace only the solicitor branch of `renderConfigurableControl()` with labelled `#iaSolicitorOption`, labelled `#iaSolicitorOther`, and hidden `#iaSolicitor` markup.
- [ ] Map the current resolved value to standard/Other mode before DOM replacement; use B.O.S.S only when current resolved value is blank.
- [ ] Add a narrow state synchronizer that hides/disables custom input for standard options, shows/enables it for Other, writes exactly one resolved value to `#iaSolicitor`, and dispatches the existing resolved-field change path without rerendering the form.
- [ ] Bind selection changes without calling `.focus()` and bind custom `input`/`change` locally so keystrokes update the resolved field without rebuilding the control.
- [ ] Add scoped CSS for stacked custom mode and minimum 44px select/input targets; rely on existing `scroll-margin-block` focus behavior and do not add automatic scrolling unless the focused-field test demonstrates it is necessary.
- [ ] Run `node tests/mobile-conveyancer-selector.test.mjs` and iterate to GREEN.

### Task 3: Preserve draft restoration and downstream behavior

**Files:**
- Modify: `js/app.js` only if the focused suite exposes restoration ordering or standard-option preservation issues
- Modify: `tests/rc-email-conveyancer-zip-polish.test.mjs` only where datalist-specific assertions are obsolete
- Modify: affected generation fixtures only when required by the new visible-control interaction

**Interfaces:**
- Consumes: flat draft `iaSolicitor`, existing `setDraft()`, `getDraft()`, `fieldText('iaSolicitor')`, and IA renderer.
- Produces: unchanged persisted shape and exact resolved PDF strings.

- [ ] Ensure draft capture still contains only `iaSolicitor` for this feature and no `iaSolicitorOption`/`iaSolicitorOther` properties.
- [ ] Ensure `setDraft()` reconstructs standard or Other mode from the restored resolved string after dynamic control rendering.
- [ ] Prevent arbitrary legacy custom values from being promoted into the fixed three-option selector while leaving Global Settings data untouched.
- [ ] Verify B.O.S.S, Natalie, and `Example Legal & Conveyancing` resolve exactly and reach IA PDF rendering unchanged.
- [ ] Run the focused selector, RC email/conveyancer/ZIP, draft, IA overlay, and IA PDF visual/package suites.

### Task 4: Cache and authoritative regression gate

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: current alpha.11 service-worker upgrade contract.
- Produces: alpha.12 cache invalidation with unchanged strategy and manifest.

- [ ] Change only `CACHE_VERSION` from `v2.7.0-alpha.11` to `v2.7.0-alpha.12` and update upgrade-test expectations from alpha.11 to alpha.12.
- [ ] Run `node --check js/app.js`, `node --check service-worker.js`, and `git diff --check`.
- [ ] Run every `tests/*.mjs` suite, including configuration/staff, Contract Due Date, draft/handover, IA, responsive accessibility, mobile RC, service worker, and premium landing/workspace.
- [ ] Run `node test-smoke/phase5-regression.js` and require 61/61.
- [ ] Remove only generated smoke artifacts, verify application version `2.7.0-alpha.1`, cache `v2.7.0-alpha.12`, no RC server listener, and a focused diff.

### Task 5: Focused local commit

**Files:**
- Include: approved specification, this plan, runtime/style changes, focused tests, necessary regression fixture updates, and cache tests.

**Interfaces:**
- Consumes: verified clean staged diff.
- Produces: one local commit with no remote action.

- [ ] Stage only Prompt 2 files and run `git diff --cached --check`.
- [ ] Inspect staged status/stat for unrelated changes or generated artifacts.
- [ ] Commit with `fix: improve mobile conveyancer selection`.
- [ ] Confirm branch, HEAD, versions, and clean working tree; do not push, merge, deploy, or restart the RC server.

## Self-Review

- Every approved dropdown, focus, mobile, draft, resolver, PDF, accessibility, version, and regression requirement maps to an explicit task.
- The plan retains exactly one persisted source of truth (`iaSolicitor`) and introduces no key, schema, migration, or configuration refactor.
- Other-mode selection never auto-focuses; hidden custom input is disabled; custom typing does not rerender the control.
- Legacy arbitrary values remain custom rather than becoming fixed dropdown options.
- Blank legacy values follow the existing fresh-default convention and resolve to B.O.S.S.
- No placeholders, contradictory IDs, or unresolved implementation decisions remain.
