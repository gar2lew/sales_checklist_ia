# Sales Appointment Capture — Architecture

## Overview

Single-page offline-first PWA for capturing sales appointment details and generating client PDFs. Runs entirely in the browser with no server-side component.

- **Entry point:** `index.html` (~3900 lines)
- **Service worker:** `service-worker.js`
- **Runtime:** IIFE (no build step, no modules)
- **Deployment:** Static file serving (Vercel)

---

## Application Flow

```
User fills form → Generates PDF → Downloads or Shares
```

1. **Form filling:** Staff enter appointment/client/property details, attach ID photos, capture signatures.
2. **PDF generation:** `buildPdf()` rasterises selected forms (EOI, IA, photo pages) to JPEG canvases, then assembles a binary PDF via `makePDF()`.
3. **Download:** `downloadBlob()` creates a temporary anchor element.
4. **Share:** `sharePdf()` prefers Web Share API with files; falls back to download + prefilled `mailto:` link.

---

## Data Flow

```
DOM fields ←→ localStorage (drafts + admin settings)
                  ↓
           buildPdf() → makePDF() → Blob → download / share
```

- **Form state:** Stored in DOM inputs; extracted via `fieldText(id)` and `getDraft()`.
- **Drafts:** Serialised to `localStorage['salesAppointmentDraft']` as JSON including photo data URLs.
- **Admin settings:** Stored in `localStorage['salesAppointmentAdminSettings']` as JSON; unlocked with a PIN stored in `sessionStorage`.
- **Generated PDF:** Held as `lastPdfBlob` (Blob) and `lastPdfName` (string) for download/share.
- **Template images:** Loaded on demand via `loadImage()` into `iaImageCache` and `laVidaImageCache`.

---

## Draft Storage

- **Key:** `salesAppointmentDraft` (configure in `CONFIG.storage.draftKey`)
- **Format:** `getDraft()` produces a JSON object with all field values, signature data URLs, and photo data URLs.
- **Restore:** `setDraft(data)` populates DOM fields and re-renders signatures/photos from data URLs.
- **Edge cases handled:** Missing `includeIA`/`includeEOI` fields, old `iaTemplate` migration, corrupt JSON, very large photos.

---

## PDF Pipeline

```
generatePdfOnly() / downloadPdf() / sharePdf()
  └─ buildPdf()
       ├─ outputPlan()         — determine page count and which forms are included
       ├─ validateBeforePdf()  — field validation
       ├─ drawOutputPage() × N — render each page to a canvas
       ├─ makePDF()            — assemble canvases into a binary PDF Blob
       └─ updateActionButtons()
```

### Page types and renderers

| Type | Renderer | Uses drawPageFrame? | Builder |
|------|----------|---------------------|---------|
| Standard EOI | `drawStandardEoiPage()` | Yes | `EOI_BUILDERS.standard` |
| La Vida EOI | `drawLaVidaEoiPage()` | No (template overlay) | `EOI_BUILDERS.laVidaHomes` |
| IA form | `drawIAPage()` | No (template overlay) | N/A |
| ID/photo | `drawPhotoPage()` | Yes | N/A |

### Builder Registry (`EOI_BUILDERS`)

Adding a new EOI template builder requires:
1. An entry in `EOI_BUILDERS` with `id`, `label`, `getPages()`, `drawPage()`, and optionally `ensureImages()`.
2. Template image assets.
3. Optionally, field rectangles for overlay fields (like `laVidaFieldRects`).

No changes to `outputPlan()`, `drawOutputPage()`, or `buildPdf()` are needed.

---

## Settings System

- **Storage:** `localStorage['salesAppointmentAdminSettings']`
- **Access:** PIN gated (`sessionStorage['salesAppointmentAdminUnlocked']`)
- **Sections:** Dropdowns (staff, branches, solicitors, EOI templates), PDF Defaults, La Vida contacts, Company details.
- **Import/export:** JSON download/upload via `exportSettings()` / `importSettingsFile()`.
- **Normalisation:** `normalizeAdminSettings()` handles legacy formats and missing fields.

---

## Template System

### IA Templates
- Images: source PDFs rasterised to images stored at configured paths.
- Cached in `iaImageCache` after first load.
- Overlay fields positioned via source-image coordinates (`map(sx, sy)`).

### La Vida EOI Templates
- Two-page template (`lavida-template-page-1.jpg`, `lavida-template-page-2.jpg`).
- Field rectangles defined in `laVidaFieldRects` (source-image coordinates).
- Contact dropdowns drawn from admin settings (finance brokers, conveyancers).

---

## Extension Points

### Adding a new builder (e.g., new EOI template)
```js
EOI_BUILDERS.myBuilder = {
  id: 'myBuilder',
  label: 'My Builder',
  getPages: () => 1,
  drawPage: (pageIndex, pageNumber, totalPages, scale) => { /* render */ },
  ensureImages: async () => { /* preload template images */ },
};
```
Then add an entry to `adminSettings.eoiTemplates.options` in `defaultAdminSettings`.

### Adding a new PDF page type
Extend `outputPlan()` to include the new page type and `drawOutputPage()` to dispatch to the new renderer.

### Customising email content
Edit `buildShareEmailContent()` or extend `CONFIG.share` with new defaults.

### Changing branding
Update `CONFIG.branding.logoPath` and service worker `APP_SHELL` to include the new logo asset.

---

## Code Organisation

The JavaScript in `index.html` is organised into labelled sections:

| Section | Contents |
|---------|----------|
| A | Application Configuration & Extension Points |
| B | Utility Functions & Date Helpers |
| C | Form Binding & UI State |
| D | Admin Settings Management |
| E | Summary Card & Progress Indicators |
| F | Photo UI & Additional Documents |
| G | Live Summary Rendering |
| H | Section Progress & Badges |
| I | Signature Canvas & Status |
| J | Image Loading & Logo Helpers |
| K | PDF Drawing Primitives |
| L | IA Template Page Drawing |
| M | EOI & La Vida Page Drawing |
| N | PDF Pipeline Orchestration |
| O | Share & Email |
| P | Draft Persistence |
| Q | Event Wiring & Initialisation |

---

## Key Architectural Decisions

1. **Single-file IIFE:** No build step, no module bundler. Keeps deployment simple but limits tooling. Future: consider extracting shared utilities to a separate `<script>` file.

2. **Canvas-based PDF rendering:** All pages are drawn to `<canvas>` elements, then converted to JPEG and embedded in a binary PDF. This avoids external PDF libraries but has no text selection in output.

3. **Template overlay approach:** IA and La Vida forms are pre-rendered images with text/signatures overlaid. Field positions are hardcoded as source-image coordinates.

4. **Offline-first:** Service worker caches all assets including template images. Drafts and settings are persisted in localStorage.

5. **No server:** All processing happens client-side. No analytics, no backend API, no authentication beyond the admin PIN.
