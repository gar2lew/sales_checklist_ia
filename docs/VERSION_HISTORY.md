# Version History

Summary of major releases based on git commit history. Version numbers refer to `APP_VERSION` in `index.html` and `CACHE_VERSION` in `service-worker.js`.

---

## v1.5.1 (current)
**Commit:** `6e7815c` — `refactor: improve maintainability and prepare for future templates`

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

## Version bump checklist

When bumping the version:

1. Update `APP_VERSION` in `index.html` (line ~1091)
2. Update `CACHE_VERSION` in `service-worker.js` (line 5)
3. Update visible version labels: `<span data-app-version-label>` elements (lines ~497, ~886, ~1050)
4. Commit with a descriptive message
5. Push to `main` — Vercel auto-deploys

The `data-app-version-label` spans are automatically updated by `updateVersionLabels()` at runtime, but the default text in the HTML should also be updated for initial page load.
