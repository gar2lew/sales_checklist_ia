# Verified Offline Support and User Guide v1.1 Specification

**Status:** Approved for implementation  
**Depends on:** `docs/offline/OFFLINE_CAPABILITY_AUDIT.md`  
**Application version baseline:** `2.7.0-alpha.1`  
**Service-worker baseline:** `v2.7.0-alpha.21`  
**Target guide version:** `1.1.0`

## 1. Product Goal

Enable a staff member using a previously prepared, approved work device to complete and safely save an in-person or Zoom appointment without internet, close the installed application, reopen the same device-local draft while still offline, and finish the handover after reconnecting.

The staff guide becomes a task-oriented field handbook covering installation, offline preparation, appointment completion, recovery, reconnection, output inspection and manual email handover.

## 2. Verified Offline Contract

After a successful online installation/readiness check, the supported device and browser profile shall:

1. cold-open the installed application without internet while its application cache remains intact;
2. start or resume one device-local appointment draft;
3. retain staff, appointment type, representative in-person/Zoom fields, Client 2, EOI, IA and contract-due-date state;
4. capture and restore signatures;
5. capture/select and restore local images where the platform grants access and sufficient storage exists;
6. capture and restore Zoom whiteboard content;
7. save explicitly while offline and report success only after persistence succeeds;
8. close and reopen in the same installed app/browser profile;
9. load the draft without silently discarding data;
10. retain the draft after network reconnection;
11. generate and download the Combined PDF and Document ZIP after reconnection;
12. construct the prepared email with the existing recipient, subject and body rules;
13. require staff to attach both files manually and send only with stable connectivity.

The minimum release guarantee is **appointment completion + successful local save + same-device offline reopen**. Fully cached offline package generation is a supported bonus only after physical-device validation. Email sending is never described as offline.

### Contract qualifications

- “Retain” means browser-managed local persistence, not guaranteed permanent storage.
- The same device, OS user, browser profile and installed app must be used.
- Clearing browser/site data, uninstalling the app, OS/browser eviction or profile switching can remove access.
- Offline availability is not claimed until the actual device passes the preparation test.
- A save is not complete until the UI confirms the persisted draft.

## 3. Non-Goals

- cloud or server-side draft synchronization;
- background upload or email queueing;
- cross-device draft access;
- multiple concurrent draft slots;
- offline authentication;
- shared-device user profiles;
- automatic email attachments or sending;
- encryption/authentication redesign;
- changes to appointment business rules, validation, PDF layout or document contents;
- a promise that browser-managed storage cannot be cleared or evicted.

## 4. Supported Platforms

Release support requires physical approval on:

| Platform | Browser/install mode | Support condition |
|---|---|---|
| Windows desktop/laptop | Current stable Google Chrome installed web app | Install, standalone launch, offline cold start and downloads pass |
| Android phone/tablet | Current stable Chrome installed/Add to Home Screen app | Camera/file, touch, rotation, restart and downloads pass |
| iPhone | Current supported iOS Safari Add to Home Screen web app | Safe area, keyboard, photos/camera, restart and downloads pass |
| iPad | Current supported iPadOS Safari Add to Home Screen web app | Portrait/landscape, touch, whiteboard, file handling and restart pass |

Browser emulation is supporting evidence only. Exact release versions are recorded in UAT rather than hard-coded in the guide.

## 5. Installation Guidance Contract

The guide shall paraphrase current official platform documentation and carry a review date/source reference.

- **Windows Chrome:** use the address-bar install control where present, otherwise Chrome’s current **Install page as app** path; confirm standalone launch; optional Start/taskbar pinning is OS guidance, not an app guarantee.
- **Android Chrome:** use the current **Add to home screen / Install** flow and confirm the installed icon opens the expected app.
- **iPhone/iPad:** use Safari, Share/More, **Add to Home Screen**, enable **Open as Web App** where available, then Add.

Menu wording must be checked against physical release devices before publication. Chrome on iOS is not the primary installation path.

## 6. Offline Preparation Workflow

The application and guide shall support this truth-based readiness check:

1. Connect to reliable internet.
2. Open the installed app at the approved URL/version.
3. Wait for an explicit current-version/offline-readiness result.
4. Open the in-person and Zoom workspaces only if future caching tests prove this remains necessary.
5. Save a fictional test draft.
6. Close and reopen the installed app.
7. Disconnect networking or enable airplane mode.
8. Reopen the installed app.
9. Load the fictional test draft.
10. Confirm required workflow, signature/image and whiteboard behaviour on that device.
11. Reconnect.
12. Delete the fictional test draft using the approved deletion flow.

The guide must display:

> **WARNING — Offline availability must be tested on the actual device before travelling to an appointment area with poor reception.**

## 7. No-Internet Workflow

1. Open the prepared installed app on the same approved device/profile.
2. Start or load the appointment.
3. Complete the relevant workflow.
4. Save regularly and confirm **Draft saved** after each important section.
5. Do not clear browser data, change profiles, uninstall the app or switch devices.
6. Avoid multiple appointment tabs.
7. At the end, save again and verify the saved timestamp/status.
8. Keep the device secure until stable internet returns.

If saving fails, the app must not imply safety. It must preserve the live form, state that the appointment is unsaved, identify storage pressure/corruption where determinable, and tell staff not to close the app until the approved recovery step is complete.

## 8. Reconnection and Handover Workflow

1. Establish stable connectivity.
2. Continue the open appointment or reopen the installed app and load the saved draft.
3. Verify staff, appointment type, client details, evidence, signatures and relevant workflow state.
4. Generate the current package.
5. Download the Combined PDF and Document ZIP.
6. Open/check both outputs.
7. Prepare the email.
8. Confirm recipient and subject.
9. Attach both downloaded files manually.
10. Send only when connectivity is stable.
11. Complete the approved local-draft and downloaded-file retention/deletion procedure.

Prepare Email must never be described as attaching files automatically.

## 9. Application Changes Required

Implementation proceeds under the approved policy dispositions recorded in Section 17.
### 9.1 Storage: localStorage-to-IndexedDB Migration



Migrate draft storage from localStorage to IndexedDB. IndexedDB must store:



- form state;

- signatures;

- uploaded or captured ID images;

- whiteboard pages and thumbnails;

- draft metadata;

- schema version;

- retention timestamps.



Requirements:



- transactional saves;

- atomic replacement of the active draft;

- schema versioning;

- safe migration from the existing localStorage draft;

- migration must preserve valid existing drafts;

- migration must not repeatedly duplicate data;

- quota estimation before or during save;

- clear user-facing quota failure;

- no false Draft saved message;

- preserve the prior valid draft if a replacement save fails;

- test browser restart and offline reopen;

- no real client data in tests.



Use localStorage only for small non-sensitive preferences where appropriate.



Do not add a new large dependency unless it is clearly justified. Prefer native IndexedDB or an existing project dependency.



### 9.2 Draft Retention Policy



- Default retention period: seven (7) days.

- Store a created timestamp when a draft is first persisted.

- Store a last-saved timestamp updated on each successful save.

- Compute an explicit expiry timestamp (created + 7 days).

- Display visible expiry information in the draft interface.

- Automatically remove expired drafts during safe application startup or draft listing.

- Support manual deletion at any time with confirmation before permanent deletion.

- Do not invent a longer-term records-retention policy.



This rule applies only to temporary appointment drafts stored by this application. Generated files and formal business records remain governed by existing ASG procedures outside this application.



### 9.3 New Appointment Semantics



New Appointment must never silently delete an unfinished saved draft.



When an existing draft is present, provide clear choices:



1. Continue Current Draft

2. Start New Appointment and Keep Saved Draft

3. Permanently Delete Draft and Start New



Requirements:



- deletion requires explicit confirmation;

- cancelling returns to the current state;

- starting a new appointment while preserving the draft must not overwrite it;

- labels must clearly distinguish temporary working data from permanent records;

- no hidden automatic deletion;

- no misleading success state.



If the current application architecture supports only one active saved draft, the interface must say so clearly and safely preserve or delete it according to the selected action. Do not introduce multi-user cloud draft storage.



### 9.4 Corrupt-Draft Recovery



A corrupt or unsupported draft must not crash the application or disappear silently.



Implement:



- guarded parsing and schema validation;

- draft version recognition;

- quarantine status for unreadable drafts;

- user-facing explanation;

- option to permanently delete the damaged draft;

- option to preserve it temporarily while contacting support;

- safe diagnostic metadata such as schema version, size and error code;

- no client names, ID image bytes, signatures or other sensitive content in logs;

- no automatic overwrite of a quarantined draft;

- no false recovery claim.



Where safe partial recovery is possible, define it explicitly in the implementation plan before adding it. Do not attempt speculative partial recovery in the first implementation phase.



### 9.5 Lifecycle durability



- Characterize close, refresh, \pagehide\, rotation and OS suspension.

- Add a lifecycle save only if it can reuse the established serializer and cannot create false confirmation or change validation/business rules.

- Preserve explicit Save Draft as the authoritative staff action.



### 9.6 Zoom whiteboard restoration



- Rebuild saved-page thumbnails from valid persisted \wbSavedPages\ data after draft load.

- Preserve vector/canvas restoration, page order, labels and current tools.

- Prevent duplicate thumbnails/listeners across repeated loads.

- Failure to decode one page must not discard the remaining draft.



### 9.7 Offline/readiness status



- Present online/offline state without relying on colour alone.

- Distinguish: preparing offline files, ready on this browser, offline, save failed, required file unavailable, and reconnect to complete handover.

- Do not claim device readiness solely from avigator.onLine\.

- Readiness must verify the active service-worker/cache contract and required asset set.

- First-time offline use remains a browser-level failure; online preparation copy must prevent reliance on an unprepared device.



### 9.8 Post-Handover Cleanup



Add an explicit post-handover action: **Complete Handover and Clear Draft**.



This action must:



- require confirmation;

- confirm that final files have been downloaded and reviewed;

- remove the active draft and associated sensitive blobs;

- clear transient appointment state;

- not delete downloaded files from the operating system;

- return to a clean appointment start state.



Do not claim downloaded files have been deleted.




## 10. Service-Worker Requirements

- Preserve atomic precaching of the complete required app shell/template set.
- Maintain a manifest-derived or otherwise single authoritative required-asset list test.
- Preserve navigation fallback, unrelated-cache preservation and offline reload.
- Add a safe-update contract for an active draft. Tests must cover a complete previous-version draft, not only a marker.
- Do not allow a new worker to produce mixed shell/runtime/template versions.
- Expose readiness to the application through a narrow message/query interface only if required; no polling loop.
- Missing required assets shall leave the previous complete cache usable where browser semantics allow.
- Provide actionable application status when a required generation template cannot be retrieved.
- Preserve query-bearing navigation fallback and add explicit static-asset query tests.
- Increment cache version only in the later phase that actually changes runtime cached assets.

## 11. Storage Requirements

- Preserve existing keys and shapes unless a separately approved migration is necessary.
- Any schema marker/migration must be backward compatible, tested with full fictional legacy drafts and non-destructive on failure.
- Store no PII in Cache Storage.
- Generated PDF/ZIP blobs must not be added to persistent app storage.
- Bound restore processing and reject implausibly large/corrupt payloads safely.
- Explain that local browser storage is device/profile-specific and can be evicted.
- Investigate `navigator.storage.persist()` as a capability; do not claim or require it without per-platform evidence.
- Maintain fictional-only fixtures.

## 12. Error and Status Messaging

Required states:

| State | Required message intent |
|---|---|
| Ready | Current application files are available in this browser for offline use; device test is still required |
| Offline | Working locally; save regularly; email sending requires reconnection |
| Draft saved | Persisted successfully with time/status consistent with existing conventions |
| Save blocked by storage | Appointment is not saved; keep app open and follow recovery guidance |
| Corrupt draft | Draft cannot be loaded; no data was silently replaced; delete only with confirmation |
| Required template missing | Package cannot be generated offline; draft remains; reconnect and retry |
| Reconnected | Local draft remains; verify it before generation |
| Update available/activating | Do not disrupt a live draft; follow approved safe-update behaviour |

Messages must be screen-reader announced through existing accessible status patterns, remain visible long enough to act on, and not rely on colour alone.

## 13. Privacy Requirements

The application must state clearly:

- drafts are stored on the current device;
- drafts do not automatically sync;
- staff must use an approved ASG work device;
- clearing browser data, uninstalling the app or storage eviction may remove drafts;
- obsolete drafts should be deleted after handover;
- uploaded ID and supporting evidence may remain in the local draft until deleted or expired.

The guide must include:

> **WARNING — Drafts and uploaded client evidence may remain stored on the local device. Use only approved work devices, complete the handover promptly and remove obsolete drafts or files according to ASG procedure. Drafts are automatically removed after seven days.**

The settings PIN shall not be described as authentication or encryption.

## 14. User Guide v1.1 Structure

1. Cover
2. Contents
3. Overview
4. Quick Start
5. Installing the App
6. Preparing for Offline Use
7. Working Without Internet
8. Reconnecting and Completing Handover
9. Choosing the Appointment Type
10. Staff Login and Appointment Setup
11. In-Person Workflow
12. Sale Details
13. Zoom Workflow
14. Zoom Whiteboard
15. ID Documents and Signatures
16. Saving and Loading Drafts
17. Generating the Appointment Package
18. Downloading and Emailing
19. Reviewing Generated Documents
20. Common Mistakes
21. Troubleshooting
22. Best Practices and Device Tips
23. One-Page Quick Reference
24. Final Checklist
25. Technical Information

The page count may exceed 17. The staff-facing cover contains title, **Internal Staff Resource**, application version, guide version, issue date and concise purpose. Branch/source commit moves to document properties, metadata/technical information and the automation report.

### Callout system

Use consistent, restrained styles for REQUIRED, IMPORTANT, TIP, WARNING, DO NOT PROCEED and EXPECTED RESULT. Each must have a text label/icon and cannot rely on colour.

### Required content

- clickable contents entries where the generator supports internal links;
- in-person versus Zoom comparison table;
- exact seven-step email handover: Download Package; confirm both files; Prepare Email; attach Combined PDF; attach ZIP; confirm recipient/subject; send on stable connection;
- Common Mistakes covering multiple tabs, attachments, stale packages, clearing data, switching device/browser, refreshing unsaved work, changing type without saving, unchecked outputs and untested offline readiness;
- one-page essential appointment sequence;
- final field/handover/privacy checklist.

## 15. Screenshot Plan

Retain existing canonical screenshots unless content changes. Add or annotate only when instruction value is material:

1. install/start context for each supported platform, captured from physical approved devices where platform chrome is required;
2. staff and appointment type selection;
3. Save Draft and saved confirmation;
4. Load Draft/recent draft;
5. offline/readiness state;
6. storage/save failure recovery;
7. Generate Appointment Package;
8. Download Package;
9. Save Combined PDF;
10. Save Document ZIP;
11. Prepare Email;
12. Downloads started confirmation;
13. Zoom whiteboard saved pages after reload.

Annotations use numbered markers with matching short steps. Do not obscure controls or client fields. All capture data is fictional and deterministic.

## 16. Documentation and Validation Changes

- Keep the existing Markdown guide as canonical content.
- Generate DOCX/PDF through the existing one-Node orchestrator and Python generators.
- Change guide metadata to `1.1.0`; do not change application version solely for docs.
- Replace the fixed 17-page contract with an approved page-count value derived from the revised canonical artifact/manifest. Validation must still fail on unexpected page-count drift.
- Validate clickable contents links where supported by the output format.
- Validate required sections, callout labels, privacy wording, offline qualification, image presence, broken links, DOCX structure and PDF rendering.
- Keep screenshots and metadata deterministic under the existing capture contract.
- Automated visual heuristics remain warnings and do not replace human visual review.

## 17. Acceptance Criteria

### Approved product decisions (resolved 24 July 2026)

- [x] Seven-day retention period with automatic expiry, explicit timestamps and manual deletion.
- [x] New Appointment: three-way choice (Continue, Start New + Keep Draft, Delete and Start New) with explicit confirmation.
- [x] localStorage-to-IndexedDB migration with transactional saves, schema versioning and safe quota handling.
- [x] Corrupt-draft recovery: guarded parsing, quarantine, explicit deletion, no silent overwrite.

### Automated offline acceptance

- [ ] Required asset inventory installs atomically.
- [ ] Prepared offline navigation and both workspaces open.
- [ ] Complete fictional in-person and Zoom drafts save/reopen offline.
- [ ] Client 2, EOI, IA and contract-due-date state restore.
- [ ] Signature, image evidence and all whiteboard saved pages restore visibly.
- [ ] Quota failure never reports success and preserves live form state.
- [ ] Corrupt draft is contained and explicitly deletable without silent overwrite.
- [ ] Full previous-version draft survives service-worker update.
- [ ] Old app caches are removed and unrelated caches preserved.
- [ ] Missing template leaves draft safe and gives actionable recovery.
- [ ] Reconnection preserves draft and supports package/download/email workflow.
- [ ] No real client information appears in fixtures, logs or reports.

### Documentation acceptance

- [ ] Guide `1.1.0` implements all 25 sections and required callouts.
- [ ] Installation wording matches current official sources and physical devices.
- [ ] Offline claims match verified behaviour and limitations.
- [ ] Cover omits Git branch/source commit.
- [ ] Contents and internal links pass supported-format validation.
- [ ] Approved dynamic page-count contract passes.
- [ ] DOCX/PDF visual human review passes.

### Physical acceptance

- [ ] Windows Chrome, Android Chrome, iPhone Safari and iPad Safari gates pass.
- [ ] Installed offline cold launch, touch/camera/file use, save/restart/load and reconnection pass.
- [ ] Active-draft app upgrade and offline reload pass.
- [ ] Safe-area, keyboard, rotation and downloads pass.

## 18. Release Gates

1. Research audit accepted.
2. All HIGH findings resolved or explicitly accepted by the authorised release owner.
3. This specification approved.
4. Test-first implementation plan approved.
5. Each implementation phase committed and reviewed independently.
6. Full Node, Phase 5, documentation, screenshot, PDF, service-worker and offline suites pass.
7. Physical-device UAT passes on all supported platforms.
8. Guide v1.1 human content and visual approval passes.
9. Release owner separately authorizes integration, remote push and deployment.

Until gates 1–4 are satisfied, the implementation decision remains **NO-GO**. This document authorizes no runtime change by itself.
