# Staff Dropdown Metadata Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make configured staff metadata authoritative while keeping landing and workspace staff selection native, non-editable, backward compatible, and safe when no staff are configured.

**Architecture:** Extend `adminSettings.staff.options` in place from strings to `{id,name,email,office,active}` objects. Centralise normalisation, active-option rendering, selected-record lookup, and CC resolution in narrow helpers inside the existing standalone application; retain an intentionally empty `DEFAULT_STAFF_OPTIONS` insertion point.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, localStorage, Node.js, Playwright.

## Global Constraints

- Keep application version `2.7.0-alpha.1`.
- Increment service-worker cache to `v2.7.0-alpha.6` because tracked assets change.
- Do not fabricate production staff names, emails, or offices.
- Preserve existing storage keys, drafts, IDs, workflows, PDF output, and fixed primary share recipient.
- Do not resume RC, merge, push, or deploy.

---

### Task 1: Staff model and migration

**Files:**
- Modify: `js/app.js`
- Test: `tests/staff-dropdown-seeding-v2.test.mjs`

- [ ] Write browser regression cases for empty, legacy string, partial object, mixed, duplicate, inactive, and user-added configurations.
- [ ] Run the focused test and confirm it fails because staff remains string-based/free-text.
- [ ] Add deterministic staff normalisation and deduplication using `adminSettings.staff.options` only.
- [ ] Run the focused test and confirm migration cases pass.

### Task 2: Native staff controls and empty guidance

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Test: `tests/staff-dropdown-seeding-v2.test.mjs`

- [ ] Add failing assertions for disabled placeholders, SELECT-only controls, active filtering, draft recovery, synchronisation, guidance, settings route, and 44px targets.
- [ ] Implement native select rendering for landing and workspace without a free-text product mode.
- [ ] Implement accessible empty-state guidance and route to existing Global Settings.
- [ ] Run focused tests until green.

### Task 3: Metadata settings and share CC resolution

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`
- Modify: `js/app.js`
- Test: `tests/staff-dropdown-seeding-v2.test.mjs`

- [ ] Add failing assertions for settings add/edit/deactivate, metadata persistence, validation, selected-staff CC, fallback CC, and duplicate suppression.
- [ ] Render and persist staff name, email, office, and active fields through existing settings lifecycle.
- [ ] Resolve share CC from selected staff email, then fallback CC, without duplicate recipients.
- [ ] Run focused tests until green.

### Task 4: Cache and authoritative verification

**Files:**
- Modify: `service-worker.js`
- Test: existing repository suites

- [ ] Bump cache version from `v2.7.0-alpha.5` to `v2.7.0-alpha.6` without changing cache strategy/assets.
- [ ] Run syntax, diff, focused, premium landing/workspace, responsive/accessibility, Phase 5, share, service-worker upgrade, and all target tests.
- [ ] Verify IDs, versions, clean migration, and no unrelated diff.
- [ ] Commit one focused corrective commit only if every required check passes.
