# Appointment UX Redesign Plan

> Document created 2026-07-08  
> Planning/design pass only — no code changes.

---

## 1. UX Goals

The current Zoom workflow is a long list of cards that feels like a form to fill in. The goal is to make it feel like a **guided consultation** mirroring a real adviser/client meeting.

### Key principles
- **Progressive disclosure** — Each section focuses on one meeting topic
- **Clear progression** — The timeline shows where you are and what comes next
- **Readable at a glance** — Card titles and helper text are concise and action-oriented
- **Whiteboard accessible** — Available throughout for drawing/typing during the conversation
- **Landing screen as branded entry point** — ASG CRM home screen style

---

## 2. Proposed Workflow

The redesigned workflow follows a real meeting structure:

```
  1. Landing          → Staff selection, mode choice, resume or start
  2. Client Details   → Name, contact, address
  3. Discovery        → Client goals, consultation notes
  4. Financial        → Income, mortgage, savings, super, borrowing capacity
  5. Strategy         → Recommended strategy textarea
  6. Professional     → Builder, developer, broker, conveyancer
  7. Property Pathway → Recommended property, timeline, property inspections
  8. Whiteboard       → Draw/type during meeting (toggle-able)
  9. Outputs          → EOI, IA, package preview, attachments
 10. Generate         → Generate PDF, download, share
```

---

## 3. Section/Card Structure (Zoom Mode)

### Card 1: Client Details
- **Current equivalent:** Part of the in-person section 1 (shared fields)
- **Card ID:** `zoomClientDetails`
- **Heading:** "Client Details"
- **Helper text:** "Enter the client's contact information."
- **Fields (existing IDs):** `clientName`, `clientPhone`, `clientEmail`, `clientAddress`
- **Fields (optional second client):** `client2Name`, `client2Phone`, `client2Email`
- **Other fields:** `date`, `teamMember` (moved from header section)

### Card 2: Discovery Conversation
- **Current equivalent:** Client Goals + Consultation Notes
- **Card ID:** `zoomDiscovery`
- **Heading:** "Discovery Conversation"
- **Helper text:** "Understand the client's goals and capture key discussion points."
- **Sub-section: Client Goals** — `firstConsultGoalType` (radio set: Investment, Home, SMSF, Wealth, Retirement, Other)
- **Sub-section: Preferred Suburbs** — `fcPreferredSuburbs` (new, text input, optional)
- **Sub-section: Consultation Notes** — `firstConsultNotes` (textarea)
- **Template selector:** `zoomFirstConsultTemplate` (Brisbane/Perth dropdown)

### Card 3: Financial Position
- **Current equivalent:** Financial Snapshot
- **Card ID:** `zoomFinancial`
- **Heading:** "Financial Position"
- **Helper text:** "Current financial position — enter approximate figures."
- **Fields (existing IDs):** `firstConsultAnnualIncome`, `firstConsultExistingMortgage`, `firstConsultSavings`, `firstConsultSuper`, `firstConsultInvestmentProperties`, `firstConsultBorrowingCapacity`
- **New fields (optional):** `fcMinBudget`, `fcMaxBudget` (currency inputs)

### Card 4: Property Strategy
- **Current equivalent:** Recommended Strategy + Property Pathway
- **Card ID:** `zoomStrategy`
- **Heading:** "Property Strategy"
- **Helper text:** "Document the recommended strategy and property pathway."
- **Fields (existing IDs):** `clientReviewStrategy` (textarea), `clientReviewProperty` (text), `clientReviewTimeline` (select)
- **New fields (optional):** `crInspections` (text input, "Property Inspections")

### Card 5: Professional Team
- **Current equivalent:** Professional Team (unchanged)
- **Card ID:** `crProfessionalTeam` (same)
- **Heading:** "Professional Team"
- **Helper text:** "Select preferred partners for this appointment."
- **Fields (existing IDs):** `clientReviewBuilder`, `clientReviewDeveloper`, `clientReviewBroker`, `clientReviewConveyancer`
- **No new fields**

### Card 6: Next Actions
- **Current equivalent:** Next Actions
- **Card ID:** `crNextActions` (same)
- **Heading:** "Next Actions"
- **Helper text:** "Define the next steps and schedule follow-up appointments."
- **Fields (existing IDs):** `clientReviewNextActions` (textarea)
- **New fields (optional):** `crNextAppointmentDate` (date picker), `crScheduleNotes` (textarea)

### Card 7: Whiteboard
- **New card** (see Section 5 below)
- **Card ID:** `zoomWhiteboard`
- **Heading:** "Whiteboard"
- **Helper text:** "Draw or type notes during the conversation."
- **Toggle-able:** Show/hide

### Card 8: Appointment Outputs
- **Current equivalent:** Outputs + Package Preview + Attachments
- **Card ID:** `zoomOutputsSection` (unchanged)
- **Heading:** "Appointment Outputs"
- **Checkboxes (unchanged):** `zoomIncludeStandardEOI`, `zoomIncludeLaVidaEOI`, `zoomIncludeIA`
- **Package Preview** (inline, existing)
- **Attachments** (inline, existing)

---

## 4. Field Mapping by Section

### Existing Field IDs Reused

| Card | Field IDs | Source |
|---|---|---|
| Client Details | `clientName`, `clientPhone`, `clientEmail`, `clientAddress`, `client2Name`, `client2Phone`, `client2Email`, `date`, `teamMember` | Existing shared fields |
| Discovery | `firstConsultGoalType` (radio), `firstConsultNotes`, `zoomFirstConsultTemplate` | Existing zoom fields |
| Financial | `firstConsultAnnualIncome`, `firstConsultExistingMortgage`, `firstConsultSavings`, `firstConsultSuper`, `firstConsultInvestmentProperties`, `firstConsultBorrowingCapacity` | Existing zoom fields |
| Strategy | `clientReviewStrategy`, `clientReviewProperty`, `clientReviewTimeline` | Existing zoom fields |
| Professional | `clientReviewBuilder`, `clientReviewDeveloper`, `clientReviewBroker`, `clientReviewConveyancer` | Existing zoom fields |
| Next Actions | `clientReviewNextActions` | Existing zoom field |
| Outputs | `zoomIncludeStandardEOI`, `zoomIncludeLaVidaEOI`, `zoomIncludeIA` | Existing zoom fields |

### New Field IDs Needed (from Phase 6A missing-fields table)

| Card | Field ID | Type | Required | Phase |
|---|---|---|---|---|
| Discovery | `fcPreferredSuburbs` | text input | optional | 6D |
| Discovery | `fcAdditionalNotes` | textarea | optional | 6D |
| Financial | `fcMinBudget` | text (currency) | optional | 6D |
| Financial | `fcMaxBudget` | text (currency) | optional | 6D |
| Strategy | `crInspections` | text input | optional | 6D |
| Next Actions | `crNextAppointmentDate` | date picker | optional | 6D |
| Next Actions | `crScheduleNotes` | textarea | optional | 6D |

### Fields Moved Out of Zoom Workflow

The following fields remain in the in-person workflow only and are NOT shown in zoom mode:
- `includeIA`, `iaForm`, `iaAmount`, `iaClientNames`, `iaAddress`, `iaProperty`, `iaSolicitor`, `iaDate`, `iaApplySignature1`, `iaApplySignature2`, `showIaOverrides`
- `includeEOI`, `eoiTemplate`, `showEoiOverrides`, `eoiClient1Name`, `eoiClient1Mobile`, `eoiClient1Email`, `eoiClient1Address`, `eoiClient2Name`, `eoiClient2Mobile`, `eoiClient2Email`, `eoiClient2Address`
- `eoiCommonShares`, `eoiSaleType`, `eoiSaleAddress`, `eoiPriceLand`, `eoiPriceHouse`, `eoiPriceTotal`, `eoiFinancePercent`, `eoiNextAppointment`, `eoiNextApptDate`, `eoiNextApptTime`, `eoiIdAttached`, `eoiBranch`, `eoiDate`, `eoiStaffMember`, `eoiComments`
- `laVidaFinanceBrokerChoice`, `laVidaFinanceBrokerName`, `laVidaFinanceBrokerEmail`, `laVidaFinanceBrokerPhone`, `laVidaConveyancerChoice`, `laVidaConveyancerName`, `laVidaConveyancerEmail`, `laVidaConveyancerPhone`
- `notes`, `includeFullPhotos`, `compressPhotos`, `additionalDocsCount`, `item1`, `item2`, `item3`, `item4`

The `fields` array in `js/app.js` remains unchanged — all field IDs stay in the array for draft compatibility. The zoom-only sections simply don't render these fields.

---

## 5. Whiteboard Design

### 5.1 Purpose
Allow the consultant to open a whiteboard during the meeting to draw or type notes. Whiteboard pages are appended to the compiled PDF and included in the ZIP package.

### 5.2 UI Location
A new card placed between Next Actions and Appointment Outputs:
```html
<section class="card zoom-only" id="zoomWhiteboardSection">
  <h2>Whiteboard</h2>
  <p class="hint">Draw or type notes during the conversation. Whiteboard pages are appended to the compiled PDF.</p>
  <div class="whiteboard-controls">
    <label class="toggle-label">
      <input type="checkbox" id="whiteboardToggle"> Show Whiteboard
    </label>
  </div>
  <div id="whiteboardContainer" class="hidden">
    <div class="whiteboard-toolbar">
      <button class="btn toolbar-btn whiteboard-btn active" data-tool="pen">✏️ Draw</button>
      <button class="btn toolbar-btn whiteboard-btn" data-tool="text">Aa Text</button>
      <button class="btn toolbar-btn whiteboard-btn" data-tool="eraser">🧹 Eraser</button>
      <button class="btn toolbar-btn whiteboard-btn" data-tool="clear">🗑️ Clear</button>
    </div>
    <div class="whiteboard-canvas-wrap">
      <canvas id="whiteboardCanvas" width="800" height="600"></canvas>
    </div>
    <div class="whiteboard-footer">
      <span id="whiteboardPageCounter">Page 1 of 1</span>
      <button class="btn toolbar-btn" id="whiteboardNewPage">+ New Page</button>
      <button class="btn toolbar-btn" id="whiteboardDeletePage">🗑️ Delete Page</button>
    </div>
    <div class="whiteboard-thumbnails" id="whiteboardThumbnails"></div>
  </div>
</section>
```

### 5.3 Controls
| Button | Action |
|---|---|
| ✏️ Draw | Enable freehand pen mode (default) |
| Aa Text | Click on canvas to type text at cursor position |
| 🧹 Eraser | Enable eraser mode (brush erases strokes) |
| 🗑️ Clear | Clear current page canvas |
| + New Page | Add a new blank page, switch to it |
| 🗑️ Delete Page | Remove current page (if more than 1) |
| Show Whiteboard toggle | Show/hide the entire whiteboard section |

### 5.4 Data Model
```javascript
whiteboardPages = [
  {
    strokes: [
      {
        type: 'pen',        // 'pen' | 'eraser'
        points: [{x, y}],   // array of mouse/pointer positions
        color: '#111',
        width: 3
      }
    ],
    textAnnotations: [
      {
        text: 'Notes...',
        x: 100,
        y: 200,
        fontSize: 20,
        color: '#111'
      }
    ]
  }
]
```

### 5.5 Integration
- **PDF/ZIP:** Whiteboard pages are drawn as additional pages after the IA page in the Zoom booklet.
- **Output plan:** `zoomOutputPlan()` adds a new group `'whiteboard'` with `pageCount = whiteboardPages.length`.
- **Draft storage:** `getDraft().whiteboardPages` serializes the array; `setDraft()` restores it.
- **Independent persistence:** `localStorage.setItem('salesAppointmentWhiteboard', JSON.stringify(whiteboardPages))` for recall across sessions.

### 5.6 Whiteboard Page Rendering on PDF
```javascript
function drawWhiteboardPage(pageData, pageNumber, totalPages, scale) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 800 * scale;
  canvas.height = 600 * scale;
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 800, 600);
  // Draw strokes
  for (const stroke of pageData.strokes) {
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < stroke.points.length; i++) {
      if (i === 0) ctx.moveTo(stroke.points[i].x, stroke.points[i].y);
      else ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
  // Draw text annotations
  for (const ann of pageData.textAnnotations) {
    ctx.font = `${ann.fontSize}px Inter, sans-serif`;
    ctx.fillStyle = ann.color;
    ctx.fillText(ann.text, ann.x, ann.y);
  }
  return canvas;
}
```

---

## 6. Appointment Timeline Design

### 6.1 Purpose
A sticky progress indicator showing which sections are complete, which are current, and which are still to-do.

### 6.2 Appearance
A vertical step timeline in the right-hand sidebar (or top of the form on mobile).

**Desktop (sidebar, alongside the grid):**
```
  ✓ Client Details
  ✓ Discovery Conversation
  ● Financial Position    ← current
  ○ Property Strategy
  ○ Professional Team
  ○ Next Actions
  ○ Whiteboard
  ○ Outputs
  ○ Ready to Generate
```

**Mobile (horizontal scrollable strip at the top):**
```
[✓] [✓] [●] [○] [○] [○] [○] [○] [○]
```

### 6.3 States
| State | Icon | Description |
|---|---|---|
| Complete | ✓ (green) | All required fields in this section are filled |
| Current | ● (gold) | This is the next incomplete section |
| Incomplete | ○ (gray) | Not yet visited or filled |
| Not Required | — (dimmed) | Section is optional and skipped |

### 6.4 How It Updates
Each time the user fills a field, `clearGenerated()` is called. The timeline would update when:
- Field values change (via existing `clearGenerated()` path)
- The user navigates between sections (via scroll or click)
- A section's required fields become complete

### 6.5 Implementation
The timeline is a separate DOM element appended to the grid's `<aside>` (preview sidebar) or inserted as a sticky element.

```html
<aside class="timeline-aside">
  <nav class="appointment-timeline" aria-label="Appointment progress">
    <ol>
      <li class="timeline-step complete" data-section="zoomClientDetails">
        <span class="timeline-icon">✓</span>
        <span class="timeline-label">Client Details</span>
      </li>
      <li class="timeline-step current" data-section="zoomDiscovery">
        <span class="timeline-icon">●</span>
        <span class="timeline-label">Discovery Conversation</span>
      </li>
      ...
    </ol>
  </nav>
</aside>
```

A new helper function `updateTimeline()` checks each section's required fields and updates the step states. It is called from `clearGenerated()` alongside the other UI updates.

### 6.6 Completion Rules per Step
| Step | Completion Condition |
|---|---|
| Client Details | `clientName` AND (`clientPhone` OR `clientEmail`) |
| Discovery | `firstConsultGoalType` (any radio checked) |
| Financial | Any one of the 6 financial fields filled |
| Strategy | `clientReviewStrategy` filled |
| Professional | Any one of the 4 professional selects filled |
| Next Actions | `clientReviewNextActions` filled |
| Whiteboard | (always optional — no completion required) |
| Outputs | At least one checkbox checked |
| Ready to Generate | All above steps complete |

---

## 7. Landing Screen Redesign

### 7.1 Current State
- Dark navy hero background
- ASG logo (landing.png, not the ASG logo)
- White card with title, subtitle, version badge
- Staff input (text or select)
- Mode toggle (In-person / Zoom buttons)
- Recent draft card
- Continue button

### 7.2 Target State (ASG CRM Home Screen Style)
- Dark navy branded full-screen background (keep existing gradient)
- Centred ASG logo (`icons/asg-logo.png`, larger, with drop-shadow)
- Compact glass-style dropdown card:
  - Narrower max-width (380px instead of 420px)
  - Less padding (20px instead of 28px)
  - Subtle card title "Start Appointment" (not h1)
- Staff dropdown only (remove mode toggle from landing; determine mode from localStorage)
- Recent draft card (keep existing but position below staff dropdown)
- Clean continue button with fixed label "Start Appointment"

### 7.3 Proposed HTML
```html
<div id="landingScreen" class="landing-screen">
  <div class="landing-bg">
    <img src="icons/asg-logo.png" alt="Amplify Solutions Group" class="landing-logo" draggable="false">
    <div class="landing-panel">
      <div class="landing-panel-header">
        <h2>Start Appointment</h2>
      </div>
      <div class="landing-panel-body">
        <div class="landing-field">
          <label for="landingStaff">Staff Member</label>
          <div id="landingStaffControl">...</div>
        </div>
        <div id="recentDraftCard" class="recent-draft-card hidden">...</div>
        <button id="landingContinue" class="btn primary landing-continue" disabled>
          <span id="continueButtonText">Start Appointment</span>
        </button>
      </div>
    </div>
  </div>
</div>
```

### 7.4 Mode Decision
- **New logic:** On landing page load, check `localStorage.getItem('salesAppointmentLastMode')`.
- If found, use that mode. If not found, default to `'zoom'`.
- The mode is stored whenever the user starts an appointment: `localStorage.setItem('salesAppointmentLastMode', appointmentMode)`.
- When returning to landing, the stored mode persists.
- The mode toggle is removed from the landing page completely but remains accessible via the "Change Type" button in the toolbar header after entering the appointment.

### 7.5 CSS Changes
```css
.landing-logo {
  display: block;
  max-width: 180px;
  width: 100%;
  height: auto;
  margin: 0 auto 28px;
  filter: drop-shadow(0 12px 32px rgba(0,0,0,.4));
}

.landing-panel {
  max-width: 380px;
  border-radius: 16px;
}

.landing-panel-header {
  padding: 20px 20px 0;
}

.landing-panel-header h2 {
  font-size: 20px;
  font-weight: 800;
  color: var(--ink);
  margin: 0 0 4px;
}

.landing-panel-body {
  padding: 16px 20px 20px;
}
```

### 7.6 Existing Elements Preserved
- `#landingScreen` id (JS references)
- `#landingStaff` (staff input)
- `#landingStaffControl` (staff control wrapper)
- `#landingContinue` (continue button)
- `#recentDraftCard` (draft card)
- All draft card internals (`#draftType`, `#resumeDraftBtn`, `#deleteDraftBtn`, etc.)
- `#continueButtonText` span (for dynamic text)

---

## 8. Implementation Phases

### Phase 6C — Rebuild Zoom Workflow UI Structure
**Scope:** `index.html`, `css/app.css` only  
**Summary:** Reorganise the existing zoom cards into the new workflow sections. No new field IDs, no PDF changes, no whiteboard implementation.

### Phase 6D — Add Missing Field Inputs
**Scope:** `index.html`, `css/app.css`, `js/app.js` (fields array only)  
**Summary:** Add the 7 new field IDs from the missing-fields table to the appropriate cards. Append to `fields` array for draft compatibility.

### Phase 6E — Remap First Consult Template Fields
**Scope:** `js/app.js` only  
**Summary:** Audit and fix overlay coordinates for FC pages 1-5. Add new overlay positions using the new field IDs.

### Phase 6F — Remap Client Review Template Fields
**Scope:** `js/app.js` only  
**Summary:** Add overlay positions for CR page 3 using new field IDs.

### Phase 6G — Implement Whiteboard
**Scope:** `index.html`, `css/app.css`, `js/app.js`  
**Summary:** Full whiteboard card, canvas drawing, text annotations, page management, PDF/ZIP integration.

### Phase 6H — Final Polish & Regression
**Scope:** All files  
**Summary:** Landing redesign, timeline implementation, accessibility audit, mobile polish, full smoke test run.

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Moving fields between cards breaks draft restore | Low | High | Field IDs are unchanged; draft data stores by ID, not by card position |
| Removing mode-toggle confuses returning users | Medium | Low | Mode is persisted via localStorage; toolbar "Change Type" button remains |
| Adding whiteboard impacts PDF generation time | Low | Medium | Whiteboard pages are simple canvases; negligible overhead |
| Timeline update adds performance overhead | Low | Low | Run only on `clearGenerated()` (already debounced) |
| New field IDs need `fields` array update | Low | Medium | Single line addition; no existing behavior changes |

---

## 10. Phase 6C Implementation Prompt

### Goal
Rebuild the Zoom workflow UI into the new guided consultation structure without changing any field IDs, PDF generation, template coordinates, outputPlan, or draft compatibility.

### Files Changed
- `index.html`
- `css/app.css`

### What NOT to Change
- `js/app.js` — no changes
- `service-worker.js` — no changes
- `test-smoke/` — no changes
- PDF generation, template coordinates, outputPlan — untouched
- ZIP/share/download logic — untouched
- Draft storage/keys — untouched
- Field IDs — all unchanged

### HTML Changes
1. Move the `date`, `teamMember`, `clientName`, `clientPhone`, `clientEmail`, `clientAddress`, `client2Name`, `client2Phone`, `client2Email` fields out of the in-person-only card and into a **new zoom-only card** `#zoomClientDetails` with heading "Client Details".
2. Merge `#fcClientGoals` (Client Goals) and `#firstConsultSection` (Consultation Notes) into a **new card** `#zoomDiscovery` with heading "Discovery Conversation". Keep the template selector and notes textarea.
3. Rename `#fcFinancial` to `#zoomFinancial` with heading "Financial Position" (or keep existing ID and update heading).
4. Merge `#clientReviewSection` (Recommended Strategy) and `#crPropertyPathway` (Property Pathway) into a **new card** `#zoomStrategy` with heading "Property Strategy".
5. Keep `#crProfessionalTeam` unchanged heading.
6. Rename `#crNextActions` to `#zoomNextActions` with heading "Next Actions" (or keep existing ID and update heading).
7. Add the whiteboard placeholder card `#zoomWhiteboardSection` (hidden by default, to be implemented in Phase 6G).
8. Keep `#zoomOutputsSection`, `#zoomPackagePreview`, and `#zoomAttachmentsSection` in their current form.

### CSS Changes
- Update card spacing for the new layout
- Add `.timeline-aside` placeholder styles (empty shell for Phase 6H)
- Ensure all zoom-only cards maintain `display: block` when `.show-zoom` is active

### Verification
- `node --check js/app.js` — no JS changes, should pass
- `git diff --check` — no trailing whitespace
- `npm run smoke` — must pass 45/45

---

## 11. Appendix: Current vs Proposed Section Mapping

| Current Section | Proposed Section | Fields Moved |
|---|---|---|
| _(shared in-person section 1)_ | Client Details | `clientName`, `clientPhone`, `clientEmail`, `clientAddress`, `client2Name`, `client2Phone`, `client2Email`, `date`, `teamMember` |
| Client Goals | Discovery Conversation | `firstConsultGoalType` (radio) |
| Consultation Notes | Discovery Conversation | `zoomFirstConsultTemplate`, `firstConsultNotes` |
| Financial Snapshot | Financial Position | All 6 financial fields |
| Recommended Strategy | Property Strategy | `clientReviewStrategy` |
| Property Pathway | Property Strategy | `clientReviewProperty`, `clientReviewTimeline` |
| Professional Team | Professional Team _(unchanged)_ | All 4 professional selects |
| Next Actions | Next Actions _(unchanged)_ | `clientReviewNextActions` |
| _(none)_ | Whiteboard _(new)_ | — |
| Appointment Outputs | Appointment Outputs _(unchanged)_ | 3 checkboxes |
| Package Preview | Appointment Outputs _(inline)_ | — |
| Attachments | Appointment Outputs _(inline)_ | — |
