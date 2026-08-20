# V2 Premium Landing Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved premium split-panel landing presentation to the v2 entry flow without changing its controls, validation, workflow, application version, or post-landing workspace.

**Architecture:** Retain the v2 landing controls and event contract, wrapping them in landing-only presentation containers adapted from `fba75a8`. Add a final, narrowly scoped landing stylesheet after the existing legacy landing rules so the authenticated workspace remains untouched. Change only the service-worker cache revision required to refresh tracked HTML and CSS.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, service worker, Node.js, Playwright.

## Global Constraints

- Base commit is `3cb751f5de3b15701ccce869ab8d7f1df4ae13a9`.
- Presentation reference is `fba75a8ee63dab9dbbf9539c0b2cd2f8b99d143c`.
- Preserve application version `2.7.0-alpha.1`.
- Increment cache version only from `v2.7.0-alpha.2` to `v2.7.0-alpha.3`.
- Preserve every target ID, handler, storage key, validation rule, PDF behavior, workflow, and post-landing workspace style.
- Do not add dependencies, push, deploy, merge to `main`, or commit screenshots/generated evidence.

---

### Task 1: Premium landing contract regression

**Files:**
- Create: `tests/premium-landing-v2.test.mjs`

**Interfaces:**
- Consumes: the rendered `index.html`, `css/app.css`, and existing v2 landing handlers.
- Produces: assertions for premium structure, preserved target IDs, workflow entry, responsive layouts, overflow, and touch targets.

- [ ] Write a Playwright regression that opens the landing at desktop, iPad landscape/portrait, and iPhone portrait/landscape sizes.
- [ ] Assert premium split-panel hooks such as `.landing-outer`, `.landing-container`, `.landing-left`, and `.landing-right`.
- [ ] Assert all 301 target IDs remain, no duplicate IDs exist, and the v2 staff/mode/Continue controls behave unchanged.
- [ ] Run `node tests/premium-landing-v2.test.mjs` and confirm it fails because premium structure is absent.

### Task 2: Presentation-only landing migration

**Files:**
- Modify: `index.html`
- Modify: `css/app.css`

**Interfaces:**
- Consumes: `#landingScreen`, `#landingStaffControl`, `#landingStaff`, `.mode-card`, `#recentDraftCard`, and `#landingContinue`.
- Produces: premium split-panel presentation while retaining those exact controls and IDs.

- [ ] Wrap the current v2 controls in premium left/right landing containers and add decorative, non-interactive SVG/material elements.
- [ ] Preserve the current v2 wording for staff selection, appointment type, recent draft, Continue, and version labels.
- [ ] Add landing-scoped CSS for the desktop split, tablet/mobile stack, safe areas, rotation stability, overflow prevention, and 44px targets.
- [ ] Run the new regression and `node tests/ux-polish-presentation.test.mjs`; confirm both pass.

### Task 3: Cache upgrade and complete verification

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: existing target service-worker strategy and exact target asset list.
- Produces: `v2.7.0-alpha.3` cache installation and upgrade coverage from `v2.7.0-alpha.2`.

- [ ] Update cache tests first and verify their expected failure against `v2.7.0-alpha.2`.
- [ ] Change only `CACHE_VERSION` to `v2.7.0-alpha.3` and retain asset order/strategy.
- [ ] Run syntax, diff, service-worker, IA, responsive, premium-landing, and Phase 5 suites.
- [ ] Confirm application version, target ID preservation, clean working tree, and absence of committed evidence.
- [ ] Create one focused presentation-only commit, start a fresh LAN server, and compare direct file hashes with the commit.
