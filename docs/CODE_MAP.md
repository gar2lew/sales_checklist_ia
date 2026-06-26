# Code Map — `index.html`

The application JavaScript is organised into labelled sections (A–Q) within the IIFE. This map describes each section's purpose, key functions, and CRM portability.

---

## Section A — Application Configuration & Extension Points
**Lines:** ~1150–1245

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

**CRM portability:** High. All functions read DOM state and can be adapted to accept a `formData` object instead. `CONFIG` and `EOI_BUILDERS` port directly.

---

## Section B — Utility Functions & Date Helpers
**Lines:** ~1246–1520

**Purpose:** Date formatting, validation, toast/status UI, and filename generation.

**Key functions:**
- `localDateISO()` — today's date in ISO format
- `toast(msg)`, `status(msg)` — UI notification helpers
- `clearValidation()`, `setFieldError()` — form validation UI
- `requireField()`, `requireValidDate()` — validation rules
- `validateBeforePdf(plan)` — main form validation
- `safePart(s, fallback)` — filename sanitisation
- `pdfFileName()` — generated PDF filename
- `updateName()` — updates filename preview and signature labels
- `updateVersionLabels()` — updates version display
- `canSharePdfFiles()`, `canShareFilesPossible()` — share capability checks
- `updateActionButtons()` — enables/disables Download/Share buttons
- `updateIaDetails()`, `updateEoiDetails()` — section visibility
- `eoiOwnership()` — ownership radio button value

**CRM portability:** Medium. Toast/status/validation UI are DOM-dependent and would be replaced by React equivalents. Pure logic (`safePart`, `pdfFileName`, validation rules) ports directly.

---

## Section C — Form Binding & UI State
**Lines:** ~1686–2056

**Purpose:** Dynamic form rendering, dropdown controls, admin settings UI, and event binding.

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
- `renderAdminSettings()`, `renderConfigurableFields()` — full settings render
- `preserveDraftDropdownValue()` — draft compatibility
- `setControlValue()` — safe DOM value setter
- `applyPdfDefaults()`, `applyLaVidaDefaults()` — default value application
- `updateLaVidaDetails()` — La Vida section visibility
- `copyEOIToIA()` — cross-form data sync

**CRM portability:** Low. Most of this section is DOM rendering. Replaced by React components. Only pure helpers (`contactById`, `formatContactNameForPdf`, `migrateLaVidaDraftSelections`, `matchingContactId`) are worth porting.

---

## Section D — Admin Settings Management
**Lines:** ~1521–1685

**Purpose:** Settings load/save/normalise, settings key constants, and default settings.

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

**CRM portability:** Low. Replaced by Firestore-based settings in CRM. Only normalisation helpers might be useful during migration.

---

## Section E — Summary Card & Progress Indicators
**Lines:** ~2057–2190

**Purpose:** Summary card rendering, section progress indicators, checklist state.

**Key functions:**
- `clearGenerated()` — resets `lastPdfBlob`, `lastPdfName`, `previewPageIndex`
- `updateIndicator()` — single indicator badge update
- `updateSummaryCard()` — full summary card re-render

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section F — Photo UI & Additional Documents
**Lines:** ~2191–2340

**Purpose:** Photo upload boxes, additional document UI, photo management.

**Key functions:**
- `makePhotoUI()` — builds photo upload boxes for indices 0-3
- `renderAdditionalDocsUI()` — builds additional document upload boxes

**CRM portability:** Low. Replaced by React file upload components.

---

## Section G — Live Summary Rendering
**Lines:** ~2341–2498

**Purpose:** Live summary sidebar showing form state and missing required fields.

**Key functions:**
- `renderLiveSummary()` — full live summary re-render

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section H — Section Progress & Badges
**Lines:** ~2499–2569

**Purpose:** Section completion badges and progress tracking.

**Key functions:**
- `updateSectionProgress()` — checks completion of each form section
- `updateBadge()` — single badge state update

**CRM portability:** Low. DOM rendering replaced by React.

---

## Section I — Signature Canvas & Status
**Lines:** ~2570–2607

**Purpose:** Signature canvas setup, pointer event handling, and clear operations.

**Key functions:**
- `clearSig()` — clears signature 1 canvas
- `pos(e)` — pointer position relative to sig1 canvas
- `clearSig2()` — clears signature 2 canvas
- `pos2(e)` — pointer position relative to sig2 canvas

**State variables:** `sig`, `sctx`, `drawing`, `sig2`, `sctx2`, `drawing2`, `hasSignature`, `hasSignature2`

**CRM portability:** Medium. Canvas drawing logic is self-contained. Needs wrapping in a React component with `useRef` and `useEffect`.

---

## Section J — Image Loading & Logo Helpers
**Lines:** ~2608–2719

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
**Lines:** ~2720–2998

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
**Lines:** ~2999–3181

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
**Lines:** ~3182–3497

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
**Lines:** ~3498–3641

**Purpose:** PDF pipeline: plan → validate → render pages → assemble PDF binary.

**Key functions:**
- `outputPlan()` — determines page sequence and count
- `drawOutputPage(index, totalPages, scale)` — dispatches page rendering by type
- `updatePreviewControls()`, `refreshPreview()` — preview panel management
- `dataURLToBytes()` — data URL → Uint8Array
- `makePDF(canvases, quality)` — assembles PDF-1.4 binary from canvases
- `buildPdf()` — master orchestrator
- `downloadBlob(blob, name)` — triggers browser download
- `generatePdfOnly()` — "Generate PDF" button handler
- `downloadPdf()` — "Download PDF" button handler

**CRM portability:** High. `makePDF`, `dataURLToBytes`, `outputPlan`, `drawOutputPage` are pure logic. `buildPdf` orchestrates them. `downloadBlob` is DOM-dependent but trivial to reproduce.

---

## Section O — Share & Email
**Lines:** ~3642–3741

**Purpose:** Email subject/body generation and share workflow.

**Key functions:**
- `buildShareEmailContent()` — builds subject/body/recipients
- `sharePdf()` — "Share PDF" button handler

**CRM portability:** High. `buildShareEmailContent()` ports directly. `sharePdf()` needs adapting to use CRM toast system and Firebase Storage URLs.

---

## Section P — Draft Persistence
**Lines:** ~3742–3929

**Purpose:** Draft save/load, test data loading, form reset.

**Key functions:**
- `getDraft()` — collects all form state into JSON
- `setDraft(data)` — restores form state from JSON
- `saveDraft()` — saves to `localStorage`
- `loadDraft()` — loads from `localStorage`
- `loadTestData()` — populates form with QA test data
- `resetForm()` — clears all form fields

**CRM portability:** Low. `localStorage` persistence replaced by Firestore. `getDraft()` data model useful as reference for Firestore schema.

---

## Section Q — Event Wiring & Initialisation
**Lines:** ~3930–end

**Purpose:** Attach click event listeners to all buttons, initialise form state, kick off first render.

**Key patterns:**
- `$('buttonId').addEventListener('click', handler)` for all UI buttons
- `window._testState` — exposes internal state for automated testing
- `refreshPreview()` — initial preview render
- Service worker registration script (separate `<script>` block, line ~3860)

**CRM portability:** Low. Replaced by React's JSX event handling (`onClick`) and `useEffect` initialisation.
