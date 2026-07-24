# Offline Appointment Capability Audit

**Application:** Sales Appointment Capture  
**Source branch:** `fix/staff-dropdown-seeding-v2`  
**Source commit:** `1dfe59df83722e78bcd91a070270f6a35d5fab4c`  
**Application version:** `2.7.0-alpha.1`  
**Service-worker cache:** `v2.7.0-alpha.21`  
**Audit date:** 24 July 2026  
**Decision:** **NO-GO for implementation approval until the HIGH findings and management decisions in this audit are resolved**

## Executive Summary

The application already has a strong local-first foundation. After one successful online load, the current service worker precaches the complete HTML/CSS/JavaScript shell and every image template used by the in-person and Zoom PDF workflows. The application has no runtime dependency on remote scripts, fonts, APIs, PDF libraries or ZIP libraries. Representative in-person data, signatures, ID images and Zoom whiteboard data can be saved to the single device-local draft and reopened while offline.

The minimum target is therefore technically close, but it is not ready to promise operationally. Four HIGH findings block approval:

1. sensitive client, image, signature and whiteboard data is stored indefinitely as plaintext in a single browser `localStorage` record;
2. **New Appointment does not delete the saved draft**, creating a gap between likely staff expectations and actual retention;
3. full-resolution evidence and duplicate whiteboard representations can exhaust the small, browser-managed `localStorage` quota, after which the appointment is not saved;
4. a corrupt draft has no recovery, quarantine or reliable delete path in the normal recent-draft interface.

The automated matrix also found a Zoom presentation defect: the whiteboard strokes and PNG remain in the draft and the main canvas restores, but the saved-page thumbnail was not rebuilt after an offline close/reopen. This does not prove data loss, but it weakens staff confidence and must be corrected or explicitly accepted.

Offline package generation is a bonus rather than the minimum guarantee. Existing browser-upgrade coverage proves that a fully cached installation can generate and download the Combined PDF and ZIP and prepare a `mailto:` link while offline. If a required cached template is missing, generation fails and the draft remains available for later reconnection. Sending email still requires an available mail client and network connection.

Browser emulation is not physical-device approval. Windows Chrome installed-mode, Android Chrome, iPhone Safari and iPad Safari remain mandatory release gates.

## Scope and Method

The audit combined:

- source inspection of `index.html`, `js/app.js`, `service-worker.js`, `manifest.webmanifest`, templates and documentation tooling;
- the non-invasive Playwright harness `tests/offline-capability-research.test.mjs`;
- existing service-worker installation and browser-upgrade tests;
- inspection of current user-guide sources and validation assumptions;
- official installation guidance from Google Chrome Help and Apple Support.

All automated appointment data is fictional. No runtime application files were changed.

## Current Architecture

| Area | Implementation | Offline classification |
|---|---|---|
| HTML shell | `index.html` | Bundled local; precached |
| Styles and logic | `css/app.css`, `js/app.js` | Bundled local; precached |
| Manifest and icons | `manifest.webmanifest`, `icons/**` | Bundled local; precached |
| PDF backgrounds | La Vida, IA, First Consult and Client Review JPGs | Bundled local; precached |
| PDF and ZIP composition | Local application logic | No external runtime service |
| Draft persistence | One `localStorage` item, `salesAppointmentDraft` | Device/browser-profile capability |
| Signatures | Canvas + Pointer events, saved as PNG data URL | Browser capability; persisted |
| ID images/photos | Native file/camera picker + FileReader | Browser/device capability; persisted |
| Zoom whiteboard | Canvas + Pointer events, vectors and PNG pages | Browser capability; persisted |
| Downloads | Blob/Object URL and native download | Browser/device capability |
| Prepared email | `mailto:` navigation | External mail client; sending is network-dependent |
| Fonts and APIs | System/local fonts; no external API found | No network-only runtime dependency |

### Boot and cache sequence

1. The browser loads `index.html`, local CSS and local JavaScript.
2. The page registers `/service-worker.js`.
3. Installation opens `sales-capture-v2.7.0-alpha.21` and calls `cache.addAll(APP_SHELL)`.
4. Installation calls `skipWaiting()`.
5. Activation removes older `sales-capture-*` caches, preserves unrelated caches and claims clients.
6. Navigation is network-first with cached `/index.html` fallback.
7. Other GET requests are cache-first with network fallback and runtime insertion.

## Service-Worker and Asset Analysis

The current `APP_SHELL` contains 29 URL entries: the root and index, manifest, CSS, JavaScript, four icon/landing assets, two La Vida pages, two IA templates, twelve First Consult pages and four Client Review pages. Every declared path exists. Source PDFs are authoring assets; runtime generation uses rendered JPGs.

### Strengths

- `cache.addAll` prevents an incomplete cache from becoming current.
- Offline navigation has a deterministic shell fallback.
- Cleanup is scoped to `sales-capture-*`; unrelated caches are preserved.
- No opaque cross-origin response is required.
- Existing browser tests cover fresh install, upgrade, cleanup, offline reload, offline package generation, downloads and `mailto:` creation.

### Gaps

| Finding | Severity | Effect | Required response |
|---|---|---|---|
| Immediate `skipWaiting()` and `clients.claim()` | MEDIUM | An update can take control during an appointment; full-draft cross-version safety is not proven. | Add active-draft upgrade tests and define a safe-update policy. |
| No cache-readiness surface | MEDIUM | An open page does not prove all templates are cached. | Add truthful readiness status and preparation checks. |
| Generic atomic-install failure | MEDIUM | A missing asset prevents the new cache, but the UI cannot explain readiness failure. | Preserve atomicity; expose actionable status. |
| Exact cache matching for static assets | LOW | A query-stringed asset would require network. Production paths have no query strings. | Add coverage; change matching only if a real URL needs it. |
| No first-use offline explanation | MEDIUM | A never-loaded device receives the browser network error. | Make preparation mandatory and document it accurately. |
| Missing cached template gives generic generation failure | MEDIUM | Draft remains, but staff lack a precise recovery message. | Add a reconnect/recache message in a later approved phase. |

## Asset Dependency Map

| Capability | Dependency | Classification | Result |
|---|---|---|---|
| Landing/setup | HTML, CSS, JS, logos | Bundled + precached | PASS after prior online load |
| In-person/Zoom forms | App shell and local state | Bundled + precached | PASS |
| Signatures | Canvas/Pointer events | Browser/device | PASS in Chromium |
| ID evidence | File input/FileReader | Browser/device | PASS with fictional PNG |
| Whiteboard | Canvas/Pointer events | Browser/device | PARTIAL: canvas restored; saved thumbnail absent |
| Draft save/load | `localStorage` | Browser/device | PASS under normal capacity |
| Preview/PDF | App logic + cached JPG templates | Bundled + precached | PASS while cache complete |
| ZIP | Local Blob/ZIP composition | Local/browser | Existing offline test PASS |
| Downloads | Blob URL/native download | Browser/device | Existing offline test PASS |
| Prepare email | `mailto:` | External mail client | URL can be built offline; sending needs network |

## Draft and Storage Analysis

- Key: `salesAppointmentDraft`.
- API: synchronous `localStorage`.
- Shape: one JSON object containing fields, mode, EOI/IA state, signatures, photos, whiteboard vectors and saved-page images.
- Slots: one draft per browser profile.
- Retention: indefinite until explicitly deleted, browser data is cleared or storage is evicted.
- Generated PDF/ZIP Blobs are memory/download outputs, not draft data.
- No dedicated draft schema migration/recovery contract was found.

The harness confirmed representative staff/mode/fields, EOI, IA, contract-due-date TBC, a signature, image evidence, Zoom notes, stroke vectors and saved-page PNG data are serialized. Reconnection retains the draft. Clearing Cache Storage leaves the draft but makes the app unavailable offline; clearing localStorage permanently removes the draft while the cached shell still opens.

### Durability gaps

1. Full image data URLs and duplicate whiteboard vector/raster data can exhaust `localStorage`.
2. A malformed draft gets a generic error without quarantine, export, repair or a reliable recent-draft delete path.
3. Autosave is timed; no dedicated lifecycle flush was confirmed, so latest edits can be lost on abrupt close.
4. One new save replaces the only draft slot.
5. Browser/OS storage is best-effort and may be cleared or evicted.
6. Restore does not impose explicit data-size bounds before decoding embedded content.
7. Upgrade tests preserve a simple marker but not a complete previous-version appointment draft.

## Repeatable Offline Test Matrix

| # | Scenario | Status | Actual behaviour | Risk/remediation |
|---:|---|---|---|---|
| 1 | First online visit and SW activation | PASS | Current cache contains 29 entries | None observed |
| 2 | Online reload | PASS | App reloads under SW control | None observed |
| 3 | In-person data, EOI/IA, due TBC, signature and image save | PASS | Representative state serialized | Quota/eviction remain |
| 4 | Offline reload and in-person resume | PASS | Shell, fields, signature and image restored | Physical installed mode pending |
| 5 | Start in-person appointment offline | PASS | Prepared profile supports setup/workspace | Physical confirmation pending |
| 6 | Zoom fields and whiteboard save | PASS | Notes, vectors and saved-page PNG serialized | Quota/eviction remain |
| 7 | Offline close/reopen Zoom resume | PARTIAL | Mode, notes and canvas restore; saved-page thumbnail absent | Correct visible restoration |
| 8 | Client 2, EOI, IA, due date and summary state | PASS by serializer/restorer coverage | Existing draft machinery retains values | Add dedicated release assertions |
| 9 | Reconnect with saved draft | PASS | Draft reloads unchanged | None observed |
| 10 | Uncached route/query offline | PASS | Cached index fallback opens | Static query assets are separate |
| 11 | Fully cached offline package/download/email preparation | PASS in existing browser-upgrade suite | PDF/ZIP downloads and mailto construction succeed | Sending needs connectivity |
| 12 | Required cached template deleted | PARTIAL | `PDF generation failed.`; draft remains | Reconnect/recache and clearer message |
| 13 | Cache cleared, localStorage retained | PARTIAL | App cannot boot offline; draft survives | Network required for recovery |
| 14 | localStorage cleared, cache retained | PASS for expected failure | Shell opens; no draft exists | Permanent draft loss |
| 15 | Corrupt draft | PARTIAL | Generic failure; no repair/recovery | Draft may be inaccessible |
| 16 | Quota failure | PARTIAL | Save fails without false success | Appointment remains unsaved |
| 17 | First-ever visit offline | PASS for expected failure | Browser cannot open app | Preparation is mandatory |
| 18 | Reconnection during open draft | PASS at storage boundary | Network return does not overwrite draft | Add transition-specific assertion |
| 19 | Installed mode, camera, OS picker/downloads | NOT TESTABLE AUTOMATICALLY | Requires real devices | Physical gate |
| 20 | Update during active complete draft | PARTIAL | Immediate activation exists; compatibility not fully proven | Add cross-version fixture |
| 21 | Browser/OS eviction/persistence | NOT TESTABLE AUTOMATICALLY | Platform-dependent | Physical/long-duration gate |

## Package and Reconnection Result

With a complete cache, existing browser-upgrade coverage proves offline appointment package generation, Combined PDF and ZIP download, and prepared-email URL construction. Preserve this bonus capability, but do not guarantee it until installed-device downloads and memory pressure are tested. Email sending is not offline.

Reconnection passed: the draft remained intact and reloadable after returning online. There is no cloud sync, queue or cross-device recovery.

## Installation Research

Current official sources:

1. Google Chrome Help, **Use web apps**: <https://support.google.com/chrome/answer/9658361?hl=en>
2. Google Chrome Help, **Install and manage web apps — Android**: <https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=en-GB>
3. Apple Support, **Turn a website into an app in Safari on iPhone**: <https://support.apple.com/en-au/guide/iphone/iphea86e5236/ios>
4. Apple Support, **Turn a website into an app in Safari on iPad**: <https://support.apple.com/en-au/guide/ipad/ipad8f1f7a29/ipados>

Proposed guidance, subject to physical verification:

| Platform | Installation path |
|---|---|
| Windows Chrome | Address-bar install control where available, or **More → Cast, save and share → Install page as app**; optionally pin through Windows |
| Android Chrome | **More → Add to home screen → Install** where supported |
| iPhone Safari | Share/More → **Add to Home Screen** → enable **Open as Web App** where offered → Add |
| iPad Safari | Share → **Add to Home Screen** → **Open as Web App** where offered → Add |

Exact menus, standalone launch, icon/name, camera/file access, rotation, safe areas, keyboard and downloads must be verified on release devices. Google also cautions that some web apps are not fully available offline.

## Security and Privacy Findings

| ID | Severity | Finding | Required disposition |
|---|---|---|---|
| PRIV-01 | HIGH | Sensitive contact, workflow, signature, ID-image and whiteboard data persists as plaintext browser storage indefinitely. | Management must approve retention/deletion procedure; guide must require approved work devices without inventing a retention period. |
| PRIV-02 | HIGH | **New Appointment** clears live state but does not remove the saved draft. | Decide whether to preserve, warn or offer explicit deletion; do not silently change semantics. |
| DATA-01 | HIGH | Embedded evidence can exceed localStorage quota and break the minimum save guarantee. | Approve capacity limits/checks or a bounded storage design plus recovery guidance. |
| DATA-02 | HIGH | Corrupt drafts lack quarantine, recovery and a dependable UI delete path. | Add safe detection and user-controlled recovery/deletion. |
| DATA-03 | MEDIUM | Browser/OS storage is best-effort and evictable. | Use qualified wording; require prompt handover. |
| DATA-04 | MEDIUM | No lifecycle flush beyond timed/manual save was confirmed. | Characterize close/crash behaviour before change. |
| PRIV-03 | MEDIUM | Reset includes separate sensitive-item confirmation paths. | Characterize and document exact reset semantics. |
| SEC-01 | MEDIUM | The settings PIN is an edit guard, not authentication. | Never describe it as protecting local client data. |
| SEC-02 | LOW | Static hosting headers require a separate deployment review. | Do not mix into this offline scope without approval. |
| ARCH-01 | LOW | A large inline Perth IA base64 assignment appears immediately replaced by a local JPG path. | Separate technical debt unless profiling shows impact. |

## Gap Analysis

The prepared-device shell, both workflows, representative fields, signature/image persistence, draft reload, reconnection and fully cached local output generation already work. Limitations are storage durability, visible whiteboard saved-page restoration, lack of readiness/recovery messaging, immediate update activation, and unverified physical-device behaviour.

The smallest safe future scope is:

1. approve retention and New Appointment deletion semantics;
2. bound/measure draft size and make quota recovery safe;
3. add corrupt-draft recovery/deletion;
4. prove complete-draft compatibility across updates;
5. restore saved Zoom whiteboard page presentation;
6. add truthful network/cache readiness and missing-resource messaging;
7. retain offline package generation as a bonus;
8. physically validate supported devices;
9. then rewrite the canonical guide to `1.1.0`.

Cloud sync, background email, server drafts, cross-device drafts, offline authentication and automatic sending remain non-goals.

## Physical-Device Gates

Test Windows Chrome installed app, Android Chrome, iPhone Safari Home Screen app and iPad Safari Home Screen app. On every platform record device/OS/browser, installed mode, orientation and evidence for:

- online preparation and cache readiness;
- airplane-mode cold launch;
- in-person and Zoom setup;
- Client 2, EOI, IA and due date;
- touch signatures and whiteboard;
- camera/file evidence;
- save, close/terminate, reopen and field-by-field draft comparison;
- rotation, safe area, keyboard/focus;
- reconnect, package generation, downloads and secure mail handoff;
- active-draft service-worker upgrade;
- offline reload after upgrade;
- storage/quota and explicit deletion procedure.

## User Guide v1.1 Impact

The guide should become a task-oriented field handbook with installation, preparation, offline work, recovery and handover; a clickable contents page where supported; restrained REQUIRED/IMPORTANT/TIP/WARNING/DO NOT PROCEED/EXPECTED RESULT callouts; a one-page quick reference; in-person/Zoom comparison; annotated key controls; explicit manual attachment steps; privacy wording without an invented retention period; technical provenance away from the cover; and approved/derived page-count validation rather than a fixed 17-page assumption.

## Implementation Gate

**NO-GO.** Runtime implementation and the canonical guide rewrite must wait until:

1. management confirms local-draft retention and delete-after-handover policy;
2. product ownership decides the saved-draft behaviour of **New Appointment**;
3. quota/draft-size strategy is approved;
4. corrupt-draft recovery/deletion is approved;
5. every HIGH item is remediated by the specification or explicitly accepted by the authorised release owner.

Research-only specification and planning may continue. Production release activity remains out of scope.
