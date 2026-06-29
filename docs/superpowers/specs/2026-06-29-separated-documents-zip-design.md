# Separated Documents ZIP for Appointment Package

**Date:** 2026-06-29
**Version:** 1.6.1

## Summary

Add ZIP generation of separated individual PDFs to the share/email workflow. The compiled PDF stays unchanged. A new "Download Package" button downloads both the compiled PDF and a ZIP of individual PDFs. The share workflow attempts multi-file sharing (PDF + ZIP), falling back to downloads + prefilled email.

## What Stays the Same

- `buildPdf()`: Generates only the compiled multi-page PDF (unchanged).
- `downloadPdf()`: Downloads only the compiled PDF (unchanged).
- Download PDF button: Unchanged.

## What's New

### 1. `outputPlan()` Extension — Document Grouping Metadata

Returns a `groups` array. Each group maps to a logical document:
- `{ id: 'eoi', pageCount: N, filenameFn }` — EOI pages (if included)
- `{ id: 'ia', pageCount: 1, filenameFn }` — IA page (if included)
- `{ id: 'client1_front', pageCount: 1, filenameFn }` — Client 1 ID Front
- `{ id: 'client1_back', pageCount: 1, filenameFn }` — Client 1 ID Back
- `{ id: 'client2_front', pageCount: 1, filenameFn }` — Client 2 ID Front
- `{ id: 'client2_back', pageCount: 1, filenameFn }` — Client 2 ID Back
- `{ id: 'additional_0', pageCount: 1, filenameFn }` … per additional doc

Groups with no image (pageCount=0) are omitted. `filenameFn` returns the per-document PDF filename.

### 2. New State

```js
let lastIndividualPdfs = null;  // [{ blob, name }]
let lastZipBlob = null;
let lastZipName = '';
```

### 3. `buildIndividualPdfs()` — Lazy Individual PDF Generation

- Calls `outputPlan()` → iterates groups → renders group's canvases via `drawOutputPage()` → calls `makePDF()` per group
- Returns `[{ blob, name }]`
- Caches in `lastIndividualPdfs`

### 4. `buildZip()` — Binary ZIP Writer

- Minimal raw binary ZIP (Store method, no compression)
- Takes `[{ blob, name }]`, returns `{ blob, name }`
- Safe duplicate name handling: append ` (2)`, ` (3)`, etc.
- ZIP does NOT contain the compiled PDF

### 5. New "Download Package" Button

- Added next to Download PDF (top and bottom)
- Enabled/disabled same as Download PDF
- Downloads both compiled PDF + ZIP

### 6. Modified Share Workflow

- Builds both compiled PDF file + ZIP file
- If `navigator.canShare([pdfFile, zipFile])`: calls `navigator.share({ files: [pdfFile, zipFile] })` (no mailto pre-open)
- Fallback: downloads both + opens mailto with message: "PDF and ZIP downloaded. Attach both files to the email before sending."

### 7. Email Content

**Subject:** `{Rep Name} - Sales Appointment - {Forms} Forms - {Client Names} - {Property} - {Date}`

**Body:** Updated to mention both attachments:
```
Hey Natalie,

Please see the attached appointment documents for:

{Client Names}
{Property}
{Date}

Attached is the complete appointment PDF together with a ZIP folder containing the separated documents for easier filing and processing.

If you need anything else, please let me know!

Regards,

{Rep Name}
```

### 8. File Naming

**Compiled PDF:** Existing `pdfFileName()` unchanged.

**ZIP:** `{Client Names} - Separated Appointment Documents - {DD-MM-YYYY}.zip`

**Individual PDFs in ZIP:**
- `EOI - {Client Names} - {Property} - {Rep Name} - {DD-MM-YYYY}.pdf`
- `IA - {Client Names} - {Rep Name} - {DD-MM-YYYY}.pdf`
- `Client 1 - ID Front.pdf`
- `Client 1 - ID Back.pdf`
- `Client 2 - ID Front.pdf`
- `Client 2 - ID Back.pdf`
- `{Client} - {Document Description}.pdf` (additional docs, using selected document type)

### 9. Cache Invalidation

`clearGenerated()` resets all caches (`lastPdfBlob`, `lastPdfName`, `lastIndividualPdfs`, `lastZipBlob`, `lastZipName`).

### 10. Version Bump

| File | From | To |
|------|------|-----|
| `js/app.js` APP_VERSION | 1.6.0 | 1.6.1 |
| `service-worker.js` CACHE_VERSION | v1.6.0 | v1.6.1 |
| `index.html` hardcoded labels | 1.4.7 | 1.6.1 |
