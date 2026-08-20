# Version History

Summary of major releases based on git commit history. Version numbers refer to `APP_VERSION` in `js/app.js` and `CACHE_VERSION` in `service-worker.js`.

---

## v2.2.1-alpha.1 (current)
**Commit:** `c483449` — `fix: zoom document engine QA hardening`

- Fixed `ensurePageLogo()` called without `await` in `drawZoomCover` (unhandled promise rejection)
- Fixed La Vida EOI filename clash with Standard EOI in ZIP — added `zoomLaVidaEoiFilename()`
- Fixed multi-page EOI dispatch for La Vida (2-page EOI pushed one page entry per sub-page with `eoiSubIndex`)
- 57 stress tests: single/dual client, all output combinations, long names, ZIP content audit, draft save/load, legacy compat

## v2.2.0-alpha.1
**Commit:** `bb8778e` — `feat: add zoom document generation engine`

- Added `zoomOutputPlan()` — zoom-specific page plan with cover, first consultation, client review, optional EOI/IA pages
- Added `drawZoomCover()` — clean cover page with title, client, staff, date
- Added `drawZoomFirstConsult()` — professional A4 document for first consultation data
- Added `drawZoomClientReview()` — professional A4 document for client review/assessment
- Zoom dispatch in `drawOutputPage()` routes to zoom page renderers when `appointmentMode === 'zoom'`
- Added zoom filename functions (`zoomPdfFileName`, `zoomFirstConsultFilename`, `zoomClientReviewFilename`, `zoomEoiFilename`, `zoomIaFilename`, `zoomLaVidaEoiFilename`)
- Extended `buildIndividualPdfs()` and `buildZip()` for zoom document packaging
- Updated `validateBeforePdf()` with zoom-specific validation (date, staff, client name required)
- Updated preview system for zoom (zoom-specific empty state message)
- Updated summary card for zoom booklet ready status
- Exposed zoom API via `window._testState` for automated testing

## v2.1.0-alpha.1
**Commit:** `82242b7` — `feat: add zoom appointment workflow ui`

- Added 19 new zoom field IDs to the fields data model
- Added `zoomDefaults` internal placeholder object (builders, developers, timeline)
- Added zoom HTML sections 2–5: First Consultation, Client Review / Assessment, Appointment Outputs, Attachments
- Added zoom CSS: attachment placeholder styles
- Added `renderZoomFields()` — populates builder/developer/broker/conveyancer/timeline dropdowns
- Added `preserveZoomDraftValue()` — ensures zoom dropdown values survive draft load
- Added zoom summary section to the summary card with indicators
- Section 1's EOI/IA toggle row marked `in-person-only` (hidden in zoom mode)
- Updated `updateSummaryCard()` for zoom mode (show/hide zoom vs in-person columns)
- Updated `renderLiveSummary()` for zoom mode (skip in-person-specific checks)

## v2.0.0-alpha.1
**Commit:** `57347a8` — `feat: wire appointment mode landing screen`

- Added landing screen overlay with staff member input and appointment type toggle
- Added `appointmentMode` state variable (`'inPerson'` | `'zoom'`)
- Added `renderLandingStaffControl()` — dynamic staff input (text or select based on admin settings)
- Added `enterAppointment()`, `backToStart()`, `returnToLanding()` — landing flow handlers
- Added `applyAppointmentMode()` — toggles `.show-in-person` / `.show-zoom` CSS classes
- Extended `getDraft()` / `setDraft()` to persist `appointmentMode`
- Updated `resetForm()` to return to landing screen
- Mode toggle pill buttons in landing screen
- Back to Start button in app header
- Added `icons/landing.png` to service worker cache
- Added `.zoom-only` base CSS rule for mode visibility

---

## v1.6.2
**Commit:** `458c070` — `docs: add comprehensive user guide covering all app features`

- Added comprehensive documentation for all app features and workflows

## v1.6.1
**Commit:** `931fd45` — `fix: align IA solicitor amount and dated fields`

- Fixed IA alignment for solicitor, amount, and dated fields

## v1.6.0
**Commit:** `b8da689` — `feat: add separated documents zip to share workflow`

- Added separated documents ZIP to Download Package and Share workflows

## v1.5.1
**Commit:** `f018a96` — `refactor: modularise standalone appointment capture app`

- Extracted duplicated code into shared helpers (`isChecked`, `mergedClientNames`, `hasC1Photo`, `hasC2Photo`, `refreshAllUI`, etc.)
- Added `CONFIG` object centralising hardcoded values
- Added `EOI_BUILDERS` registry for extensible template support
- `outputPlan()` and `drawOutputPage()` dispatch through builder registry
- Code organised into 17 labelled sections (A–Q)
- Added `ARCHITECTURE.md`

## v1.5.0
**Commit:** `d056f18` — `chore: production QA and hardening pass`

- Removed redundant `clearGenerated()` on signature `pointermove` (moved to `pointerup`)
- Removed dead `.photos` CSS grid rules
- Removed `!important` flags from `.photos` flex rule
- Removed unused functions `canSharePdf` and `formatCurrencyDisplay`
- Form audit: verified all labels, input types, checkboxes

## v1.4.9
**Commits:** `0a882e2` (logo/IA overlay), `c5b0e14` (currency/signatures/test data)

- PDF polish: IA PROPERTY whiteout reduced to avoid black banner overlap
- Added small ASG logo top-right on all non-IA PDF pages via `drawSmallPageLogo()`
- Share email wording: subject now uses `Staff Name - Forms - Client Names - Property - Date` format
- Currency formatting: Land/House/H-L Total auto-format as `$X,XXX` on blur/change
- Signature boxes taller (110px → 150px) with live client name labels
- Added "Load Test Data" button for QA testing
- Version bump from 1.4.8 → 1.4.9

## v1.4.8
**Commit:** `ae923db` — `fix: restore PDF download and share actions`

- Fixed `refreshPreview()` not being awaited in `generatePdfOnly()` — status label now correctly shows "PDF ready" instead of "Preview refreshed."
- Added `pdfFileName()` try/catch with safe fallbacks for missing DOM elements

## v1.4.7
**Commits:** `ae2b40c`, `0e9e6d6` — IA alignment and next appointment date picker

- IA header alignment fixes
- Next Appointment date picker changed from `type="text" dateInput` to `type="date"`
- Version bump from 1.4.5 → 1.4.7

## v1.4.5
**Commit:** `a3f73e7` — Production polish, settings protection, and PDF footer

- Admin settings PIN protection added
- Settings tabs: Dropdowns, PDF Defaults, La Vida, Company
- Settings export/import functionality
- PDF footer with generation timestamp and version
- La Vida finance broker and conveyancer contact options
- EOI overrides toggle for manual client/property detail entry

## v1.4.0
**Commit:** `364c3b8` — Release v1.4.0 UX improvements

- Major UX refresh
- Summary panel improvements
- Appointment capture workflow stabilisation

## v1.2.0
**Commit:** `a3f01b9` — ASG branding and UX improvements

- ASG branding applied throughout
- UI improvements

## v1.1.0
**Commit:** `7596e12` — Appointment capture improvements

- Initial appointment capture workflow refinements
- Two-client workflow added (`747d89c`, `56c0f50`)
- Client-specific ID capture

---

## Future template mapping plan

The Zoom document engine currently generates clean programmatic PDFs. These are placeholders for future branded templates. When branded templates are supplied:

1. **Cover page** — Replace `drawZoomCover()` with a branded cover template image + overlay text
2. **First Consultation** — Replace `drawZoomFirstConsult()` with a branded template + field overlays
3. **Client Review** — Replace `drawZoomClientReview()` with a branded template + field overlays
4. Builder/developer/broker/conveyancer dropdowns — should migrate from `zoomDefaults` in JS to Admin Settings

## Version bump checklist

When bumping the version:

1. Update `APP_VERSION` in `js/app.js` (line 9)
2. Update `CACHE_VERSION` in `service-worker.js` (line 5)
3. Commit with a descriptive message
4. Push to `main` — Vercel auto-deploys

The `data-app-version-label` spans are automatically updated by `updateVersionLabels()` at runtime.
