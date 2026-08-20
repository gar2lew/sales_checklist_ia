# Responsive Density Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the authenticated workspace into a fluid, iPad-first layout with a compact accessible mobile presentation while preserving every application contract.

**Architecture:** CSS custom properties, Grid/Flexbox, content-driven breakpoints, safe-area variables, and dynamic viewport units provide the responsive system. Presentation-only HTML moves existing controls and sections without duplicating them. JavaScript is limited to summary disclosure state and a short footer display label; existing PDF-state DOM attributes drive output-action visibility through CSS.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js, Playwright.

## Global Constraints

- Preserve business logic, validation, storage keys and structures, PDF content and filenames, readiness calculations, IDs, workflows, accessibility semantics, and existing handlers.
- Do not modify the landing page, application version, service-worker cache behaviour, or dependencies.
- Do not use browser/device detection, transform scaling, zoom, duplicated device markup, merge, push, or deployment.
- Preserve the uncommitted `docs/UAT/MOBILE_WORKSPACE_READINESS.md` work and all existing untracked evidence.
- Do not commit screenshots.

---

### Task 1: Add failing responsive contracts

**Files:**
- Modify: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Consumes: existing `openWorkspace(width, height)` helper and current workspace IDs.
- Produces: assertions for `#workspaceContent`, `#summaryDisclosure`, `#summaryDetails`, `#workspaceSecondaryActions`, and responsive computed layout.

- [ ] Add assertions for all seven target viewports: no overflow, visible targets ≥44px, wide summary spanning both content columns, 60/40 wide layout, stacked 1024 portrait layout, compact three-action footer, hidden pre-generation output actions, keyboard disclosure, ARIA state, short footer label, Settings/Load Test Data reachability, and output actions appearing after generation.
- [ ] Run `node tests/ux-polish-presentation.test.mjs` and confirm failure because the new presentation structure and responsive contracts do not exist.

### Task 2: Fluid workspace shell and full-width summary

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`

**Interfaces:**
- Produces: `.workspaceContent` around the existing `main` and `.previewWrap`; keeps `#appointmentSummaryCard` as the first `.grid` child.

- [ ] Move the existing summary section before `.workspaceContent`; do not alter its content or IDs.
- [ ] Add authenticated custom properties for 1440px maximum width, clamped gutters/gaps/control height/radius.
- [ ] Apply the shared shell to `.app`, `.headerInner`, and `.footerInner`.
- [ ] Make `.grid` a one-column summary stack and `.workspaceContent` the content grid.
- [ ] Run the focused test and confirm shell/summary assertions pass while later compact assertions still fail.
- [ ] Capture comparison screenshots for 1366×1024, 1920×1080, and 1366×768.

### Task 3: Responsive form/preview composition

**Files:**
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `.workspaceContent`, existing `main`, and `.previewWrap`.
- Produces: `minmax(0,3fr) minmax(320px,2fr)` only when available width satisfies both columns.

- [ ] Add a content-driven two-column breakpoint and one-column fallback.
- [ ] Keep preview sticky only in the two-column composition.
- [ ] Preserve form field maximum readability and existing two-column field grids.
- [ ] Verify 1366×1024 and desktop stay split; 1024×1366 stacks form then preview; 956×440 does not force unreadable columns.
- [ ] Capture iPad landscape and portrait screenshots.

### Task 4: Toolbar grouping and secondary utilities

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`

**Interfaces:**
- Produces: `#workspaceSecondaryActions` native `<details>` containing the existing `#loadTestData` and `#openSettings`; moves existing `#previewTop` beside the preview heading.

- [ ] Add a native “More actions” summary with its existing buttons, with wide-layout CSS rendering the controls inline.
- [ ] Move `#previewTop` into a `.previewHeading` wrapper without changing its ID or handler.
- [ ] Increase logical group spacing and maintain Generate PDF as the sole primary control.
- [ ] Verify Settings, Load Test Data, and Refresh Preview via their existing handlers.
- [ ] Capture desktop and iPad toolbar screenshots.

### Task 5: Compact header and output-action priority

**Files:**
- Modify: `css/app.css`

**Interfaces:**
- Consumes: existing disabled states and `#outputConfidenceStatus[data-state]`.
- Produces: compact utility/output rows without JavaScript PDF-state branching.

- [ ] At compact widths, show Change Staff / Clients, Save Draft, Load Draft, Generate PDF, and More actions immediately.
- [ ] Hide Download/Package/Share before output readiness using disabled state and `:has()` against the existing output confidence state.
- [ ] Reveal existing top output actions after PDF readiness.
- [ ] Reduce brand/status/action row gaps without shrinking text or targets below 44px.
- [ ] Verify 440×956, 390×844, and 956×440 header height and action availability.

### Task 6: Accessible mobile summary disclosure

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Produces: `setSummaryDisclosureExpanded(expanded)` and `#summaryDisclosure[aria-controls="summaryDetails"]`.

- [ ] Confirm the focused test fails on missing disclosure/ARIA behaviour.
- [ ] Add the disclosure button and `id="summaryDetails"` to the existing summary body.
- [ ] Implement the narrow helper to update expanded class, `aria-expanded`, and View/Hide label; bind one click handler.
- [ ] Default compact layouts collapsed while CSS always displays details above the compact breakpoint.
- [ ] Verify click, Enter, Space, focus indicator, and unchanged summary jump targets/readiness.
- [ ] Capture collapsed and expanded mobile screenshots.

### Task 7: Compact footer and short display filename

**Files:**
- Modify: `js/app.js`
- Modify: `css/app.css`
- Test: `tests/ux-polish-presentation.test.mjs`

**Interfaces:**
- Produces: `updateFooterDisplayName()`; leaves `pdfFileName()` and all download/package functions untouched.

- [ ] Confirm the test fails because the footer still exposes six compact actions and the full PDF filename.
- [ ] Derive a short client/date label from current form fields and call it from `updateName()`.
- [ ] On compact layouts show only `#resetForm`, `#saveDraftBottom`, and `#generateBottom`; keep other bottom actions in the DOM.
- [ ] Use a three-column footer grid with 44px minimum targets and a single-line ellipsised label.
- [ ] Verify the downloaded filename still equals `pdfFileName()` and output actions remain reachable in the header.
- [ ] Capture pre/post-generation and lower-page footer screenshots.

### Task 8: Safe-area, keyboard, and landscape handling

**Files:**
- Modify: `css/app.css`

**Interfaces:**
- Produces: safe-area footer padding, matching content clearance, `scroll-padding-bottom`, control `scroll-margin-block`, and `dvh`-based compact sizing.

- [ ] Add CSS-only safe-area and focus-scrolling rules.
- [ ] Add a content-height-aware landscape rule that reduces nonessential vertical gaps without forcing columns or shrinking targets.
- [ ] Do not add `visualViewport` JavaScript unless focused-field screenshots prove CSS insufficient.
- [ ] Verify focused lower-page fields remain scrollable above the footer at 440×956, 390×844, and 956×440.
- [ ] Capture the focused-field and landscape screenshots.

### Task 9: Summary column and visual polish

**Files:**
- Modify: `css/app.css`

**Interfaces:**
- Consumes: existing summary categories/status chips.
- Produces: content-driven `auto-fit/minmax()` summary columns and non-wrapping chips where space permits.

- [ ] Replace equal six-column sizing with content-aware minimums.
- [ ] Apply clamped section/card spacing and remove obsolete directly replaced rules.
- [ ] Manually inspect every required viewport and state; correct only responsive-density regressions.
- [ ] Update `docs/design/UX_POLISH_BACKLOG.md` and mark H4 complete only if 440×956 and 390×844 materially improve.

### Task 10: Full regression gate and logical commit

**Files:**
- Modify: `docs/design/UX_POLISH_BACKLOG.md`
- Verify: all implementation files and screenshots.

**Interfaces:**
- Produces: verified responsive implementation with screenshots left uncommitted.

- [ ] Run `node --check js/app.js` and `node --check service-worker.js`.
- [ ] Run `git diff --check`.
- [ ] Run `node tests/ia-overlay-rendering.test.mjs`.
- [ ] Run `node tests/ia-pdf-visual-smoke.mjs`.
- [ ] Run `node tests/ux-polish-presentation.test.mjs`.
- [ ] Compare all 193 integration-base IDs with the final HTML.
- [ ] Capture 1366×1024, 1024×1366, 1920×1080, 1366×768, 440×956, 956×440, and 390×844 plus every required state.
- [ ] Confirm landing screenshot hash remains unchanged.
- [ ] Stage only the responsive implementation, test, plan, and audit update; exclude screenshots, UAT work, design references, and temporary artifacts.
- [ ] Commit related verified changes with `polish: refine responsive workspace density`.
