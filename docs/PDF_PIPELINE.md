# PDF Pipeline

## How PDF generation works

The app renders pages to HTML `<canvas>` elements, converts each canvas to a JPEG, then assembles the JPEGs into a binary PDF. No external PDF library is used.

**Pipeline entry points:**

```
User clicks "Generate PDF" → generatePdfOnly()
User clicks "Download PDF" → downloadPdf() → buildPdf() (if no blob exists)
User clicks "Share PDF"   → sharePdf()    → buildPdf() (if no blob exists)
```

**Full pipeline:**

```
generatePdfOnly() / downloadPdf() / sharePdf()
  └─ buildPdf()
       ├─ outputPlan()          — decide page count, which forms are included
       ├─ validateBeforePdf()   — form field validation
       ├─ drawOutputPage() × N  — render each page to a canvas (async)
       ├─ makePDF(canvases)     — assemble canvases into binary PDF Blob
       └─ updateActionButtons() — enable Download/Share buttons
```

## Output plan flow (`outputPlan()`)

`outputPlan()` determines the sequence and count of pages:

1. Check `includeEOI` checkbox → determine EOI template (`selectedEoiTemplateValue()`)
2. Look up builder in `EOI_BUILDERS` registry → call `builder.getPages()` for page count
3. Check `includeIA` checkbox → select IA form (perth/brisbane) → 1 page if included
4. Filter `photos` array for those with `.img` loaded → 1 page per photo
5. Return `{ selectedIA, includeEOI, eoiTemplate, eoiPageCount, selectedPhotos, totalPages }`

## Page types

| Page type | Renderer | Uses `drawPageFrame`? | Builder |
|-----------|----------|----------------------|---------|
| Standard EOI | `drawStandardEoiPage()` | Yes | `EOI_BUILDERS.standard` |
| La Vida EOI (2 pages) | `drawLaVidaEoiPage()` | No — overlays template image | `EOI_BUILDERS.laVidaHomes` |
| IA form | `drawIAPage()` | No — overlays template image | N/A |
| ID/photo page | `drawPhotoPage()` | Yes | N/A |

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

- **Preview:** `refreshPreview()` calls `drawOutputPage(previewPageIndex, totalPages, 1.25)` at 1.25× scale for screen display. Renders a single page into the preview panel.
- **Final PDF:** `buildPdf()` calls `drawOutputPage(i, totalPages, scale)` for all pages at 2× or 3× scale (configurable via `compressPhotos` checkbox), then assembles via `makePDF()`.

## Blob / download / share path

1. `makePDF(canvases, quality)` converts canvas array to JPEG data URLs, writes a PDF-1.4 binary, returns a `Blob` with MIME type `application/pdf`.
2. `buildPdf()` stores the blob in `lastPdfBlob` and filename in `lastPdfName`.
3. `downloadPdf()` calls `downloadBlob(blob, name)` which creates a temporary `<a>` element and clicks it.
4. `sharePdf()` creates a `File` from the blob and attempts `navigator.share()` with files. Falls back to download + `mailto:` link.

## PDF footer / versioning

- **Function:** `generatedFooterText()` → `"Generated by Sales Appointment Capture v{APP_VERSION} | Generated: {formatted datetime}"`
- **Rendered by:** `drawGeneratedFooter(ctx, pageNumber, totalPages, context)` at the bottom of every page.
- **Version:** Comes from `const APP_VERSION` in the IIFE constants section.

## Logo placement rules

- **Function:** `drawSmallPageLogo(ctx)`
- **Appears on:** All pages drawn via `drawPageFrame()` (Standard EOI, photo pages). Also called from `drawLaVidaEoiPage()`.
- **Does NOT appear on:** IA template page (`drawIAPage()`).
- **Position:** Top-right corner, max 26px height, right-aligned with 5px margin.
- **Asset:** `icons/asg_logo.png`, loaded via `ensurePageLogo()` → `pageLogoImage`.
- **Service worker:** Logo path is in `APP_SHELL` for offline caching.

## Known PDF alignment limitations

- **IA overlay coordinates** are calibrated to specific template images. Changing IA template images requires re-calibrating `whiteOut()` and `drawTemplateLineValue()` coordinates.
- **La Vida field rectangles** are hardcoded in `laVidaFieldRects`. A change to the La Vida template PDF requires all coordinates to be re-measured.
- **Text is not selectable** in generated PDFs — output is a rendered image, not text.
- **Line wrapping** in overlay fields has fixed max lines. Very long values (e.g. long property addresses) may be truncated with "...".
- **Signature quality** depends on canvas resolution. The 900×150px canvas is adequate for most signatures but very fine detail may be lost.
- **Colour accuracy** depends on `toDataURL('image/jpeg', quality)`. At compression quality 0.78, some colour fidelity loss occurs.
