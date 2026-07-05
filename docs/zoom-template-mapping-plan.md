# Zoom Template Mapping Plan

## Current Version
**v2.3.0-alpha.1** (current) — App version: 2.3.0-alpha.1

## Overview

This document plans the real PDF template mapping for the Zoom appointment workflow. Currently, `drawZoomFirstConsult()` and `drawZoomClientReview()` generate clean programmatic report pages. These are placeholders for future branded templates.

---

## 1. Template Files

### Files Found

| Source PDF | Pages | Dimensions |
|-----------|-------|------------|
| `templates/first-consult-booklet-brisbane.pdf` | 6 | A4 portrait (595×842 pts) |
| `templates/first-consult-booklet-perth.pdf` | 6 | A4 portrait (595×842 pts) |
| `templates/client-review-assessment.pdf` | 4 | A4 portrait (595×842 pts) |

### First Consult has Brisbane and Perth variants
The First Consult booklet exists as two city-specific versions (Brisbane and Perth). These are separate PDFs with different content (likely different office details, branding or state-specific wording).

### Rendered Assets

All pages exported as high-resolution JPGs (200 DPI, 1654×2339 px) to `templates/rendered/`:

**First Consult — Brisbane (6 pages):**
- `templates/rendered/first-consult-brisbane-page-1.jpg`
- `templates/rendered/first-consult-brisbane-page-2.jpg`
- `templates/rendered/first-consult-brisbane-page-3.jpg`
- `templates/rendered/first-consult-brisbane-page-4.jpg`
- `templates/rendered/first-consult-brisbane-page-5.jpg`
- `templates/rendered/first-consult-brisbane-page-6.jpg`

**First Consult — Perth (6 pages):**
- `templates/rendered/first-consult-perth-page-1.jpg`
- `templates/rendered/first-consult-perth-page-2.jpg`
- `templates/rendered/first-consult-perth-page-3.jpg`
- `templates/rendered/first-consult-perth-page-4.jpg`
- `templates/rendered/first-consult-perth-page-5.jpg`
- `templates/rendered/first-consult-perth-page-6.jpg`

**Client Review (4 pages):**
- `templates/rendered/client-review-page-1.jpg`
- `templates/rendered/client-review-page-2.jpg`
- `templates/rendered/client-review-page-3.jpg`
- `templates/rendered/client-review-page-4.jpg`

All 16 assets registered in service worker `APP_SHELL` for offline caching.

### Files Required

A branded template pack for Zoom workflow needs **two documents** (or four pages if two-sided):

| Required Template | Recommended Pages | Notes |
|------------------|-------------------|-------|
| **First Consultation Booklet** | 2–4 pages | Cover + client details + financial snapshot + notes |
| **Client Review / Assessment** | 2–3 pages | Strategy + recommendations + property/timeline + next actions |

If a single booklet is preferred: **Zoom Appointment Booklet** covering all content in 4–6 pages.

---

## 2. Template Inspection

No templates exist to inspect. The following sections describe what each template MUST contain based on the current UI fields.

### Required First Consult Template Areas
- **Header:** ASG branding, title "First Consultation", date, staff name
- **Client Details:** Client 1/2 names, phone, email, address
- **Client Goals:** Goal type display (Investment, Home, SMSF, Wealth Creation, Retirement, Other)
- **Financial Snapshot:** Annual Income, Existing Mortgage, Savings, Super Balance, Investment Properties, Borrowing Capacity
- **Notes:** Large free-text area for consultation notes
- **Footer:** Page number, generation timestamp

### Required Client Review Template Areas
- **Header:** ASG branding, title "Client Review / Assessment", date
- **Strategy:** Large free-text area for recommended strategy
- **Recommendations:** Builder, Developer, Finance Broker, Conveyancer display fields
- **Property & Timeline:** Property address, estimated timeline display
- **Next Actions:** Large free-text area
- **Footer:** Page number, generation timestamp

---

## 3. Recommended Rendering Approach

### Recommendation: A — Background Image + Canvas Overlays

Same approach as the current **IA and La Vida** templates.

**Rationale:**

| Criterion | Why A wins |
|-----------|------------|
| **Reliable in browser** | Proven — already used for IA (Perth/Brisbane) and La Vida (2-page) templates. Works across all browsers. |
| **Maintainable** | Field positions are defined as coordinate arrays in JS (like `laVidaFieldRects`). Updating coordinates is a JS-only change. |
| **Consistent with current approach** | Exact same pattern as `drawIAPage()` (whiteout + overlay text) and `drawLaVidaEoiPage()` (template image + overlay fields). |
| **Least likely to break** | Canvas rendering is deterministic. No PDF.js library dependency. No AcroForm library dependency. |
| **Preview integration** | Preview uses the same `drawOutputPage()` path — templates work in preview natively. |

**Why NOT B (AcroForm):**
- Filling AcroForm fields requires a PDF library (pdf-lib, jsPDF). This adds an external dependency the app currently has zero of.
- Field position extraction from PDF forms requires tooling.
- AcroForm filling is harder to integrate with the existing preview system (which renders to canvas).

**Why NOT C (clean generated):**
- This is what we already have. The goal is to move TO branded templates.

### Implementation Pattern

```javascript
// Pattern to follow (from existing drawIAPage):
function drawZoomFirstConsultTemplate(pageNumber, totalPages, scale) {
  const img = zoomFirstConsultCache[pageIndex]; // Pre-loaded JPG
  if (!img) throw new Error('Template not loaded');
  
  // Fit template to A4
  const W = 595, H = 842;
  // ... image fitting logic ...
  ctx.drawImage(img, dx, dy, dw, dh);
  
  // Coordinate mapping (same as IA)
  const map = (sx, sy) => ({ x: dx + (sx / img.width) * dw, y: dy + (sy / img.height) * dh });
  
  // Whiteout for each field area
  whiteOut(sx, sy, sw, sh);
  
  // Overlay text for each field
  overlayText(text, sx, sy, sw, font);
  
  // Footer
  drawGeneratedFooter(ctx, pageNumber, totalPages, 'First Consultation', 42, 817);
  return c;
}
```

### Template Image Loading Pattern

Follow existing `ensureLaVidaImages()` pattern:

```javascript
const zoomFirstConsultSources = ['zoom-first-consult-page-1.jpg', 'zoom-first-consult-page-2.jpg'];
const zoomFirstConsultCache = [];

async function ensureZoomFirstConsultImages() {
  for (let i = 0; i < zoomFirstConsultSources.length; i++) {
    if (!zoomFirstConsultCache[i]) {
      zoomFirstConsultCache[i] = await loadImage(zoomFirstConsultSources[i]);
    }
  }
  return zoomFirstConsultCache;
}
```

Add to service worker `APP_SHELL` and to `laVidaImageSources`-style array.

---

## 4. Field Mapping Tables

### First Consultation Template

| PDF Field / Label | App Field ID | Exists? | New? | Overlay Strategy | Wrapping |
|-------------------|-------------|---------|------|------------------|----------|
| Client 1 Name | `clientName` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Client 1 Phone | `clientPhone` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Client 1 Email | `clientEmail` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Client 1 Address | `clientAddress` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Client 2 Name | `client2Name` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Client 2 Phone | `client2Phone` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Client 2 Email | `client2Email` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Appointment Date | `date` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Staff Member | `teamMember` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Property Sale Address | `propertySaleAddress` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Client Address | `clientAddress` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Goal Type | `firstConsultGoalType` | ✅ | No | `drawTemplateLineValue()` | 1 line (radio→text) |
| Annual Income | `firstConsultAnnualIncome` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Existing Mortgage | `firstConsultExistingMortgage` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Savings | `firstConsultSavings` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Super Balance | `firstConsultSuper` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Investment Properties | `firstConsultInvestmentProperties` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Borrowing Capacity | `firstConsultBorrowingCapacity` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| General Notes | `firstConsultNotes` | ✅ | No | `overlayFitText()` or `overlayText()` | 4-8 lines |
| Page Number | (auto) | — | — | `drawGeneratedFooter()` | — |
| Generation Timestamp | (auto) | — | — | `drawGeneratedFooter()` | — |

### Client Review / Assessment Template

| PDF Field / Label | App Field ID | Exists? | New? | Overlay Strategy | Wrapping |
|-------------------|-------------|---------|------|------------------|----------|
| Recommended Strategy | `clientReviewStrategy` | ✅ | No | `overlayFitText()` or `overlayText()` | 4-8 lines |
| Recommended Builder | `clientReviewBuilder` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Recommended Developer | `clientReviewDeveloper` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Recommended Finance Broker | `clientReviewBroker` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Recommended Conveyancer | `clientReviewConveyancer` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Recommended Property | `clientReviewProperty` | ✅ | No | `drawTemplateLineValue()` | 1-2 lines |
| Estimated Timeline | `clientReviewTimeline` | ✅ | No | `drawTemplateLineValue()` | 1 line |
| Next Actions | `clientReviewNextActions` | ✅ | No | `overlayFitText()` or `overlayText()` | 4-8 lines |
| Page Number | (auto) | — | — | `drawGeneratedFooter()` | — |
| Generation Timestamp | (auto) | — | — | `drawGeneratedFooter()` | — |

---

## 5. Missing Fields

**No missing fields.** All data required for both templates is already captured in the current Zoom workflow UI fields.

The 19 Zoom-specific fields plus shared Section 1 fields provide complete coverage.

| Current Gap | Status | Notes |
|-------------|--------|-------|
| Builder list | ✅ | Static in `zoomDefaults.builders` |
| Developer list | ✅ | Static in `zoomDefaults.developers` |
| Broker list | ✅ | Sourced from admin settings `laVidaFinanceBrokers` |
| Conveyancer list | ✅ | Sourced from admin settings `laVidaConveyancers` |
| Timeline options | ✅ | Static in `zoomDefaults.timeline` |

### Future Settings Migration (not blocking)

The following are currently hardcoded as JS arrays but should migrate to Admin Settings:

| Setting | Current Location | Target |
|---------|-----------------|--------|
| Builders | `zoomDefaults.builders` | Admin Settings → Builders tab |
| Developers | `zoomDefaults.developers` | Admin Settings → Developers tab |
| Timeline | `zoomDefaults.timeline` | Admin Settings → PDF Defaults |

---

## 6. Output Plan Impact

### How templates replace current generated pages

```
Current state:
drawZoomFirstConsult()  → programmatic A4 (navy title, line fields, gold separator)
drawZoomClientReview()  → programmatic A4 (same style)

Target state:
drawZoomFirstConsult()  → template-backed (JPG background + overlay fields)
  ↳ Falls back to programmatic if template image fails to load
drawZoomClientReview()  → template-backed (JPG background + overlay fields)
  ↳ Falls back to programmatic if template image fails to load
```

### Changes to `outputPlan()`

**Minimal change required.** The dispatch in `drawOutputPage()` already checks `appointmentMode === 'zoom'` and routes to zoom page renderers. The renderers themselves swap internals:

```javascript
// Before: fully programmatic
function drawZoomFirstConsult(...) {
  // render everything with ctx.fillText, drawLineValue, wrapText
}

// After: template-backed with programmatic fallback
async function drawZoomFirstConsult(...) {
  const img = zoomFirstConsultCache[0];
  if (img) {
    // Draw template image, overlay fields (same as drawIAPage)
  } else {
    // Fall back to current programmatic render
    return drawZoomFirstConsultFallback(...);
  }
}
```

### ZIP / Package Impact

**None.** Individual document filenames remain unchanged. The ZIP package logic is already generic — it calls `buildIndividualPdfs()` which calls `drawOutputPage()` for each page. No ZIP changes needed.

---

## 7. Implementation Phases

### Phase A: Template Acquisition & Inspection ✅ (complete)
- [x] Obtain branded First Consult booklet PDF from designer — **Brisbane (6pp) and Perth (6pp)**
- [x] Obtain branded Client Review/Assessment PDF from designer — **4 pages**
- [x] Export pages as high-resolution JPGs (≥150 DPI at A4) — **200 DPI, 1654×2339 px**
- [x] Crop/align for A4 (595.28 × 841.89 pts) — **native A4, no cropping needed**
- [x] Rename PDFs to clean filenames
- [x] Add rendered JPGs to service worker `APP_SHELL`
- [x] Create image source arrays and caches in `js/app.js`
- [x] Create `ensureZoomFirstConsultImages(city)` and `ensureZoomClientReviewImages()` loading functions
- [ ] **Next: Branch/location selection** — First Consult has Brisbane/Perth variants. A selection mechanism (e.g. from the existing branch dropdown or a new toggle) is needed to choose which template set to render.

### Phase B: Field Coordinate Mapping (next)
- [ ] For each template page, measure source-image coordinates for every field
- [ ] Create field rectangle definitions (like `laVidaFieldRects`)
- [ ] For each field, determine: whiteout rect, text baseline, max width, font size
- [ ] Account for Brisbane vs Perth coordinate differences (if any)
- [ ] Test with short and long values

### Phase C: Overlay Rendering
- [ ] Implement `drawZoomFirstConsultTemplate(city, pageIndex, ...)` following `drawIAPage()` pattern
- [ ] Implement `drawZoomClientReviewTemplate(pageIndex, ...)` following `drawIAPage()` pattern
- [ ] Add fallback to current programmatic renderers
- [ ] Hook into `drawOutputPage()` zoom dispatch

### Phase D: Verification
- [ ] All short values render correctly
- [ ] Long client names wrap without overflow
- [ ] Long addresses fit in designated areas
- [ ] Multi-page templates sequence correctly
- [ ] Templates fall back gracefully if image fails to load
- [ ] Preview works at 1.25× scale
- [ ] Final PDF at 2×/3× scale renders clearly
- [ ] Download PDF works
- [ ] Download Package / ZIP works
- [ ] Share fallback works
- [ ] Service worker caches templates for offline

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Long text wrapping in fixed template boxes | Medium | High — text clipped or overlapping | Use aggressive font shrinking (7px min), increase maxLines to 2-3 for name/address fields, test with worst-case data |
| Template resolution too low for print | Low | Medium — blurry PDF output | Require ≥150 DPI at A4. 595×842 px is minimum. |
| Template JPG file size too large | Medium | Medium — slow load, memory pressure | Target ≤500 KB per page. Use JPEG quality 85. |
| Mobile performance with large images | Low | Low — images load once and cache | `ensureImages()` preloads into cache. Cache survives page reload via service worker. |
| Multi-page template page count mismatch | Low | High — wrong page count in outputPlan | `getPages()` must return correct count. Verify by rendering all pages in preview. |
| Coordinate drift if templates are re-supplied | Medium | High — all overlays shift | Document coordinate measurement process. Version template images alongside code. |
| Service worker stale cache | Low | Low — version bump forces refresh | Bump `CACHE_VERSION` with template changes. |
| Draft compatibility | Low | Low — no new fields needed | All required fields already exist. |

### Specific: Long Text Wrapping

The most likely failure mode. Current IA overlay functions (`drawTemplateLineValue`, `overlayFitText`) already handle this with:
- Auto font size reduction (maxSize → minSize)
- `maxLines` limit with ellipsis
- `wrapText()` for multi-line

These should be **directly reusable** for template overlays.

### Specific: Multi-Page Templates

If a template spans multiple pages (e.g., First Consult — page 1: client details + goals, page 2: financial snapshot + notes):
- The `zoomOutputPlan()` already handles multi-page builders (see La Vida EOI with 2 pages)
- Each page entry gets its own `eoiSubIndex`
- The dispatch calls `builder.drawPage(pageDef.eoiSubIndex, ...)`

The same pattern applies: template-group functions become the builder, with `getPages()` returning the correct count.

---

## 9. Verification Checklist

Pre-implementation checklist (satisfied by current codebase):
- [x] Zoom output plan supports multi-page builders
- [x] `drawOutputPage()` dispatch routes by page definition
- [x] Individual PDF building works for zoom groups
- [x] Preview renders zoom pages
- [x] ZIP packaging includes zoom documents
- [x] All 19 zoom fields saved in draft
- [x] Fallback to programmatic render if no template image

Implementation checklist (for when templates arrive):
- [ ] Template JPGs in project root
- [ ] Template JPGs in service worker `APP_SHELL`
- [ ] Image source arrays + caches
- [ ] `ensureZoomFirstConsultImages()`, `ensureZoomClientReviewImages()`
- [ ] Field coordinate definitions
- [ ] `drawZoomFirstConsultTemplate()` / `drawZoomClientReviewTemplate()`
- [ ] Fallback dispatch in existing draw functions
- [ ] Test with short values
- [ ] Test with long values (names, addresses, notes)
- [ ] Test with dual clients
- [ ] Test with all output combinations (EOI, La Vida, IA)
- [ ] Preview works
- [ ] Download PDF works
- [ ] Download Package / ZIP works
- [ ] Share works
- [ ] Offline works (service worker caches templates)
- [ ] Old drafts load correctly

---

## 10. Summary

| Item | Status |
|------|--------|
| Template files exist? | **No** — needs branded PDFs from designer |
| Rendering approach | **A** — Background image + canvas overlays (same as IA/La Vida) |
| Field coverage | **Complete** — all 19 zoom fields + shared fields cover every template need |
| Missing fields | **None** |
| New builder needed? | Yes — two new builders for First Consult and Client Review |
| outputPlan changes | **Minimal** — dispatch already routes by page type |
| ZIP/package changes | **None** — already generic |
| Draft changes | **None** — all fields already saved |
| Settings changes | Future: migrate `zoomDefaults.builders`/`.developers`/`.timeline` to Admin Settings |
| Highest risk | Long text wrapping in fixed template boxes |
| Fallback exists | Yes — current programmatic renderers remain as fallback |
