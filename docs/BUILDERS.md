# EOI Builders Registry

## Overview

The `EOI_BUILDERS` registry (defined in Section A of `index.html`) is the extension point for EOI template rendering. Each builder is an object with a standard interface. `outputPlan()` and `drawOutputPage()` dispatch through this registry, so adding a new builder requires **zero changes** to the PDF pipeline.

## Registry structure

```javascript
const EOI_BUILDERS = {
  standard: {
    id: 'standard',
    label: 'Standard',
    getPages: () => 1,
    drawPage: (_, pageNumber, totalPages, scale) => drawEoiPage(pageNumber, totalPages, scale),
  },
  laVidaHomes: {
    id: 'laVidaHomes',
    label: 'La Vida Homes',
    getPages: () => 2,
    drawPage: (pageIndex, pageNumber, totalPages, scale) =>
      drawLaVidaEoiPage(pageIndex, pageNumber, totalPages, scale),
    ensureImages: ensureLaVidaImages,
  },
};
```

### Builder interface

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | `string` | Yes | Matches the value in the EOI template `<select>` |
| `label` | `string` | Yes | Display name |
| `getPages()` | `() => number` | Yes | Returns page count for this template |
| `drawPage(pageIndex, pageNumber, totalPages, scale)` | `Function` | Yes | Renders a page to a canvas element |
| `ensureImages()` | `async Function` | Optional | Preloads template images before rendering |

### How the registry is used

**In `outputPlan()`:**
```javascript
const builder = EOI_BUILDERS[eoiTemplate] || EOI_BUILDERS.standard;
const eoiPageCount = includeEOI ? builder.getPages() : 0;
```

**In `drawOutputPage()`:**
```javascript
const builder = EOI_BUILDERS[plan.eoiTemplate] || EOI_BUILDERS.standard;
if (builder.ensureImages) await builder.ensureImages();
return builder.drawPage(index - offset, index + 1, totalPages, scale);
```

## How Standard EOI works

- **Renderer:** `drawEoiPage()` → `drawStandardEoiPage()`
- **Page count:** 1
- **Rendering:** Uses `drawPageFrame()` for the page layout, then draws client details, ownership, sale details, pricing, appointment details, notes, and signatures using `drawLineValue()`, `drawSmallCheck()`, and `drawSignatureBox()`.
- **No template image** — all content is drawn programmatically.

## How La Vida Homes works

- **Renderer:** `drawLaVidaEoiPage(templatePageIndex, ...)`
- **Page count:** 2
- **Templates:** `lavida-template-page-1.jpg` and `lavida-template-page-2.jpg` (loaded via `ensureLaVidaImages()`)
- **Rendering:** Template image is drawn full-page. Text fields are overlaid at precise positions defined in `laVidaFieldRects`. Checkbox ticks are drawn via `drawLaVidaCheckbox()`.
- **Logo:** `drawSmallPageLogo()` is called after the template image so the ASG logo appears top-right.
- **Footer:** A white overlay strip at the bottom with `drawGeneratedFooter()` for page numbers and generation timestamp.

## Required assets for La Vida

| Asset | Path | Loaded by |
|-------|------|-----------|
| Page 1 template | `lavida-template-page-1.jpg` | `ensureLaVidaImages()` |
| Page 2 template | `lavida-template-page-2.jpg` | `ensureLaVidaImages()` |

Both paths are in `laVidaImageSources` and cached by the service worker in `APP_SHELL`.

## How to add a new builder

### Step 1: Add template assets

Copy template images to the project root. Add them to the service worker `APP_SHELL`.

### Step 2: Register the builder

Add an entry to `EOI_BUILDERS`:

```javascript
myNewBuilder: {
  id: 'myNewBuilder',
  label: 'My New Builder',
  getPages: () => 1,  // or 2, or dynamic
  drawPage: (pageIndex, pageNumber, totalPages, scale) => {
    // Create canvas, draw template image, overlay fields
    return canvas;
  },
  ensureImages: async () => {
    // Preload template images into a cache
  },
},
```

### Step 3: Add template option to settings

Add to `defaultAdminSettings.eoiTemplates.options`:

```javascript
{ value: 'myNewBuilder', label: 'My New Builder' }
```

### Step 4 (optional): Add field rectangles

If the template has overlay fields, define a `fieldRects` object in source-image coordinates and a `drawField()` helper (see `laVidaFieldRects` and `drawLaVidaField()` for reference).

### Step 5: Test

Generate PDFs with the new builder selected. Verify:
- All pages render without clipping
- Overlay fields are correctly positioned
- Footer and logo appear correctly
- Download and share workflows still work

## Checklist for adding another builder template

- [ ] Template images in project root
- [ ] Template images in service worker `APP_SHELL`
- [ ] Builder entry in `EOI_BUILDERS`
- [ ] `getPages()` returns correct count
- [ ] `drawPage()` handles all page indices
- [ ] `ensureImages()` loads and caches images
- [ ] Template option in `defaultAdminSettings.eoiTemplates.options`
- [ ] Overlay coordinates measured and defined (if needed)
- [ ] Logo placement verified (call `drawSmallPageLogo()` if template doesn't have branding)
- [ ] Footer placement verified
- [ ] Tested with long text values (wrapping/truncation)
- [ ] Tested with two-client data
- [ ] Tested with EOI + IA combination
- [ ] Download still works
- [ ] Share email subject/body includes correct forms description

## Where overlay coordinates live

- **La Vida Homes:** `laVidaFieldRects` object (line ~3189). Each entry maps a field name to `[x1, y1, x2, y2]` source-image coordinates. Converted to canvas coordinates by `pdfRectToCanvas()`.
- **IA forms:** Coordinates are inline in `drawIAPage()` as arguments to `whiteOut()`, `drawTemplateLineValue()`, `overlayText()`, and `overlayFitText()`.

## Common risks when adding templates

1. **Coordinate mismatch** — Source-image coordinates are calibrated to specific template files. If the template PDF/image dimensions change, all coordinates must be re-measured.
2. **Aspect ratio** — IA forms are US Letter ratio and fitted to A4. La Vida templates are expected to be A4 ratio. Non-A4 templates may need special fitting logic.
3. **Text overflow** — Overlay fields have fixed max lines. Long property addresses or client names may be truncated. Consider increasing `maxLines` or adding dynamic sizing.
4. **Font availability** — All text uses system fonts (Arial). No custom fonts are embedded in PDFs.
5. **Colour space** — Template images are JPEG. Ensure sufficient resolution for print (minimum 150 DPI at A4).
6. **Page count mismatch** — If `getPages()` returns the wrong count, `drawOutputPage()` will skip pages or try to draw non-existent pages.
