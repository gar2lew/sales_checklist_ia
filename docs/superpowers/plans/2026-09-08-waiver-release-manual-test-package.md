# Waiver & Disclosure Release — Manual GUI Test Package (v2.7.0-alpha.2)

**Release candidate:** `21e831b` (committed 08/09/2026)
**GUI test server:** http://0.0.0.0:8766 (running)
**Template in frame:** `templates/ASG-Disclosure-Waiver-2026.pdf` (SHA-256 `1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB`, 373,698 bytes, 6 pages A4)
**Version labels:** this manual test round is for release candidate `v2.7.0-alpha.2`; application version label in code is `2.7.0-alpha.1`; service-worker cache version is `v2.7.0-alpha.25`.

## How to record results

Give every section below one of these three results against your observed behaviour:

- **PASS** — everything in the section behaved as described.
- **FAIL** — anything in the section did not behave as described (record exactly what, and where).
- **NOT TESTED** — you did not attempt this section.

Record one result per section, e.g. `T2: PASS`. The visual gate (T9) and the signature checks must be completed by a human looking at the rendered PDF — automated checks do not replace this.

## What to test

### T1 — Landing and mode cards
- Staff select → Garry Lewis.
- Three mode cards visible: In-person / Zoom / **Waiver-only**. Confirm each highlights on click, Continue dismisses the landing overlay.

### T2 — Waiver-only, Client 1: signature and signing date
- Waiver-only flow, step Client 1.
- Draw on the signature pad (`#signature`). The Client-1 DATE field must auto-fill to today in DD/MM/YYYY.
- Set a manual date first, then sign → the manual date must be preserved (auto-fill never overwrites a non-blank date).

### T3 — Waiver-only, Client 1 + Client 2: reveal, signature, date
- Typing a Client 2 name reveals the Client-2 signature block (`#waiverClient2Block`) with its own pad (`#signature2`).
- Signing Client 2 auto-fills the Client-2 date field (blank-field rule applies).
- Clearing the Client 2 name hides the block again.

### T4 — In-Person appointment + optional Waiver & Disclosure
- Start an in-person appointment, complete the client details, and enable the optional Waiver & Disclosure section.
- Fill a Client-1 signature and confirm the signing date auto-fills.
- Add a Client 2 name and confirm the second signature block appears and its date auto-fills.
- Confirm the waiver data stays with the appointment when moving between steps.

### T5 — Zoom appointment + optional Waiver & Disclosure
- Start a zoom appointment. Confirm the zoom timeline shows **9 steps** including the optional Waiver step.
- Repeat the signature/date checks from T4 inside the zoom flow.
- Confirm disabling the waiver step removes the waiver fields from the flow.

### T6 — Saved appointment and reopen behaviour
- Fill Client 1 (+ Client 2 where applicable), sign the pads, Save Draft.
- Reload the app (landing shows the Recent Draft card) → **Resume**. Verify all fields, both dates (auto-fill or manual), the mode (waiver-only / in-person / zoom), and both re-inked signatures are restored.
- From a restored draft, New Appointment / Back to Start returns to landing; the draft card remains; starting a fresh appointment behaves like a clean capture.
- A waiver-less draft (or an expired draft) must not be presented as a waiver draft.

### T7 — Signing-date behaviour
- Auto-fill only applies to a blank signing date; a manually typed date is never overwritten by re-signing.
- Dates are shown in DD/MM/YYYY.
- Client 1 and Client 2 dates are filled independently from their own signatures.
- Re-signing a pad after clearing keeps previously chosen dates untouched.

### T8 — PDF generation (standalone waiver)
- Generate the package in waiver-only mode (or with the waiver enabled).
- Confirm a waiver PDF is produced and contains **all 6 pages**.
- Confirm the waiver is the authoritative ASG-Disclosure-Waiver-2026 template.

### T9 — Page 6 visual inspection (MANUAL VISUAL GATE)
Open the waiver PDF at page 6 and inspect every item below against the rendered page:

- Client 1 name alignment (row position, not clipped).
- Client 1 signature alignment and height (signature extends to the full signature box height — the drawn ink has the same height as the box, drawn upright, not flipped).
- Client 1 signing date shown and aligned.
- Client 2 name alignment when a Client 2 was captured.
- Client 2 signature alignment when a Client 2 signature exists (drawn upright, not flipped).
- Client 2 signing date shown and aligned.
- Client 2 rows sit at the approved offsets (name row roughly 190 units below the Client 1 name row; signature baseline ≈ 347.84; date ≈ 285.80 measured from the page bottom).
- Signature scaling: signatures fit their box width (no stretching beyond the field).
- No clipping of text or signatures at row edges.
- No overlap with clause 18.
- No overlap with the footer.
- All legal wording on the page remains visible.
- All six pages present with the same legal content as the authoritative template.

**Do not mark T9 passed until a human has eyeballed the rendered page.**

### T10 — Combined PDF behaviour
- With an in-person or zoom appointment and the optional waiver enabled, generate the package.
- Confirm the waiver pages are appended to the appointment package PDF (combined), and the standalone waiver is not duplicated in the combined output.
- Confirm the combined PDF pagination is sensible (waiver pages after the appointment pages), and page 6 of the waiver still meets T9.

### T11 — ZIP behaviour
- Generate the package where a ZIP download is offered.
- Confirm the ZIP contains the expected components (appointment PDF and/or waiver PDF as configured).
- Open each archive member and confirm it is a valid, openable PDF.

### T12 — Prepare Email behaviour
- Use Prepare Email on a captured package.
- Confirm the email is pre-populated with the expected recipient and subject, and the prepared package files are listed/attached correctly.
- Confirm no real client details leak into the email copy beyond the appointment itself.

### T13 — Offline and reconnection
- Load the app, generate a waiver package, then take the browser offline (DevTools offline) and reload.
- Confirm the app and the waiver PDF still load from the service-worker cache (service-worker cache version `v2.7.0-alpha.25`; application version label `2.7.0-alpha.1`).
- Bring the connection back online and confirm the app resumes normally (new drafts still save; no stale offline-only state blocks the workflow).

## Known automated-gate state (evidence on commit)
- Waiver suites green under `vitest@4.1.11`: `waiver-draft-persistence` (3), `waiver-template-characterisation` (24), `zoom-timeline-whiteboard` (1) — **28/28**.
- Full `tests/` run: **3 suites pass, 30 fail** — every one of the 30 was verified failing identically at HEAD (no regressions introduced).
- `test-smoke/phase5-regression.js`: identical to HEAD except the intentional `Zoom timeline has 9 steps` contract; pre-existing draft-card crash at line 432 unchanged.
- Standalone legacy smoke (phase1b/2/3) reference the old `.mode-btn` UI and are out of scope for this feature.

## Results summary

| ID | Scenario | Result |
|----|----------|--------|
| T1 | Landing and mode cards | |
| T2 | Waiver-only, Client 1 signature/date | |
| T3 | Waiver-only, Client 1 + Client 2 | |
| T4 | In-person + optional waiver | |
| T5 | Zoom + optional waiver | |
| T6 | Saved appointment / reopen | |
| T7 | Signing-date behaviour | |
| T8 | PDF generation | |
| T9 | Page-6 visual inspection (human gate) | |
| T10 | Combined PDF behaviour | |
| T11 | ZIP behaviour | |
| T12 | Prepare Email behaviour | |
| T13 | Offline and reconnection | |

## Exit criteria
- A result (PASS / FAIL / NOT TESTED) recorded for every T1–T13 row above.
- Human sign-off on T9 (page-6 alignment and legal-content inspection).
- Report back any visual deviations or FAIL rows with specifics.