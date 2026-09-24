# Landing Page Visual Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production landing page visually match the approved prototype without changing production content, semantics, accessibility, or behavior.

**Architecture:** Apply isolated CSS-first changes to the existing landing page and make only minimal presentation-owned HTML adjustments. Keep every functional element and hook intact; validate the preserved DOM contract and browser interactions after each independently reviewable visual stage.

**Tech Stack:** Static HTML, CSS, existing vanilla JavaScript, browser-based visual and interaction verification.

## Global Constraints

- Do not modify `js/app.js`, `service-worker.js`, PDF code, storage or draft logic, or application screens outside the landing page.
- Do not change production wording, values, version metadata, legal text, IDs, roles, ARIA attributes, labels, form semantics, hidden native select, keyboard/pointer behavior, business rules, or data flow.
- Do not introduce dependencies.
- Stop if a visual requirement requires behavior changes or creates regression risk.
- Do not merge or deploy before visual approval.

## File Map

- `index.html`: retain the functional landing DOM; adjust only presentation wrappers/classes and decorative SVGs inside `#landingScreen`.
- `css/app.css`: replace only the isolated `.landing-*` presentation rules and their landing-specific responsive/reduced-motion rules.
- `docs/superpowers/specs/2026-07-16-landing-page-visual-migration-design.md`: approved design constraints.
- `docs/superpowers/plans/2026-07-16-landing-page-visual-migration.md`: staged execution checklist.
- `screenshots/landing-migration/`: stage and final comparison evidence.

---

### Task 1: Baseline and DOM Contract

**Files:**
- Inspect: `index.html`
- Inspect: `js/app.js`
- Create: `screenshots/landing-migration/baseline-*.png`

**Interfaces:**
- Consumes: existing `#landingScreen` DOM and landing event bindings.
- Produces: baseline screenshots and a recorded list of immutable landing IDs/attributes.

- [ ] **Step 1: Capture the current landing page at the four target viewports**

Run the existing app locally and save baseline screenshots for 1920x1080, 1366x768, 768x1024, and 390x844 under `screenshots/landing-migration/`.

- [ ] **Step 2: Record the DOM contract**

Verify these functional nodes and attributes before editing: `landingScreen`, `landingForm`, `landingStaffWrapper`, `landingStaffTrigger[aria-haspopup="listbox"][aria-expanded]`, `landingStaffMenu[role="listbox"]`, its six `li[role="option"]` values, hidden `landingStaff`, `landingClient1`, `landingClient2`, and `landingStartBtn[disabled]`.

- [ ] **Step 3: Confirm protected files are clean**

Run: `git diff -- js/app.js service-worker.js`

Expected: no changes.

### Task 2: Canvas, Frame, and Panel Composition

**Files:**
- Modify: `css/app.css` landing styles beginning at `.landing-screen`
- Modify: `index.html` only if the desktop curve/contours require decorative SVG path changes
- Create: `screenshots/landing-migration/stage-1-1366x768.png`

**Interfaces:**
- Consumes: unchanged `#landingScreen > .landing-outer > .landing-container` hierarchy.
- Produces: stone canvas, gold frame, 24px radius, layered shadow, 40/60 split, navy/ivory panels, and curved desktop boundary.

- [ ] **Step 1: Apply the frame tokens and geometry**

Set the landing canvas to `#e7e5e4`, the frame to a 3px `#b8924a` perimeter, the outer radius to 24px, maximum width to 1400px, and the layered shadow values from the reference.

- [ ] **Step 2: Apply panel materials**

Set the left panel to the reference radial navy gradient and 40% basis; set the right panel to the warm ivory gradient and 60% basis.

- [ ] **Step 3: Match decorative boundary and contours**

Update only decorative SVG geometry/styling required for the prototype's gold-edged curve and low-opacity contour artwork. Keep `aria-hidden="true"`.

- [ ] **Step 4: Capture and compare stage 1**

Capture 1366x768, compare frame/panel proportions/materiality to the reference, and stop if parity would require behavior changes.

### Task 3: Left Panel Presentation

**Files:**
- Modify: `index.html` presentation-only logo/benefit wrappers and decorative SVGs within `.landing-left`
- Modify: `css/app.css` isolated left-panel landing selectors
- Create: `screenshots/landing-migration/stage-2-1366x768.png`

**Interfaces:**
- Consumes: existing production logo, heading, tagline, description, benefit, and version text.
- Produces: stacked logo lockup, left-aligned hierarchy, circular icon treatments, and prototype spacing without changed text.

- [ ] **Step 1: Add presentation-only logo structure**

Split the existing `AMPLIFY SOLUTIONS GROUP` display into CSS-addressable visual lines only if it can be done without changing its text content; otherwise use CSS layout on the existing node.

- [ ] **Step 2: Apply typography and spacing**

Match the reference serif sizes, gold/white hierarchy, desktop alignment, divider, and content padding.

- [ ] **Step 3: Apply circular benefit styling**

Wrap or style each existing decorative icon with a 58px circular gold outline and match the prototype's title/description spacing. Decorative SVGs remain `aria-hidden`.

- [ ] **Step 4: Capture and compare stage 2**

Capture 1366x768 and compare logo, heading, benefit placement, and panel balance to the reference.

### Task 4: Right Panel Presentation

**Files:**
- Modify: `index.html` presentation-only decorative SVGs/wrappers within `.landing-right`
- Modify: `css/app.css` isolated right-panel landing selectors
- Create: `screenshots/landing-migration/stage-3-disabled-1366x768.png`
- Create: `screenshots/landing-migration/stage-3-enabled-1366x768.png`

**Interfaces:**
- Consumes: unchanged form IDs, labels, hidden select, button, badge, information copy, and footer metadata.
- Produces: centred form hierarchy, elevated badge, prototype forms/dropdown/button/info/footer materiality.

- [ ] **Step 1: Match hierarchy and badge**

Apply the reference panel padding, centred content width/alignment, welcome/title/divider spacing, and elevated security badge treatment.

- [ ] **Step 2: Match form controls**

Apply 55px control heights, 13px radii, warm borders, gold icons, placeholder colours, focus border/ring, dropdown elevation, and selected/hover states without altering form elements or event hooks.

- [ ] **Step 3: Match Start button states**

Change the pill to a 13px rounded rectangle. Apply the prototype's disabled styling and enabled multi-stop gold gradient, shadows, hover lift, active press, and visible focus state.

- [ ] **Step 4: Match information panel and footer**

Apply the reference translucent white information surface and warm footer border/typography while retaining production text exactly.

- [ ] **Step 5: Capture and compare stage 3**

Capture disabled and enabled 1366x768 states and compare hierarchy, controls, materiality, and state styling to the reference.

### Task 5: Responsive Migration

**Files:**
- Modify: `css/app.css` landing-specific media queries and reduced-motion block
- Create: `screenshots/landing-migration/final-1920x1080.png`
- Create: `screenshots/landing-migration/final-1366x768.png`
- Create: `screenshots/landing-migration/final-768x1024.png`
- Create: `screenshots/landing-migration/final-390x844.png`

**Interfaces:**
- Consumes: completed desktop presentation and current responsive semantics.
- Produces: overflow-safe stacked tablet/mobile composition with preserved touch targets and reduced motion.

- [ ] **Step 1: Tune wide desktop layouts**

Confirm near-full-viewport framing, 40/60 proportions, and vertical fit at 1920x1080 and 1366x768.

- [ ] **Step 2: Tune tablet stacking**

At 768x1024, stack panels, remove the desktop-only curve boundary, retain balanced spacing, and ensure the page scrolls vertically without horizontal overflow.

- [ ] **Step 3: Tune mobile stacking**

At 390x844, retain at least 48px control/button touch heights, readable benefit content, dropdown visibility, and no horizontal overflow.

- [ ] **Step 4: Preserve reduced motion**

Confirm `prefers-reduced-motion: reduce` disables dropdown animation and control/button transforms/transitions.

- [ ] **Step 5: Capture final responsive screenshots**

Save all four target viewport screenshots and compare them to the reference's responsive visual language.

### Task 6: DOM, Interaction, and Scope Verification

**Files:**
- Verify: `index.html`
- Verify: `css/app.css`
- Verify unchanged: `js/app.js`
- Verify unchanged: `service-worker.js`

**Interfaces:**
- Consumes: completed landing presentation.
- Produces: evidence that behavior and protected scope remain unchanged.

- [ ] **Step 1: Re-run the DOM contract**

Confirm all baseline IDs, roles, ARIA attributes, label associations, form semantics, option values, and hidden select remain unchanged.

- [ ] **Step 2: Verify dropdown interaction**

Check click open/select, click-outside close, ArrowDown/ArrowUp traversal, Enter selection, Escape close, and Tab close/focus progression.

- [ ] **Step 3: Verify form states and data flow**

Confirm Start is disabled initially, remains disabled without staff/client 1, enables with both, and staff/client values autofill production appointment fields after submission.

- [ ] **Step 4: Verify navigation flows**

Confirm Start Appointment opens the main application and Back to Start/New Appointment returns to the landing page without altered behavior.

- [ ] **Step 5: Verify protected scope**

Run: `git diff -- js/app.js service-worker.js`

Expected: no changes.

Run: `git diff -- index.html css/app.css`

Expected: only `#landingScreen` markup and isolated `.landing-*` styles changed.

- [ ] **Step 6: Report differences and stop before integration**

List remaining visual differences, link screenshots, confirm no behavior changed, and do not merge or deploy.
