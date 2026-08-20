# Authoritative Application Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate all current organisation-configurable defaults into one deeply immutable in-file `DEFAULT_APP_CONFIGURATION` while preserving existing compatibility views and runtime behaviour exactly.

**Architecture:** Add a narrow recursive freeze helper immediately before the canonical object in `js/app.js`, construct the canonical object from literal production values, and derive independent mutable compatibility projections for `defaultAdminSettings` and `zoomDefaults`. Compose `CONFIG` once, retaining technical constants as literals while sourcing only configurable fields from immutable projections.

**Tech Stack:** Browser JavaScript, Node.js characterization tests, Playwright, service worker tests.

## Global Constraints

- Keep application version `2.7.0-alpha.1`.
- Keep production staff options empty.
- Preserve every current value, ordering, spelling, casing, blank default, and nested persisted shape.
- Keep storage keys, field maps, DOM IDs, rendering mechanics, PDF dimensions/coordinates, asset paths, versions, and service-worker mechanics outside `DEFAULT_APP_CONFIGURATION`.
- Do not change normalization, migration, validation, draft restoration, UI, workflow, PDF output, or sharing behaviour.
- Do not add dependencies or a settings schema migration.
- Advance service-worker cache from `v2.7.0-alpha.6` to `v2.7.0-alpha.7` because tracked `js/app.js` changes require cache invalidation.
- Produce one local focused implementation commit; do not push, merge, deploy, or resume physical RC.

---

### Task 1: Characterize Effective Configuration Contracts

**Files:**
- Create: `tests/default-app-configuration.test.mjs`

**Interfaces:**
- Consumes: the current `js/app.js` source and the application rendered through the existing local Playwright fixture pattern.
- Produces: assertions for literal production defaults, compatibility shapes, canonical immutability, projection isolation, storage shape, and initialization safety.

- [x] **Step 1: Add source and browser characterization assertions**

Create a test that captures the current effective admin, staff, solicitor, share, appointment, Zoom, PDF, template, and UI timing values as independent literal expectations. Use a browser page to verify the fresh-profile settings behavior and persisted admin settings shape; use a controlled instrumented copy of the configuration prefix to inspect frozen canonical data and cloned projections after the refactor.

- [x] **Step 2: Run the characterization test before production changes**

Run: `node tests/default-app-configuration.test.mjs`

Expected: existing-value characterization assertions pass, while assertions requiring `DEFAULT_APP_CONFIGURATION`, deep freezing, and isolated derived projections fail for the expected missing architecture.

### Task 2: Introduce the Canonical Configuration and Compatibility Views

**Files:**
- Modify: `js/app.js:10-190`

**Interfaces:**
- Consumes: literal production defaults captured by Task 1.
- Produces: `deepFreeze(value)`, `DEFAULT_APP_CONFIGURATION`, `defaultAdminSettings`, `zoomDefaults`, and one safely composed `CONFIG` declaration.

- [x] **Step 1: Add the minimal deeply frozen canonical object**

Add `deepFreeze` and construct `DEFAULT_APP_CONFIGURATION` in the existing initialization region. Include the exact existing admin PIN, empty staff options, branch and solicitor options, share recipients, appointment defaults, business PDF defaults, templates, Zoom lists, and UI timings.

- [x] **Step 2: Derive compatibility projections without shared mutable references**

Build `defaultAdminSettings` and `zoomDefaults` using independent cloning from the canonical object. Build `CONFIG.share` as a frozen legacy-shaped projection where `cc` derives from `fallbackCc`. Keep all technical members of `CONFIG` as technical literals and declare `CONFIG` only once.

- [x] **Step 3: Preserve existing consumers and initialization order**

Retain `let adminSettings = loadAdminSettings()` in its current relative position after defaults exist. Source `ADMIN_PIN` and `AUTOSAVE_DELAY` from canonical configuration without changing their consumer timing or names. Do not modify load, normalization, migration, validation, or draft functions.

- [x] **Step 4: Run the focused configuration test**

Run: `node tests/default-app-configuration.test.mjs`

Expected: PASS, including deep immutability and projection-isolation assertions.

### Task 3: Advance the Required Runtime Cache

**Files:**
- Modify: `service-worker.js:5`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: existing cache strategy and asset manifest unchanged.
- Produces: cache version `v2.7.0-alpha.7` and upgrade coverage from `v2.7.0-alpha.6`.

- [x] **Step 1: Update cache-test expectations first**

Change focused service-worker tests to require `v2.7.0-alpha.7`, include `v2.7.0-alpha.6` among stale application caches, and preserve the exact asset order and unrelated-cache behavior.

- [x] **Step 2: Run cache tests to confirm RED**

Run: `node tests/service-worker-upgrade.test.mjs` and `node tests/service-worker-browser-upgrade.test.mjs`

Expected: FAIL because `service-worker.js` still declares `v2.7.0-alpha.6`.

- [x] **Step 3: Update only `CACHE_VERSION`**

Set `CACHE_VERSION` to `v2.7.0-alpha.7`; do not alter cache strategy or assets.

- [x] **Step 4: Run both cache tests**

Expected: PASS for fresh install, upgrade cleanup, unrelated-cache preservation, and offline behavior.

### Task 4: Full Verification and Focused Commit

**Files:**
- Verify: `js/app.js`
- Verify: `service-worker.js`
- Verify: all authoritative tests and repository smoke suites

**Interfaces:**
- Consumes: Tasks 1-3.
- Produces: verified local commit with no unrelated changes.

- [x] **Step 1: Run syntax and diff checks**

Run `node --check js/app.js`, `node --check service-worker.js`, and `git diff --check`.

- [x] **Step 2: Run focused and authoritative tests**

Run every `tests/*.test.mjs`, `tests/ia-pdf-visual-smoke.mjs`, and the authoritative Phase 5 suite via `npm.cmd run smoke`.

- [x] **Step 3: Inspect the final diff and invariants**

Confirm application version `2.7.0-alpha.1`, cache version `v2.7.0-alpha.7`, empty production staff options, unchanged storage-key literals and persisted shapes, one `CONFIG` declaration, no duplicate canonical object, and no UI/PDF/share behavior changes.

- [ ] **Step 4: Commit once locally**

Stage only the plan, focused characterization test, `js/app.js`, `service-worker.js`, and updated cache tests. Commit with `refactor: centralise application defaults`. Do not push, merge, or deploy.
