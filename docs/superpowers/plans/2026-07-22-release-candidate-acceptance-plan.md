# Release Candidate Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an evidence-backed RC acceptance decision, applying only verified blocking or low-risk high-value corrections.

**Architecture:** Audit the existing single-page PWA in place. Existing runtime data, package builder, PDF renderer, draft storage, and service-worker strategy remain authoritative; tests and deterministic browser inspection prove acceptance. Any correction is minimal, test-first, and tied to a classified finding.

**Tech Stack:** Static HTML/CSS, browser JavaScript, Playwright, Node test scripts, service worker, Python static server.

## Global Constraints

- Branch `fix/staff-dropdown-seeding-v2`, baseline `6b694f3dc071483dc57d09b4b38fe2829d4bad69`.
- Application version stays `2.7.0-alpha.1`; cache advances `.15` to `.16`.
- No new features, dependencies, business/storage/PDF-layout architecture, push, merge, or deployment.
- Commit once as `chore: complete release candidate acceptance pass`.

---

### Task 1: Establish acceptance evidence and classify findings

**Files:** Inspect `index.html`, `css/app.css`, `js/app.js`, `service-worker.js`, `tests/`, `test-smoke/`; create audit documentation listed in Tasks 4-5.

- [ ] Verify branch, HEAD, clean tree, application/cache versions.
- [ ] Map every acceptance criterion to current tests or a deterministic browser/manual check.
- [ ] Inspect package lifecycle, invalidation listeners, reset, legacy controls, mailto/share/save paths, URL cleanup, storage serialization, and service-worker lifecycle.
- [ ] Run syntax, all `.mjs`, and Phase 5 once to establish baseline; classify every failure or observed issue as Critical/Important/Minor.
- [ ] Record exact findings and avoid runtime edits when no qualifying defect is reproduced.

### Task 2: Apply only verified corrections test-first

**Files:** Modify only the directly affected runtime/test files; expected mandatory change is `service-worker.js` plus upgrade tests.

- [ ] For each qualifying runtime defect, add/update a focused test and run it RED.
- [ ] Implement the smallest correction without changing protected contracts; run focused GREEN and affected regressions.
- [ ] Advance `CACHE_VERSION` to `v2.7.0-alpha.16`; update fresh/upgrade tests to prove `.15` cleanup, unrelated-cache retention, offline reload, and unchanged app-shell ordering.
- [ ] Remove superseded code only when references, listener wiring, accessibility-tree inspection, and regressions prove removal safe; otherwise document why compatibility code remains.

### Task 3: Execute browser, responsive, output, and recovery acceptance

**Files:** Add a focused RC acceptance test only where current coverage cannot express deterministic criteria; remove generated evidence afterward.

- [ ] Run deterministic in-person, Zoom, custom-conveyancer, failure/retry, stale/regeneration, reset, and restored-draft browser flows.
- [ ] Inspect ready action labels/order/tab order/disabled states, live messages, hidden legacy controls, 44px targets, long filenames, 200% zoom, reduced motion, and overflow at every required viewport.
- [ ] Validate PDF headers/MIME/data/order/overlay/signature evidence and record exact in-person/Zoom filenames and ZIP listings.
- [ ] Prime service worker online, then verify offline open, form use, package generation, PDF save, ZIP save, and mailto construction.
- [ ] Confirm generation counts, package reuse, stale rebuild, URL revocation path, reset reference cleanup, and absence of persisted Blobs.

### Task 4: Produce release/UAT documentation

**Files:** Create `docs/releases/2.7.0-alpha.1-rc-notes.md`, `docs/testing/2.7.0-alpha.1-physical-device-rc-checklist.md`, `docs/releases/2.7.0-alpha.1-deployment-checklist.md`, `docs/releases/2.7.0-alpha.1-known-issues.md`.

- [ ] Write evidence-limited RC notes covering the staff seed and Prompts 1-5, cache `.16`, test summary, limitations, and mandatory physical checks.
- [ ] Write checkbox-based physical-device checks for environments, both workflows, native keyboard/date/share/files/mail/orientation/safe-area/PWA/offline/update behavior, and evidence capture.
- [ ] Write a non-executed deployment checklist from branch/commit verification through rollback/tag/post-deploy smoke.
- [ ] Separate verified blockers, non-blocking findings, physical-only gaps, deferred debt, and future enhancements without inventing issues.

### Task 5: Full verification, server restart, and delivery

**Files:** All changed files and documentation.

- [ ] Run `node --check` for runtime/worker, `git diff --check`, all `.mjs`, Phase 5 (expect 61/61), focused browser/offline/output suites, and inspect the final diff.
- [ ] Ensure no screenshots, PDFs, ZIPs, logs, or temporary smoke artifacts are staged/created.
- [ ] Commit once with `chore: complete release candidate acceptance pass`, then rerun the focused acceptance and Phase 5 checks against committed HEAD.
- [ ] Verify/stop only a stale port-8766 server, start `python -m http.server 8766 --bind 0.0.0.0` from this worktree, and record PID, localhost/LAN HTTP results, asset versions, and secure-context limitations.
- [ ] Confirm clean tree and issue separate physical-device RC, remote-push, merge, and production decisions.

## Self-review

- Spec coverage: every requested workflow, output, action, staleness, staff, mobile/desktop, accessibility, performance, offline/LAN, documentation, server, verification, and decision criterion maps to Tasks 1-5.
- Placeholder scan: no TBD/TODO or unspecified implementation step remains; runtime changes are conditional on reproduced findings.
- Interface consistency: current package builder, revision cache, mailto builder, download helper, draft shape, and service-worker strategy remain the sole runtime authorities.
- Scope check: physical native behaviors are explicitly deferred to the checklist and cannot be falsely marked automated PASS.
