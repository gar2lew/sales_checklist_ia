# Premium Workspace v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the configured landing staff dropdown, fix iPhone light-surface rendering, and apply the approved premium visual language to the v2 workspace without changing workflow.

**Architecture:** Reuse the existing `adminSettings.staff.options` renderer and `landingStaff` event lifecycle. Add scoped CSS contracts after the reconciled responsive workspace rules, leaving HTML structure and protected logic intact. Bump only the service-worker cache identifier.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node.js, Playwright, repository smoke tests.

## Global Constraints

- Base commit is `51faff9769c9b7e1d2c96d5e17ec406f1beaf64c`.
- Application version remains `2.7.0-alpha.1`.
- Cache version changes only from `v2.7.0-alpha.3` to `v2.7.0-alpha.4`.
- Preserve every target ID, handler, workflow, validation rule, storage structure, and document-generation path.
- Do not push, deploy, merge to `main`, or resume physical-device RC.

---

### Task 1: Staff dropdown contract

**Files:**
- Modify: `tests/premium-landing-v2.test.mjs`
- Modify: `js/app.js:278-295`
- Modify: target tests that currently type arbitrary staff text

**Interfaces:**
- Consumes: `adminSettings.staff.options`, `renderLandingStaffControl()`, `updateLandingContinue()`.
- Produces: native `select#landingStaff` containing configured staff options and the existing event lifecycle.

- [ ] Add a Playwright regression that seeds `salesAppointmentAdminSettings.staff.options`, reloads, asserts `#landingStaff` is a native select with only configured options, selects a staff member, and enters both appointment modes.
- [ ] Run the focused test and confirm it fails because the current default landing control is a text input.
- [ ] Make `renderLandingStaffControl()` always render the configured staff select with placeholder `Choose your name`, retaining current/stored selections only when represented by configured data.
- [ ] Adapt existing tests to seed configured staff data and select an option instead of filling free text.
- [ ] Run landing, responsive, and Phase 5 tests and confirm they pass.

### Task 2: iOS light-surface contract

**Files:**
- Create: `tests/premium-workspace-v2.test.mjs`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `.landing-screen`, `.landing-right`, `.landing-field select`, mobile media queries.
- Produces: opaque cream landing form surface and light native control appearance in both light and dark device preferences.

- [ ] Add Playwright assertions under `colorScheme: 'dark'` for the landing form surface, text colour, native select surface, disabled button readability, and horizontal overflow at iPhone portrait and landscape.
- [ ] Run the focused test and confirm it fails because the landing does not explicitly declare a light colour scheme.
- [ ] Add landing-scoped `color-scheme: light`, opaque surface colours, `-webkit-appearance`/`appearance`, and explicit native text-fill rules without disabling zoom or accessibility.
- [ ] Run the focused test in light and dark appearance and confirm it passes.

### Task 3: Premium workspace visual contract

**Files:**
- Modify: `tests/premium-workspace-v2.test.mjs`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: existing `.app`, `.stickyHeader`, `.actionGroup`, `.appointment-summary-card`, `.card`, `.previewWrap`, `.footerBar`, and responsive grid classes.
- Produces: one scoped navy/cream/gold visual system without structural or behavioral changes.

- [ ] Add computed-style assertions for the navy header, cream canvas, gold primary Generate action, premium summary/card surfaces, preview card, footer, 60/40 wide grid, stacked narrow grid, 44px targets, and zero overflow.
- [ ] Run the focused test and confirm it fails on the existing neutral workspace presentation.
- [ ] Add scoped workspace custom properties and presentation overrides for shell, headings, toolbar, summary, cards, controls, preview, badges, and footer.
- [ ] Retain current responsive breakpoints and compact action hierarchy; add only presentation adjustments within existing breakpoint contracts.
- [ ] Run the focused test and existing accessibility suite and confirm they pass.

### Task 4: Cache and full verification

**Files:**
- Modify: `service-worker.js:5`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: existing service-worker install/activate/fetch strategy and asset list.
- Produces: cache `v2.7.0-alpha.4` with upgrade coverage from `v2.7.0-alpha.3`.

- [ ] Update service-worker tests first and confirm RED against `v2.7.0-alpha.3`.
- [ ] Change only `CACHE_VERSION` to `v2.7.0-alpha.4` and confirm lifecycle tests pass.
- [ ] Run syntax, diff, ID, responsive/accessibility, IA rendering, IA PDF/package smoke, Phase 5, premium landing, premium workspace, and every target test.
- [ ] Confirm `APP_VERSION` remains `2.7.0-alpha.1`, no ID is removed or duplicated, and protected files/behaviour are unchanged.

### Task 5: Visual evidence and focused commit

**Files:**
- No tracked evidence files.

**Interfaces:**
- Consumes: verified isolated worktree build.
- Produces: uncommitted screenshots and one reviewable local implementation commit.

- [ ] Start a no-store local server from the isolated worktree.
- [ ] Capture and inspect the required landing, workspace, summary, form, preview, footer, and More actions states at approved viewports using test data only.
- [ ] Confirm no black landing form, clipping, overflow, stale rotation width, or post-landing visual regression.
- [ ] Stage only approved source, tests, specification, and plan files; confirm evidence and generated PDFs are excluded.
- [ ] Commit locally and verify the worktree is clean. Do not push or deploy.
