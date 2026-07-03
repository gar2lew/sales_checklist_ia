# PDF Pipeline

## How PDF generation works

The app renders pages to HTML `<canvas>` elements, converts each canvas to a JPEG, then assembles the JPEGs into a binary PDF. No external PDF library is used.

**Pipeline entry points:**

```
User clicks "Generate PDF" → generatePdfOnly()
User clicks "Download PDF" → downloadPdf() → buildPdf() (if no blob exists)
User clicks "Share PDF"   → sharePdf()    → buildPdf() (if no blob exists)
```

**Full pipeline (in-person mode):**

```
generatePdfOnly() / downloadPdf() / sharePdf()
  └─ buildPdf()
       ├─ outputPlan()          — decide page count, which forms are included
       ├─ validateBeforePdf()   — form field validation
       ├─ drawOutputPage() × N  — render each page to a canvas (async)
       ├─ makePDF(canvases)     — assemble canvases into binary PDF Blob
       └─ updateActionButtons() — enable Download/Share buttons
```

**Full pipeline (zoom mode):**

```
generatePdfOnly()
  └─ buildPdf()
       ├─ outputPlan()
       │    └─ zoomOutputPlan()     — zoom-specific page plan
       ├─ validateBeforePdf()       — zoom validation (date, staff, client name)
       ├─ drawOutputPage() × N
       │    └─ zoom dispatch:
       │         ├─ drawZoomCover()
       │         ├─ drawZoomFirstConsult()
       │         ├─ drawZoomClientReview()
       │         ├─ EOI builder (standard/laVida)
       │         └─ drawIAPage()
       ├─ makePDF(canvases)         — assemble into PDF Blob
       └─ updateActionButtons()
```

## Output plan flow (`outputPlan()`)

### In-person mode

`outputPlan()` determines the sequence and count of pages:

1. Check `includeEOI` checkbox → determine EOI template (`selectedEoiTemplateValue()`)
2. Look up builder in `EOI_BUILDERS` registry → call `builder.getPages()` for page count
3. Check `includeIA` checkbox → select IA form (perth/brisbane) → 1 page if included
4. Filter `photos` array for those with `.img` loaded → 1 page per photo
5. Return `{ selectedIA, includeEOI, eoiTemplate, eoiPageCount, selectedPhotos, totalPages }`

### Zoom mode

When `appointmentMode === 'zoom'`, `outputPlan()` delegates to `zoomOutputPlan()`:

1. Cover page (always) — 1 page
2. First Consultation (always) — 1 page
3. Client Review / Assessment (always) — 1 page
4. Optional Standard EOI (if `zoomIncludeStandardEOI` checked) — 1 page
5. Optional La Vida EOI (if `zoomIncludeLaVidaEOI` checked) — 2 pages
6. Optional IA (if `zoomIncludeIA` checked) — 1 page

Return value: `{ totalPages, pages, groups }` where `pages` is an array of page definitions and `groups` maps to individual documents for ZIP packaging.

| Output | Pages | Condition |
|--------|-------|-----------|
| Cover | 1 | Always |
| First Consultation | 1 | Always |
| Client Review | 1 | Always |
| Standard EOI | 1 | `zoomIncludeStandardEOI` |
| La Vida EOI | 2 | `zoomIncludeLaVidaEOI` |
| IA | 1 | `zoomIncludeIA` |

## Page types

### In-person mode

| Page type | Renderer | Uses `drawPageFrame`? | Builder |
|-----------|----------|----------------------|---------|
| Standard EOI | `drawStandardEoiPage()` | Yes | `EOI_BUILDERS.standard` |
| La Vida EOI (2 pages) | `drawLaVidaEoiPage()` | No — overlays template image | `EOI_BUILDERS.laVidaHomes` |
| IA form | `drawIAPage()` | No — overlays template image | N/A |
| ID/photo page | `drawPhotoPage()` | Yes | N/A |

### Zoom mode

| Page type | Renderer | Notes |
|-----------|----------|-------|
| Cover | `drawZoomCover()` | Title, client names, staff, date |
| First Consultation | `drawZoomFirstConsult()` | Appointment details, client details, goals, financial snapshot, notes |
| Client Review | `drawZoomClientReview()` | Strategy, builder, developer, broker, conveyancer, property, timeline, next actions |
| Standard EOI | `builder.drawPage()` | Dispatched through EOI_BUILDERS.standard |
| La Vida EOI (2 pages) | `builder.drawPage()` | Dispatched through EOI_BUILDERS.laVidaHomes with `eoiSubIndex` |
| IA | `drawIAPage()` | Same as in-person IA |

## Zoom drawing functions

### `drawZoomCover(pageNumber, totalPages, scale)`

Simple cover page with:
- "Sales Appointment" title (28px, navy)
- "Zoom / Online Appointment" subtitle (18px, gold)
- Gold separator line
- Client names, staff member, date
- Footer with page number

Logo is not drawn on the cover page.

### `drawZoomFirstConsult(pageNumber, totalPages, scale)`

Professional report page with:
- **Appointment Details:** Date, Staff (line-value fields)
- **Client Details:** Client 1/2 names, phone, email, address (line-value fields)
- **Client Goals:** Goal type from radio selection
- **Financial Snapshot:** Annual income, existing mortgage, savings, super, investment properties, borrowing capacity
- **General Notes:** Multi-line wrapped text
- Footer: "First Consultation"

### `drawZoomClientReview(pageNumber, totalPages, scale)`

Professional report page with:
- **Recommended Strategy:** Multi-line wrapped text
- **Recommendations:** Builder, Developer, Finance Broker, Conveyancer (line-value fields)
- **Property & Timeline:** Recommended property (multi-line), estimated timeline
- **Next Actions:** Multi-line wrapped text
- Footer: "Client Review / Assessment"

## Standard EOI builder

- **Entry:** `drawEoiPage()` → `drawStandardEoiPage()`
- **Page frame:** `drawPageFrame()` adds white background, title ("Expression of Interest Form"), subtitle, gold separator line, footer, and small ASG logo.
- **Content sections:** Client details (Name, Mobile, Address, Email for Client 1 and Client 2), Ownership (Sole/Joint/Common with shares), Sale details (Type, Finance %, Address, Land/House/Total prices), Appointment details (Staff, Branch, Date, Next Appointment), Notes, Signatures.
- **Coordinates:** Layout uses `left=42`, `right=553` with `drawLineValue()` for labelled fields.

## La Vida builder

- **Entry:** `drawLaVidaEoiPage(templatePageIndex, ...)`
- **Template image:** Rendered full-page from `laVidaImageCache[templatePageIndex]`
- **Page 0:** Partner details, land pricing, purchaser 1 fields, checkbox overlays.
- **Page 1:** Purchaser 2 fields, finance broker, conveyancer, ownership, signatures.
- **Field rectangles:** All overlay positions defined in `laVidaFieldRects` (source-image coordinates). `pdfRectToCanvas()` converts PDF coordinates to canvas coordinates.
- **Logo:** `drawSmallPageLogo()` added after template image.

## IA builder

- **Entry:** `drawIAPage(city, pageNumber, totalPages, scale)`
- **Template image:** Rendered from `iaImageCache[city]` (perth or brisbane). Image is fitted to A4 page preserving aspect ratio.
- **Overlay fields:** `whiteOut()` clears background, then `drawTemplateLineValue()` places text for client names, address, property, solicitor, amount, and date.
- **Signatures:** Drawn from signature canvases if `iaApplySignature1`/`iaApplySignature2` are checked.
- **Logo:** NOT drawn — IA template has its own ASG letterhead.
- **Coordinates:** Source-image coordinates mapped via `map(sx, sy)` and `maxW(sw)`.

## Photo / additional document pages

- **Entry:** `drawPhotoPage(photo, pageNumber, totalPages, scale)`
- **Page frame:** `drawPageFrame()` with photo label as title, client name + date as subtitle.
- **Image:** Fitted to content area with rotation support, inside a rounded border.
- **Additional documents:** Distinguished by `photo.isAdditional` flag. Title uses `photo.client` and `photo.description`.

## Preview vs final PDF

- **Preview:** `refreshPreview()` calls `drawOutputPage(previewPageIndex, totalPages, 1.25)` at 1.25× scale for screen display. Renders a single page into the preview panel. In zoom mode, the preview message says "Zoom appointment documents will appear here once generated."
- **Final PDF:** `buildPdf()` calls `drawOutputPage(i, totalPages, scale)` for all pages at 2× or 3× scale (configurable via `compressPhotos` checkbox), then assembles via `makePDF()`.

## Zoom compiled booklet filename

```
Sales Appointment - Zoom - {clientNames} - {staffMember} - {date}.pdf
```

## Individual zoom document filenames

| Document | Pattern |
|----------|---------|
| First Consultation | `First Consultation - {clients} - {staff} - {date}.pdf` |
| Client Review | `Client Review Assessment - {clients} - {staff} - {date}.pdf` |
| Standard EOI | `EOI - {clients} - {staff} - {date}.pdf` |
| La Vida EOI | `La Vida EOI - {clients} - {staff} - {date}.pdf` |
| IA | `IA - {clients} - {staff} - {date}.pdf` |

## ZIP package (Download Package)

In zoom mode, the ZIP contains individual PDFs for each selected document:

1. Cover (compiled booklet)
2. First Consultation
3. Client Review
4. Optional EOI
5. Optional IA

ZIP filename: `{clientNames} - Zoom Appointment Documents - {date}.zip`

## Blob / download / share path

1. `makePDF(canvases, quality)` converts canvas array to JPEG data URLs, writes a PDF-1.4 binary, returns a `Blob` with MIME type `application/pdf`.
2. `buildPdf()` stores the blob in `lastPdfBlob` and filename in `lastPdfName`.
3. `downloadPdf()` calls `downloadBlob(blob, name)` which creates a temporary `<a>` element and clicks it.
4. `sharePdf()` creates a `File` from the blob and attempts `navigator.share()` with files. Falls back to download + `mailto:` link.
5. `buildIndividualPdfs()` creates one PDF per group (document type) for the ZIP package.
6. `downloadPackage()` downloads the compiled PDF plus a ZIP of individual documents.

## PDF footer / versioning

- **Function:** `generatedFooterText()` → `"Generated by Sales Appointment Capture v{APP_VERSION} | Generated: {formatted datetime}"`
- **Rendered by:** `drawGeneratedFooter(ctx, pageNumber, totalPages, context)` at the bottom of every page.
- **Version:** Comes from `const APP_VERSION` in the IIFE constants section.

## Logo placement rules

- **Function:** `drawSmallPageLogo(ctx)`
- **Appears on:** All pages drawn via `drawPageFrame()` (Standard EOI, photo pages). Also called from `drawLaVidaEoiPage()`, `drawZoomFirstConsult()`, `drawZoomClientReview()`.
- **Does NOT appear on:** IA template page (`drawIAPage()`), zoom cover page (`drawZoomCover()`).
- **Position:** Top-right corner, max 26px height, right-aligned with 5px margin.
- **Asset:** `icons/asg_logo.png`, loaded via `ensurePageLogo()` → `pageLogoImage`.
- **Service worker:** Logo path is in `APP_SHELL` for offline caching.

## Validation

### In-person mode

`validateBeforePdf()` validates:
- Appointment date (required, DD/MM/YYYY format)
- Team member (required)
- Client name (required)
- At least one output: EOI form, IA form, or ID photo
- EOI date and next appointment date (if EOI included)
- IA client names, address, property (if IA included)

### Zoom mode

When `appointmentMode === 'zoom'`, a minimal validation is used:
- Appointment date (required)
- Team member (required)
- Client name (required)
- At least one output option enabled

## Test state exposure

Internal functions are exposed via `window._testState` for automated testing:

```javascript
window._testState = {
  getPhotos: () => photos,
  setPhotoImg: ...,
  setHasSignature: ...,
  setHasSignature2: ...,
  clearGenerated: clearGenerated,
  getZoomOutputPlan: () => zoomOutputPlan(),
  buildIndividualPdfs: () => buildIndividualPdfs(),
  buildZip: (pdfs, name) => buildZip(pdfs, name),
  getOutputPlan: () => outputPlan()
};
```

## Known PDF alignment limitations

- **IA overlay coordinates** are calibrated to specific template images. Changing IA template images requires re-calibrating `whiteOut()` and `drawTemplateLineValue()` coordinates.
- **La Vida field rectangles** are hardcoded in `laVidaFieldRects`. A change to the La Vida template PDF requires all coordinates to be re-measured.
- **Text is not selectable** in generated PDFs — output is a rendered image, not text.
- **Line wrapping** in overlay fields has fixed max lines. Very long values (e.g. long property addresses) may be truncated with "...".
- **Signature quality** depends on canvas resolution. The 900×150px canvas is adequate for most signatures but very fine detail may be lost.
- **Colour accuracy** depends on `toDataURL('image/jpeg', quality)`. At compression quality 0.78, some colour fidelity loss occurs.
- **Zoom document engine** generates clean programmatic PDFs. These are placeholders for future branded templates.
