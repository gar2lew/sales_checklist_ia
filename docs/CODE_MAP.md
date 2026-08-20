# Code Map — `js/app.js`

The application JavaScript is organised into labelled sections (A–Q) within the IIFE. This map describes each section's purpose, key functions, and CRM portability.

All line numbers refer to `js/app.js` (v2.2.1-alpha.1, ~3650 lines).

---

## Section A — Application Configuration & Extension Points
**Lines:** ~77–132

**Purpose:** Centralised configuration and the EOI builder registry. Extension point for adding new template builders.

**Key functions:**
- `selectedEoiTemplateValue()`, `selectedEoiTemplateLabel()` — read template selection
- `isChecked(id)` — DOM checkbox guard (replaces `$('id') && $('id').checked`)
- `hasClient2()`, `mergedClientNames()` — client data helpers
- `resolvedIaField(fieldId, fallbackId)` — IA override resolution
- `hasC1Photo()`, `hasC2Photo()`, `anyPhotoAttached()` — photo state checks
- `refreshAllUI()`, `refreshFormBindings()` — UI update sequences

**Key objects:**
- `CONFIG` — application settings (version, storage keys, PDF dimensions, share defaults, branding)
- `EOI_BUILDERS` — template builder registry (`standard`, `laVidaHomes`)

**New in v2.0+:**
- `appointmentMode` state variable (line ~42)
- `zoomDefaults` internal placeholder (builders, developers, timeline arrays)

**CRM portability:** High. All functions read DOM state and can be adapted to accept a `formData` object instead. `CONFIG` and `EOI_BUILDERS` port directly.

---

## Section B — Utility Functions & Date Helpers
**Lines:** ~173–338

**Purpose:** Date formatting, validation, toast/status UI, filename generation, landing screen helpers.

**Key functions:**
- `localDateISO()` — today's date in ISO format
- `toast(msg)`, `status(msg)` — UI notification helpers
- `clearValidation()`, `setFieldError()` — form validation UI
- `requireField()`, `requireValidDate()` — validation rules
- `validateBeforePdf(plan)` — main form validation (in-person + zoom)
- `safePart(s, fallback)` — filename sanitisation
- `pdfFileName()` — generated PDF filename (zoom-aware, routes to `zoomPdfFileName()` when in zoom mode)
- `zipFileName()` — ZIP filename (zoom-aware, includes "Zoom Appointment Documents" in zoom mode)
- `updateName()` — updates filename preview and signature labels
- `updateVersionLabels()` — updates version display
- `canSharePdfFiles()`, `canShareFilesPossible()` — share capability checks
- `updateActionButtons()` — enables/disables Download/Share buttons
- `updateIaDetails()`, `updateEoiDetails()` — section visibility
- `eoiOwnership()` — ownership radio button value

**New in v2.0+:**
- `renderLandingStaffControl()` — renders staff input (text or select) in landing screen
- `updateLandingContinue()` — enables/disables Continue button based on staff input
- `applyAppointmentMode()` — toggles `.show-in-person` / `.show-zoom` CSS classes
- `enterAppointment()` — handles Continue button: hides landing, sets team member, applies mode
- `backToStart()` — returns to landing screen (keeps form data in memory)
- `returnToLanding()` — resets mode to inPerson, clears landing staff, shows landing

**New in v2.1+:**
- `zoomPdfFileName()` — zoom compiled booklet filename
- `zoomFirstConsultFilename()` — individual First Consultation filename
- `zoomClientReviewFilename()` — individual Client Review filename
- `zoomEoiFilename()` — individual EOI filename (standard)
- `zoomLaVidaEoiFilename()` — individual La Vida EOI filename
- `zoomIaFilename()` — individual IA filename

**CRM portability:** Medium. Toast/status/validation UI are DOM-dependent and would be replaced by React equivalents. Pure logic (`safePart`, `pdfFileName`, validation rules) ports directly.

---

## Section C — Form Binding & UI State
**Lines:** ~991–1051

**Purpose:** Dynamic form rendering, dropdown controls, admin settings UI, event binding, and zoom field rendering.

**Key functions:**
- `bindFieldEvents(id)` — attaches input/change/blur handlers to form fields
- `optionValuesFor()`, `selectOptionsMarkup()` — dropdown data
- `renderConfigurableControl()`, `renderDropdownControl()` — dynamic form controls
- `renderOptionList()` — renders staff/branch/solicitor option lists
- `contactLabel()`, `contactOptionsMarkup()` — La Vida contact dropdowns
- `renderContactOptionList()` — renders contact option rows
- `contactById()`, `formatContactNameForPdf()`, `matchingContactId()` — contact helpers
- `migrateLaVidaDraftSelections()` — legacy draft migration
- `fillLaVidaContact()`, `renderLaVidaContactControls()` — La Vida UI
- `syncLaVidaContactsFromChoices()` — dropdown ↔ manual field sync
- `renderDefaultControls()`, `savePdfDefaultsFromControls()` — PDF defaults UI
- `renderAdminSettings()` — full settings render (now includes `renderLandingStaffControl()`)
- `renderConfigurableFields()` — renders team member, staff, solicitor, branch, EOI, La Vida controls
- `preserveDraftDropdownValue()` — draft compatibility
- `setControlValue()` — safe DOM value setter
- `applyPdfDefaults()`, `applyLaVidaDefaults()` — default value application
- `updateLaVidaDetails()` — La Vida section visibility
- `copyEOIToIA()` — cross-form data sync

**New in v2.1+:**
- `preserveZoomDraftValue()` — ensures zoom dropdown values from draft are preserved
- `renderZoomFields()` — populates builder/developer/broker/conveyancer/timeline dropdowns

**CRM portability:** Low. Most of this section is DOM rendering. Replaced by React components. Only pure helpers (`contactById`, `formatContactNameForPdf`, `migrateLaVidaDraftSelections`, `matchingContactId`) are worth porting.

---

## Section D — Admin Settings Management
**Lines:** ~552–702

**Purpose:** Settings load/save/normalise, settings key constants, default settings, and zoom defaults.

**Key functions:**
- `loadAdminSettings()` — reads from `localStorage`, falls back to defaults
- `cloneDefaultAdminSettings()` — deep clone of `defaultAdminSettings`
- `htmlEscape()` — XSS prevention for settings rendering
- `dedupeTextOptions()` — removes duplicate dropdown options
- `templateValueFromLabel()`, `templateLabelFromValue()` — EOI template name mapping
- `normalizeTemplateOptions()` — normalises template option objects
- `contactIdFromName()`, `normalizeContactOption()`, `normalizeContactOptions()` — contact normalisation
- `firstContactId()` — returns first contact option's ID
- `normalizeAdminSettings(saved)` — main settings normalisation
- `saveAdminSettings()` — persists to `localStorage`

**New in v2.0+:**
- `zoomDefaults` object (line ~73) — internal placeholders for builders, developers, timeline options. These should migrate to Admin Settings in a future release.

**CRM portability:** Low. Replaced by Firestore-based settings in CRM. Only normalisation helpers might be useful during migration.

---

## Section E — Summary Card & Progress Indicators
**Lines:** ~1155–1277

**Purpose:** Summary card rendering, section progress indicators, checklist state, zoom summary card.

**Key functions:**
- `clearGenerated()` — resets `lastPdfBlob`, `lastPdfName`, `lastIndividualPdfs`, `lastZipBlob`, `previewPageIndex`
- `updateIndicator()` — single indicator badge update
- `updateSummaryCard()` — full summary card re-render (in-person and zoom)

**New in v2.0+:**
- Zoom summary card: shows appointment type, clients, staff, builder, developer, broker, conveyancer, property, outputs
- `appointmentStatus` shows "✅ Zoom booklet ready" when PDF is generated in zoom mode

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section F — Photo UI & Additional Documents
**Lines:** ~1486–1510

**Purpose:** Photo upload boxes, additional document UI, photo management.

**Key functions:**
- `makePhotoUI()` — builds photo upload boxes for indices 0-3
- `renderAdditionalDocsUI()` — builds additional document upload boxes

**CRM portability:** Low. Replaced by React file upload components.

---

## Section G — Live Summary Rendering
**Lines:** ~1518–1569

**Purpose:** Live summary sidebar showing form state and missing required fields.

**Key functions:**
- `renderLiveSummary()` — full live summary re-render

**New in v2.0+:**
- Zoom mode early return: skips photo/signature/checklist checks, shows only basic client info and missing required fields

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section H — Section Progress & Badges
**Lines:** ~1714–1765

**Purpose:** Section completion badges and progress tracking (in-person sections only).

**Key functions:**
- `updateSectionProgress()` — checks completion of each in-person form section
- `updateBadge()` — single badge state update

**Note:** Zoom sections do not currently display progress badges. This area is reserved for future enhancement.

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section I — Signature Canvas & Status
**Lines:** ~1645–1675

**Purpose:** Signature canvas setup, pointer event handling, and clear operations.

**Key functions:**
- `clearSig()` — clears signature 1 canvas
- `pos(e)` — pointer position relative to sig1 canvas
- `clearSig2()` — clears signature 2 canvas
- `pos2(e)` — pointer position relative to sig2 canvas
- `updateSignatureStatuses()` — updates signature status badges

**State variables:** `sig`, `sctx`, `drawing`, `sig2`, `sctx2`, `drawing2`, `hasSignature`, `hasSignature2`

**CRM portability:** Medium. Canvas drawing logic is self-contained. Needs wrapping in a React component with `useRef` and `useEffect`.

---

## Section J — Image Loading & Logo Helpers
**Lines:** ~1677–1693

**Purpose:** Image loading, template image caching, photo handling, logo rendering.

**Key functions:**
- `readAsDataURL(file)` — File → data URL
- `loadImage(src)` — URL → Image element
- `ensurePageLogo()` — loads ASG logo once
- `drawSmallPageLogo(ctx)` — draws logo top-right on PDF pages
- `ensureIAImage(city)` — loads IA template image
- `ensureLaVidaImages()` — loads La Vida template images
- `handlePhoto(idx, file)` — processes uploaded photo
- `renderPhotoBox(idx)` — renders photo in upload box
- `rotatePhoto(idx)` — rotates photo 90°
- `removePhoto(idx)` — removes photo

**CRM portability:** High. All image loading functions have zero DOM dependencies (except `renderPhotoBox`). `loadImage`, `ensurePageLogo`, `drawSmallPageLogo`, `ensureIAImage`, `ensureLaVidaImages` port directly.

---

## Section K — PDF Drawing Primitives
**Lines:** ~1695–2212

**Purpose:** Core PDF drawing utilities: page frames, lines, text wrapping, images, dates, formatting.

**Key functions:**
- `drawRoundRect()` — rounded rectangle primitive
- `wrapText()` — multi-line text wrapping
- `formatISODate()`, `formatDisplayDate()`, `formatDisplayDateTime()` — date utilities
- `fieldText(id)` — DOM field reader (port adapter needed)
- `generatedFooterText()`, `drawGeneratedFooter()` — PDF footer
- `normalizeDateField()`, `updateDateDisplays()` — date field normalisation
- `formatNextAppointment()` — appointment string formatter
- `formatPrice()`, `stripCurrency()`, `applyPriceFormat()` — currency formatting
- `updateHLTotal()` — house+land auto-sum
- `drawPageFrame()` — page background, title, subtitle, separator, footer, logo
- `drawLineValue()` — labelled field with underline
- `drawImageContain()` — image fitting helper
- `drawPhotoPage()` — full photo/ID page renderer
- `formattedDateForIA()` — date formatted for IA overlay

**CRM portability:** High. All drawing primitives are pure canvas operations. `fieldText()` and `updateHLTotal()` need adapting to accept form data instead of DOM. Everything else ports directly.

---

## Section L — IA Template Page Drawing
**Lines:** ~2222–2605

**Purpose:** Irrevocable Authority page rendering with template image and overlay fields.

**Key functions (nested inside `drawIAPage()`):**
- `drawIAPage(city, pageNumber, totalPages, scale)` — main entry
- `whiteOut(sx, sy, sw, sh)` — clears background for overlay text
- `overlayText(text, sx, sy, sw, font)` — single-line text overlay
- `overlayFitText(text, sx, sy, sw)` — auto-sizing text overlay
- `drawTemplateLineValue(text, sx, baselineSy, sw, options)` — multi-line text overlay with wrapping

**Key data sources:**
- `iaImageCache[city]` — template image
- `isChecked('showIaOverrides')` — override toggle
- `fieldText('iaClientNames')` / `mergedClientNames()` — names
- `fieldText('iaAddress')` / `fieldText('clientAddress')` — address
- `fieldText('iaProperty')` / `fieldText('propertySaleAddress')` — property
- `fieldText('iaAmount')` — authority amount
- `fieldText('iaSolicitor')` — solicitor
- `formattedDateForIA()` — date
- `hasSignature` / `hasSignature2` — signature checkboxes
- `sig` / `sig2` — signature canvases

**CRM portability:** High. All drawing functions are canvas-based. Need to abstract DOM field reads to `formData` parameter. Coordinate map functions (`map`, `maxW`) are self-contained.

---

## Section M — EOI & La Vida Page Drawing
**Lines:** ~2608–2720

**Purpose:** Standard EOI and La Vida EOI page rendering, overlay helpers, signature boxes.

**Key objects:**
- `laVidaFieldRects` — field position definitions in source-image coordinates

**Key functions:**
- `eoiValue()`, `hasSecondClientData()`, `eoiClient2Value()`, `eoiSaleAddressValue()` — EOI field helpers
- `pdfRectToCanvas()` — PDF coordinate → canvas coordinate conversion
- `drawLaVidaField()`, `drawLaVidaCheckbox()` — La Vida overlay rendering
- `splitPersonName()`, `branchStateFallback()`, `splitAustralianAddress()` — data parsing
- `datePartsForLaVida()`, `laVidaClientData()`, `laVidaOwnershipText()`, `laVidaDefaultValue()` — data extraction
- `drawSmallCheck()`, `drawSignatureBox()` — shared drawing primitives
- `drawEoiPage()`, `drawStandardEoiPage()` — Standard EOI renderer
- `drawLaVidaEoiPage()` — La Vida EOI renderer

**CRM portability:** High. All drawing functions. Data extraction functions need `formData` parameter instead of DOM.

---

## Section N — PDF Pipeline Orchestration
**Lines:** ~2723–3117

**Purpose:** PDF pipeline: plan → validate → render pages → assemble PDF binary. Zoom output plan and dispatch.

**Key functions (in-person):**
- `outputPlan()` — determines page sequence and count (delegates to `zoomOutputPlan()` in zoom mode)
- `buildOutputGroups()` — creates document groups for individual PDF extraction
- `drawOutputPage(index, totalPages, scale)` — dispatches page rendering by type (zoom dispatch added in v2.2)
- `updatePreviewControls()`, `refreshPreview()` — preview panel management
- `dataURLToBytes()` — data URL → Uint8Array
- `makePDF(canvases, quality)` — assembles PDF-1.4 binary from canvases
- `buildPdf()` — master orchestrator
- `downloadBlob(blob, name)` — triggers browser download
- `generatePdfOnly()` — "Generate PDF" button handler
- `downloadPdf()` — "Download PDF" button handler
- `buildIndividualPdfs()` — creates one PDF per document group (for ZIP)
- `downloadPackage()` — "Download Package" button handler (compiled PDF + ZIP)
- `buildZip()` — builds ZIP from individual PDFs

**New in v2.2+:**
- `zoomOutputPlan()` — zoom-specific page plan (cover + consult + review + optional EOI/IA)
- `drawZoomCover()` — cover page renderer
- `drawZoomFirstConsult()` — First Consultation page renderer
- `drawZoomClientReview()` — Client Review page renderer
- Zoom dispatch in `drawOutputPage()` — routes to zoom renderers with `eoiSubIndex` for multi-page EOI
- `buildIndividualPdfs()` and `buildZip()` work for both in-person and zoom modes

**CRM portability:** High. `makePDF`, `dataURLToBytes`, `outputPlan`, `zoomOutputPlan`, `drawOutputPage` are pure logic. `buildPdf` orchestrates them. `downloadBlob` is DOM-dependent but trivial to reproduce.

---

## Section O — Share & Email
**Lines:** ~3054–3126

**Purpose:** Email subject/body generation, share workflow, package download.

**Key functions:**
- `buildShareEmailContent()` — builds subject/body/recipients
- `sharePdf()` — "Share PDF" button handler
- `downloadPackage()` — "Download Package" handler (individual PDFs + ZIP)

**CRM portability:** High. `buildShareEmailContent()` ports directly. `sharePdf()` needs adapting to use CRM toast system and Firebase Storage URLs.

---

## Section P — Draft Persistence
**Lines:** ~3088–3209

**Purpose:** Draft save/load, test data loading, form reset, zoom field preservation.

**Key functions:**
- `getDraft()` — collects all form state into JSON (includes `appointmentMode` and all zoom fields via fields array)
- `setDraft(data)` — restores form state from JSON (restores `appointmentMode`, renders zoom fields)
- `saveDraft()` — saves to `localStorage`
- `loadDraft()` — loads from `localStorage`
- `loadTestData()` — populates form with QA test data
- `resetForm()` — clears all form fields and returns to landing screen

**New in v2.0+:**
- `appointmentMode` saved/loaded with draft
- Zoom field values preserved via `preserveZoomDraftValue()` for dropdowns
- `renderZoomFields()` called during draft load
- `returnToLanding()` called after `resetForm()`

**CRM portability:** Low. `localStorage` persistence replaced by Firestore. `getDraft()` data model useful as reference for Firestore schema.

---

## Section Q — Event Wiring & Initialisation
**Lines:** ~3215–3654

**Purpose:** Attach click event listeners to all buttons, initialise form state, kick off first render, expose test state.

**Key patterns:**
- `$('buttonId').addEventListener('click', handler)` for all UI buttons
- Landing screen events: `landingContinue`, `backToStart`, mode button toggles
- `renderZoomFields()` called during init
- `window._testState` — exposes internal state for automated testing (includes zoom helpers)
- `refreshPreview()` — initial preview render
- Service worker registration script (separate `<script>` block in `index.html`)

**New in v2.0+:**
- Landing screen button wiring (Continue, Back to Start, mode toggle)
- `window._testState.getZoomOutputPlan()`, `.buildIndividualPdfs()`, `.buildZip()` for automated testing

**CRM portability:** Low. Replaced by React's JSX event handling (`onClick`) and `useEffect` initialisation.
