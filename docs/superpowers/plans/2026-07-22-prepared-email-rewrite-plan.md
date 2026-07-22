# Prepared Email Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the existing prepared email to include the resolved Contract Due Date and remove email-only technical/timestamp wording while preserving recipients, subject, next appointments, and share behavior.

**Architecture:** Keep the existing `buildShareEmailContent()` and share entry points. Reuse `resolveContractDueDate()` to add one resolved body block, remove only `formatContractIssued()` and obsolete fallback-body replacements when no longer used, and leave recipient/subject/next-appointment helpers unchanged.

**Tech Stack:** Vanilla JavaScript, Playwright-based Node tests, Node assertion tests, service-worker upgrade tests, Phase 5 browser regression.

## Global Constraints

- Exact subject remains `Sales Appointment Documents | <Client Names> | <Appointment Date>`.
- Exact greeting, introduction, labels, block order, and closing follow the approved design.
- Preserve Natalie primary recipient, selected-staff CC, deduplication, and fallback CC.
- Preserve in-person/Zoom next-appointment sources and formatting.
- Use Prompt 1's resolver; never infer TBC from blank.
- Preserve storage, PDF/ZIP generation, filenames, UI, Prompt 1 controls, and Prompt 2 selector.
- Keep application version `2.7.0-alpha.1`.
- Advance only cache `v2.7.0-alpha.12` to `v2.7.0-alpha.13`.
- Do not push, merge, deploy, or restart the RC server.
- Deliver one local commit: `fix: simplify prepared appointment email`.

---

### Task 1: Characterize exact email content and validation

**Files:**
- Create: `tests/prepared-email-rewrite.test.mjs`
- Read: `tests/rc-email-conveyancer-zip-polish.test.mjs`
- Read: `tests/contract-due-date.test.mjs`

**Interfaces:**
- Consumes: `buildShareEmailContent()`, `resolveContractDueDate()`, `emailNextAppointment()`, `resolveShareCc()`, and real `sharePdf()` behavior.
- Produces: failing exact-output and missing-due-date behavior tests before runtime edits.

- [ ] Build email objects with fixed in-person/Zoom form values and assert the exact approved date-due-date and TBC bodies, unchanged subject, Natalie recipient, selected-staff CC, primary deduplication, and fallback CC.
- [ ] Assert in-person date/time, Zoom date-only, no invented time, and complete omission of a blank Next Appointment block with tidy spacing.
- [ ] Assert `Contract Issued`, timestamp text, downloaded/ZIP/browser wording, and manual attachment instructions are absent.
- [ ] Use a real browser share-entry test with blank Contract Due Date to prove inline validation appears and neither native share nor mailto fallback begins.
- [ ] Assert Prompt 1 controls/resolver, Prompt 2 selector, application `2.7.0-alpha.1`, and expected cache `v2.7.0-alpha.13`.
- [ ] Run `node tests/prepared-email-rewrite.test.mjs` and confirm RED against the legacy body and alpha.12 cache.

### Task 2: Implement the approved plain-text body

**Files:**
- Modify: `js/app.js` at email formatting and fallback-body preparation only

**Interfaces:**
- Consumes: `resolveContractDueDate(): {valid:boolean,value:string}` and existing client/property/date/next/staff/recipient resolvers.
- Produces: unchanged email object shape with the approved subject/body/fallbackBody and resolved Contract Due Date.

- [ ] Resolve Contract Due Date once inside `buildShareEmailContent()` and refuse to build content when invalid rather than inferring TBC.
- [ ] Replace the body template with exact greeting, introduction, labels, due-date block, optional next block, and selected-staff closing.
- [ ] Remove the email-only `Contract Issued` formatter if no remaining runtime consumer exists.
- [ ] Remove obsolete fallback-body replacements for deleted attachment/download wording while preserving mailto construction and native-share control flow.
- [ ] Run `node tests/prepared-email-rewrite.test.mjs` and iterate to GREEN.

### Task 3: Update affected email/share characterization

**Files:**
- Modify: `tests/rc-email-conveyancer-zip-polish.test.mjs`
- Modify: `tests/rc-handover-manual-smoke.test.mjs`
- Modify: `tests/mobile-rc-defects-v2.test.mjs` only where legacy email wording is asserted

**Interfaces:**
- Consumes: approved email object and existing native share/mailto/download harnesses.
- Produces: meaningful current assertions without weakening PDF, ZIP, recipient, or package tests.

- [ ] Replace legacy expected bodies with the exact approved body and add resolved Contract Due Date fixtures.
- [ ] Update manual-smoke output to verify due date and absence of removed wording while retaining recipient, PDF, ZIP, conveyancer, and filename evidence.
- [ ] Replace only obsolete mobile-RC assertions for downloaded/attach text with the new business-body assertions.
- [ ] Run prepared-email, Contract Due Date, mobile RC, handover, PDF/ZIP, and share regression suites.

### Task 4: Advance cache and run authoritative verification

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/service-worker-upgrade.test.mjs`
- Modify: `tests/service-worker-browser-upgrade.test.mjs`

**Interfaces:**
- Consumes: alpha.12 service-worker contract.
- Produces: alpha.13 cache invalidation with unchanged manifest and strategy.

- [ ] Change only `CACHE_VERSION` from `v2.7.0-alpha.12` to `v2.7.0-alpha.13` and update fresh-install/upgrade expectations from alpha.12.
- [ ] Run `node --check js/app.js`, `node --check service-worker.js`, and `git diff --check`.
- [ ] Run every `tests/*.mjs` suite and `node test-smoke/phase5-regression.js`, requiring 61/61.
- [ ] Remove only generated smoke artifacts and verify application version, cache, no server listener, and a focused diff.

### Task 5: Focused local commit

**Files:**
- Include: specification, plan, email implementation, focused/affected tests, and cache update.

**Interfaces:**
- Consumes: verified clean staged diff.
- Produces: one local commit without remote action.

- [ ] Stage only Prompt 3 files and run `git diff --cached --check`.
- [ ] Inspect staged status/stat for unrelated changes or generated artifacts.
- [ ] Commit with `fix: simplify prepared appointment email`.
- [ ] Confirm branch, HEAD, versions, and clean worktree; do not push, merge, deploy, or restart the RC server.

## Self-Review

- Every approved content, resolution, validation, recipient, share, regression, version, and delivery requirement maps to an explicit task.
- The exact body order places Contract Due Date before the optional Next Appointment block.
- Invalid due dates cannot produce email content or inferred TBC.
- Native share, mailto, PDF/ZIP, storage, Prompt 1 controls, and Prompt 2 selector remain protected.
- No placeholders, contradictory names, or unresolved product decisions remain.
