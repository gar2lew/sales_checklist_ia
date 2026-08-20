# Zoom Booklet Field Model Audit + Whiteboard Planning

> Document created 2026-07-08  
> Phase 6A — Planning only. No code changes.

---

## 1. Current Field Model Audit

### 1.1 First Consult (Brisbane / Perth) — 6 pages per city

| Page | Overlays | Current Web Fields | Status |
|---|---|---|---|
| 1 (pageIndex=0) | Client details, goals, financial snapshot, notes | clientName, clientPhone, clientEmail, clientAddress, client2Name, client2Phone, client2Email, date, teamMember, propertySaleAddress, firstConsultGoalType, firstConsultAnnualIncome, firstConsultExistingMortgage, firstConsultSavings, firstConsultSuper, firstConsultInvestmentProperties, firstConsultBorrowingCapacity, firstConsultNotes | ✅ Mapped |
| 2 (pageIndex=1) | Date, staff, continuation notes | date, teamMember, firstConsultNotes | ✅ Mapped |
| 3 (pageIndex=2) | Static template — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |
| 4 (pageIndex=3) | Static template — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |
| 5 (pageIndex=4) | Static template — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |
| 6 (pageIndex=5) | Static template — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |

### 1.2 Client Review / Assessment — 4 pages

| Page | Overlays | Current Web Fields | Status |
|---|---|---|---|
| 1 (pageIndex=0) | Strategy, builder, developer | clientName, date, teamMember, clientReviewStrategy, clientReviewBuilder, clientReviewDeveloper | ✅ Mapped |
| 2 (pageIndex=1) | Broker, conveyancer, timeline, property, next actions | date, teamMember, clientReviewBroker, clientReviewConveyancer, clientReviewTimeline, clientReviewProperty, clientReviewNextActions | ✅ Mapped |
| 3 (pageIndex=2) | Static schedule page — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |
| 4 (pageIndex=3) | Static disclosure page — no overlays | _(none)_ | ❌ Web has no inputs for this page's content |

---

## 2. Missing Fields Table

The following fields exist in the printed template booklets but have **no matching web input** and are therefore blank in the generated PDF.

### First Consult — Pages 3–6 (static template images)

| PDF Page | Template Content | Field Label | Recommended Field ID | Input Type | Required | Suggested Card |
|---|---|---|---|---|---|---|
| FC page 3 | Declarations / disclaimers | Declarations | `fcDeclarations` | textarea | optional | Consultation Notes |
| FC page 3 | Signature / date | Client Signature | `fcClientSignature` | canvas signature pad | optional | Consultation Notes |
| FC page 4 | Property preferences | Preferred Suburbs | `fcPreferredSuburbs` | text input | optional | Client Goals |
| FC page 4 | Property preferences | Min Budget | `fcMinBudget` | text (currency) | optional | Financial Snapshot |
| FC page 4 | Property preferences | Max Budget | `fcMaxBudget` | text (currency) | optional | Financial Snapshot |
| FC page 5 | Additional notes | Additional Notes | `fcAdditionalNotes` | textarea | optional | Consultation Notes |
| FC page 6 | Disclosures / fine print | _(already static)_ | — | — | — | — |

### Client Review — Pages 3–4 (static template images)

| PDF Page | Template Content | Field Label | Recommended Field ID | Input Type | Required | Suggested Card |
|---|---|---|---|---|---|---|
| CR page 3 | Schedule of appointments | Next Appointment Date | `crNextAppointmentDate` | date picker | optional | Next Actions |
| CR page 3 | Schedule of appointments | Appointment Notes | `crScheduleNotes` | textarea | optional | Next Actions |
| CR page 3 | Schedule of appointments | Property Inspections | `crInspections` | text input | optional | Property Pathway |
| CR page 4 | Disclosures / disclaimers | _(already static)_ | — | — | — | — |

### Notes
- FC pages 2–5 have field coordinates in the template images; the overlay code was written but the `pageIndex` values (2–5) are unused. The existing `drawZoomFirstConsultTemplatePage` function at lines 3299–3300 explicitly skips them with a comment "Pages 3-6: static template pages -- no field overlays."
- The same applies to CR pages 3–4 (pageIndex 2 and 3).

---

## 3. Overlay Misalignment Notes

### FC Page 1 (pageIndex=0) — Current overlays appear correct
- White-out regions and overlay positions were measured from `first-consult-{city}-page-1.jpg` at 96 DPI.
- All field positions match the template layout.

### FC Page 2 (pageIndex=1) — Current overlays
- `date`, `teamMember`, and `firstConsultNotes` continuation area are mapped correctly.
- The notes continuation box white-out region (195, 680, 1260, 155) appears correctly aligned.

### CR Page 1 (pageIndex=0) — Current overlays appear correct
- Strategy, builder, developer fields aligned with template.

### CR Page 2 (pageIndex=1) — Current overlays appear correct
- Broker, conveyancer, timeline, property, next actions aligned with template.

### Confirmed Misalignment Issue
The user reported: *"First Consult Page 2 overlays are visibly wrong/misaligned."* This may be a DPI or scaling issue where the template images are rendered at a different resolution than the white-out/overlay coordinates assume. The overlay positions in `drawZoomFirstConsultTemplatePage` use hard-coded pixel values derived from the JPG dimensions. If the PDF booklet is generated at a scale factor (the `scale` parameter passed to these functions), the coordinates might need to be multiplied by the scale factor.

**Current code issue:**
- The white-out regions and overlay positions are in **template-image pixel coordinates** (based on the JPGs in `templates/rendered/`).
- The actual canvas is scaled by the `scale` parameter (`2` or `3`, depending on the `compressPhotos` checkbox).
- The white-out and overlay functions (`whiteOut()` and `mx()`) likely apply their own DPI adjustments, but if they don't account for the `scale` parameter, the overlays will be misaligned at different scale levels.

**Recommendation for Phase 6C:** Audit the `whiteOut()` and `mx()` functions to verify they multiply coordinates by the canvas scale factor.

---

## 4. Whiteboard Feature Specification

### 4.1 Purpose
Allow the consultant to open a whiteboard during the Zoom appointment to draw or type notes. Whiteboard pages are appended to the compiled PDF and included in the ZIP package.

### 4.2 UI
- **Toggle button:** "Whiteboard" in the zoom section toolbar (or a dedicated card)
- **Canvas area:** Full-width drawing surface with toolbar:
  - Draw (pen) — freehand drawing
  - Text — click-to-type text overlay
  - Eraser — partial erase
  - Clear page — clear current canvas
  - New page — add a new whiteboard page
- **Page counter:** "Page 1 of N"
- **Saved pages:** Thumbnail strip or page list below the canvas

### 4.3 Data Model
```javascript
whiteboardPages = [
  {
    strokes: [/* array of stroke objects: {type, points, color, width} */],
    textAnnotations: [/* {text, x, y, fontSize, color} */]
  }
]
```

### 4.4 Integration
- **PDF/ZIP:** Whiteboard pages are drawn as additional pages after the IA page in the Zoom booklet.
- Output plan update: `zoomOutputPlan()` adds a new group `'whiteboard'` with `pageCount = whiteboardPages.length`.
- **Draft storage:** Whiteboard data is serialized into `getDraft().whiteboardPages` and restored in `setDraft()`.
- **Persistence:** Saved in localStorage as part of the draft but also independently as `salesAppointmentWhiteboard` for recall across sessions.

### 4.5 UI Location
Add a new card in the zoom section:
```html
<section class="card zoom-only" id="zoomWhiteboardSection">
  <h2>Whiteboard</h2>
  <div class="whiteboard-toolbar">...</div>
  <canvas id="whiteboardCanvas"></canvas>
  <div class="whiteboard-pages">...</div>
</section>
```

### 4.6 Controls
| Button | Action |
|---|---|
| Draw | Toggle pen mode (default) |
| Text | Click on canvas to type |
| Eraser | Toggle eraser mode |
| Clear | Clear current canvas |
| New Page | Append a new blank page |
| Delete Page | Remove current page |
| Toggle On/Off | Show/hide whiteboard section |

---

## 5. Landing Page Redesign (ASG CRM Home Screen Style)

### 5.1 Goals
- Dark navy hero background (already present)
- Centred ASG logo (larger, more prominent)
- Compact dropdown card (narrower, less padding)
- Staff dropdown only (remove the mode-toggle; always start in zoom mode, or determine mode from previous selection)
- Clean continue button

### 5.2 Proposed HTML Structure
```html
<div id="landingScreen" class="landing-screen">
  <div class="landing-bg">
    <img src="icons/asg-logo.png" alt="ASG Logo" class="landing-logo">
    <div class="landing-panel">
      <div class="landing-panel-header">
        <h2>Start Appointment</h2>
      </div>
      <div class="landing-panel-body">
        <label for="landingStaff">Staff Member</label>
        <div id="landingStaffControl">...</div>
        <button id="landingContinue" class="btn primary">Start Appointment</button>
      </div>
    </div>
  </div>
</div>
```

### 5.3 CSS Changes
- Logo: max-width 180px, centred, with drop-shadow
- Panel: max-width 380px, less padding (20px instead of 28px)
- Remove version badge from landing (keep in header)
- Remove subtitle text — cleaner look
- Remove mode-toggle (default to zoom, or remember last mode)
- Staff dropdown: larger font, more prominent

### 5.4 Mode Toggle Decision
- Option A: Remove entirely — always open in zoom mode (since that's the primary use case)
- Option B: Keep as a subtle dropdown toggle (not the current button group)
- Option C: Remember the last mode from localStorage and default to that

**Recommendation:** Option C — remember last mode via `salesAppointmentLastMode` key, default to `'zoom'`. This maintains backward compatibility while simplifying the landing.

---

## 6. Phased Implementation Plan

### Phase 6B: Add Missing FC/CR Input Fields
**Scope:** `index.html`, `css/app.css` only  
**Changes:**
- Add new input fields for missing template content:
  - `fcPreferredSuburbs` (text input in Client Goals card)
  - `fcMinBudget`, `fcMaxBudget` (currency inputs in Financial Snapshot card)
  - `fcAdditionalNotes` (textarea in Consultation Notes card)
  - `crNextAppointmentDate` (date picker in Next Actions card)
  - `crScheduleNotes` (textarea in Next Actions card)
  - `crInspections` (text input in Property Pathway card)
- Add field IDs to the `fields` array in `js/app.js` (only change to JS)
- Add labels and placeholders
- **No PDF coordinate changes yet**

### Phase 6C: Remap First Consult Template Fields
**Scope:** `js/app.js` only  
**Changes:**
- Audit `whiteOut()` and `mx()` scale handling
- Fix FC page 2 overlay alignment if needed
- Add overlay positions for FC pages 3–5 using the new field IDs
- Adjust coordinate calculations for scale factor
- Test with both DPI modes (compressPhotos on/off)

### Phase 6D: Remap Client Review Template Fields
**Scope:** `js/app.js` only  
**Changes:**
- Add overlay positions for CR page 3 using the new field IDs
- CR page 4 is static (disclosures) — no overlays needed
- Test with both DPI modes

### Phase 6E: Add Whiteboard Feature
**Scope:** `index.html`, `css/app.css`, `js/app.js`  
**Changes:**
- HTML: Whiteboard card with canvas and toolbar
- CSS: Whiteboard canvas, toolbar, page strip styling
- JS: `Whiteboard` class or module with:
  - Stroke recording and replay
  - Text annotation
  - Eraser
  - Page management (add, delete, navigate)
  - Save/load from draft
  - Render to canvas for PDF
- Output plan: Add whiteboard pages to `zoomOutputPlan()`
- ZIP: Include whiteboard PDF in package
- Draft: Add `whiteboardPages` to `getDraft()` and `setDraft()`

### Phase 6F: Landing Page Redesign (ASG CRM Home Screen)
**Scope:** `index.html`, `css/app.css`, `js/app.js`  
**Changes:**
- HTML: Simplify landing page — remove version badge, subtitle, mode-toggle; use ASG logo
- CSS: Compact card, larger logo, centred layout, cleaner button
- JS: Remember last appointment mode in localStorage; default to zoom
- Staff dropdown: Keep existing logic but ensure clean visual

---

## 7. Risk Assessment

| Change | Risk Level | Mitigation |
|---|---|---|
| Adding new fields (6B) | Low | All new fields are optional; existing overlays unaffected |
| Remapping FC overlays (6C) | Medium | Must test at both scale factors (2x and 3x). Coordinate math must be verified against template images |
| Remapping CR overlays (6D) | Medium | Same as 6C |
| Whiteboard feature (6E) | High | New canvas rendering, output plan changes, draft serialization. Must not break existing PDF/ZIP output |
| Landing redesign (6F) | Low | Visual only; existing `enterAppointment()` unchanged |

---

## 8. Template Image Reference

| Template | Source File |
|---|---|
| FC Brisbane page 1 | `templates/rendered/first-consult-brisbane-page-1.jpg` |
| FC Brisbane page 2 | `templates/rendered/first-consult-brisbane-page-2.jpg` |
| FC Brisbane page 3 | `templates/rendered/first-consult-brisbane-page-3.jpg` |
| FC Brisbane page 4 | `templates/rendered/first-consult-brisbane-page-4.jpg` |
| FC Brisbane page 5 | `templates/rendered/first-consult-brisbane-page-5.jpg` |
| FC Brisbane page 6 | `templates/rendered/first-consult-brisbane-page-6.jpg` |
| FC Perth page 1 | `templates/rendered/first-consult-perth-page-1.jpg` |
| FC Perth page 2 | `templates/rendered/first-consult-perth-page-2.jpg` |
| FC Perth page 3 | `templates/rendered/first-consult-perth-page-3.jpg` |
| FC Perth page 4 | `templates/rendered/first-consult-perth-page-4.jpg` |
| FC Perth page 5 | `templates/rendered/first-consult-perth-page-5.jpg` |
| FC Perth page 6 | `templates/rendered/first-consult-perth-page-6.jpg` |
| CR page 1 | `templates/rendered/client-review-page-1.jpg` |
| CR page 2 | `templates/rendered/client-review-page-2.jpg` |
| CR page 3 | `templates/rendered/client-review-page-3.jpg` |
| CR page 4 | `templates/rendered/client-review-page-4.jpg` |
