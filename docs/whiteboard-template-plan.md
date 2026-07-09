# Whiteboard Sketch Templates — Implementation Plan

> Document created 2026-07-09  
> Planning only — no code changes.

---

## 1. Goal

Provide quick-start sketch templates that staff can open on the whiteboard during consultations. Templates are background guides — the user draws or types over them. They are not editable strokes.

---

## 2. Template Definitions

### 2.1 Template Registry

```javascript
const WHITEBOARD_TEMPLATES = {
  borrowing: {
    name: 'Borrowing Capacity',
    icon: '💰',
    description: 'Calculate borrowing capacity with income and expense fields',
    draw: function(ctx, w, h) { /* draws borrowing grid */ }
  },
  cashflow: {
    name: 'Cashflow',
    icon: '📊',
    description: 'Map income and expenses over time',
    draw: function(ctx, w, h) { /* draws income/expense table */ }
  },
  smsf: {
    name: 'SMSF Structure',
    icon: '🏛️',
    description: 'SMSF entity structure diagram',
    draw: function(ctx, w, h) { /* draws SMSF trust diagram */ }
  },
  trust: {
    name: 'Trust Structure',
    icon: '📜',
    description: 'Trust entity structure diagram',
    draw: function(ctx, w, h) { /* draws trust diagram */ }
  },
  propertyJourney: {
    name: 'Property Journey',
    icon: '🏡',
    description: 'Timeline of the property purchase journey',
    draw: function(ctx, w, h) { /* draws timeline steps */ }
  },
  blank: {
    name: 'Custom Blank Page',
    icon: '📄',
    description: 'Start with a clean whiteboard page',
    draw: null
  }
};
```

### 2.2 Template Storage

Each template's `draw` function is a synchronous canvas draw. Templates are NOT images — they are drawn programmatically with Canvas 2D API calls. This keeps file size zero and ensures crisp rendering at any scale.

---

## 3. Template Picker UI

### 3.1 Trigger

The 📐 Templates button in the whiteboard toolbar (currently disabled) opens a template picker modal/dropdown.

```html
<button class="wb-tool-btn" id="wbTemplateBtn" aria-label="Sketch templates" title="Open sketch templates">
  <span class="wb-tool-icon">📐</span>
  <span class="wb-tool-label">Templates</span>
</button>
```

### 3.2 Picker Modal

A floating card positioned below the toolbar:

```html
<div id="wbTemplatePicker" class="wb-picker" role="dialog" aria-label="Choose a sketch template" hidden>
  <div class="wb-picker-header">
    <span>Sketch Templates</span>
    <button class="wb-picker-close" id="wbPickerClose" aria-label="Close template picker">✕</button>
  </div>
  <div class="wb-picker-grid">
    <button class="wb-template-option" data-template="borrowing">
      <span class="wb-template-icon">💰</span>
      <span class="wb-template-name">Borrowing Capacity</span>
      <span class="wb-template-desc">Calculate borrowing capacity with income and expense fields</span>
    </button>
    <button class="wb-template-option" data-template="cashflow">
      <span class="wb-template-icon">📊</span>
      <span class="wb-template-name">Cashflow</span>
      <span class="wb-template-desc">Map income and expenses over time</span>
    </button>
    <button class="wb-template-option" data-template="smsf">
      <span class="wb-template-icon">🏛️</span>
      <span class="wb-template-name">SMSF Structure</span>
      <span class="wb-template-desc">SMSF entity structure diagram</span>
    </button>
    <button class="wb-template-option" data-template="trust">
      <span class="wb-template-icon">📜</span>
      <span class="wb-template-name">Trust Structure</span>
      <span class="wb-template-desc">Trust entity structure diagram</span>
    </button>
    <button class="wb-template-option" data-template="propertyJourney">
      <span class="wb-template-icon">🏡</span>
      <span class="wb-template-name">Property Journey</span>
      <span class="wb-template-desc">Timeline of the property purchase journey</span>
    </button>
    <button class="wb-template-option" data-template="blank">
      <span class="wb-template-icon">📄</span>
      <span class="wb-template-name">Custom Blank Page</span>
      <span class="wb-template-desc">Start with a clean whiteboard page</span>
    </button>
  </div>
</div>
```

### 3.3 Behaviour

1. User clicks 📐 Templates button → picker opens below toolbar.
2. User clicks a template option → picker closes → new whiteboard page is created with the template as background.
3. User can continue drawing over the template.
4. Clicking outside the picker or pressing Escape closes it without selecting.

### 3.4 Picker CSS

```css
.wb-picker {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,.12);
  padding: 12px;
  min-width: 280px;
}
.wb-picker[hidden] { display: none; }
.wb-picker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 800;
  color: var(--navy);
  margin-bottom: 10px;
}
.wb-picker-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  color: var(--muted);
  padding: 4px;
}
.wb-picker-grid {
  display: grid;
  gap: 6px;
}
.wb-template-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--soft);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background .15s;
}
.wb-template-option:hover {
  background: #eef1f6;
  border-color: var(--gold);
}
.wb-template-icon { font-size: 20px; flex-shrink: 0; }
.wb-template-name { font-weight: 700; font-size: 13px; color: var(--ink); }
.wb-template-desc { font-size: 11px; color: var(--muted); grid-column: 1 / -1; }
```

---

## 4. How Each Template Is Drawn

### 4.1 Coordinate System

All templates draw on an A4-proportioned virtual canvas: 595 × 842 points (A4 at 72 DPI). The `draw(ctx, w, h)` function receives the canvas context and the actual pixel dimensions.

### 4.2 Borrowing Capacity

**Purpose:** Quick borrowing calculator visual.

```
┌──────────────────────────────────────────────────────┐
│  BORROWING CAPACITY                                   │
│                                                        │
│  Annual Income:  ______________  $                    │
│  Existing Mortgage:  ______________  $                │
│  Savings:  ______________  $                          │
│  Super Balance:  ______________  $                    │
│                                                        │
│  Estimated Borrowing Range:  $XXX – $XXX              │
└──────────────────────────────────────────────────────┘
```

Drawing code:
```javascript
function drawBorrowing(ctx, w, h) {
  var cx = w / 2;
  ctx.strokeStyle = '#d0d5dd';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  // Title
  ctx.font = '700 18px Inter, Arial, sans-serif';
  ctx.fillStyle = '#1e3a5f';
  ctx.textAlign = 'center';
  ctx.fillText('Borrowing Capacity', cx, 40);
  // Rows
  var rows = ['Annual Income', 'Existing Mortgage', 'Savings', 'Super Balance'];
  var y = 90;
  for (var i = 0; i < rows.length; i++) {
    ctx.font = '400 13px Inter, Arial, sans-serif';
    ctx.fillStyle = '#172033';
    ctx.textAlign = 'left';
    ctx.fillText(rows[i] + ':', 60, y);
    ctx.strokeRect(200, y - 14, 200, 28);  // input box
    ctx.fillText('$', 410, y);
    y += 50;
  }
  // Estimate box
  ctx.font = '700 14px Inter, Arial, sans-serif';
  ctx.fillStyle = '#1e3a5f';
  ctx.fillText('Estimated Borrowing Range:  $________  –  $________', cx, y + 20);
  ctx.setLineDash([]);
}
```

### 4.3 Cashflow

**Purpose:** Map income sources against expenses.

```
┌──────────────────────────────────────────────────────┐
│  CASHFLOW                                             │
│                                                        │
│  ┌──────────────┬──────────────┬──────────────┐       │
│  │ Income       │ Amount       │ Frequency    │       │
│  ├──────────────┼──────────────┼──────────────┤       │
│  │ Employment   │  _______     │  Monthly     │       │
│  │ Investment   │  _______     │  Quarterly   │       │
│  │ Other        │  _______     │  Annually    │       │
│  └──────────────┴──────────────┴──────────────┘       │
│                                                        │
│  ┌──────────────┬──────────────┬──────────────┐       │
│  │ Expense      │ Amount       │ Frequency    │       │
│  ├──────────────┼──────────────┼──────────────┤       │
│  │ Mortgage     │  _______     │  Monthly     │       │
│  │ Living       │  _______     │  Monthly     │       │
│  │ Other        │  _______     │  Monthly     │       │
│  └──────────────┴──────────────┴──────────────┘       │
│                                                        │
│  Net Position:  $________  per month                   │
└──────────────────────────────────────────────────────┘
```

### 4.4 SMSF Structure

**Purpose:** Diagram of SMSF entity structure with trustee, members, and assets.

```
┌──────────────────────────────────────────────────────┐
│  SMSF STRUCTURE                                       │
│                                                        │
│         ┌──────────────┐                               │
│         │   Members    │                               │
│         │  (Trustees)  │                               │
│         └──────┬───────┘                               │
│                │                                       │
│         ┌──────▼───────┐                               │
│         │  SMSF Fund   │                               │
│         └──────┬───────┘                               │
│         ┌──────┼───────────────────┐                   │
│         ▼      ▼                   ▼                   │
│  ┌────────┐ ┌────────┐ ┌────────────────┐             │
│  │ Cash   │ │Shares  │ │ Property       │             │
│  │        │ │        │ │ (Direct/Indirect)│            │
│  └────────┘ └────────┘ └────────────────┘             │
│                                                        │
│  Notes:                                                │
│  ___________________________________                   │
└──────────────────────────────────────────────────────┘
```

### 4.5 Trust Structure

**Purpose:** Diagram of trust entity with settlor, trustee, beneficiaries, and assets.

```
┌──────────────────────────────────────────────────────┐
│  TRUST STRUCTURE                                      │
│                                                        │
│   ┌──────────┐    ┌──────────┐                         │
│   │ Settlor  │───▶│ Trustee  │───▶  Beneficiaries     │
│   └──────────┘    └────┬─────┘                         │
│                        │                               │
│                 ┌──────▼──────┐                        │
│                 │  Trust Fund │                        │
│                 └──────┬──────┘                        │
│             ┌──────────┼──────────┐                    │
│             ▼          ▼          ▼                    │
│        ┌────────┐ ┌────────┐ ┌────────┐               │
│        │ Cash   │ │Shares  │ │Property│               │
│        └────────┘ └────────┘ └────────┘               │
│                                                        │
│  Notes:                                                │
│  ___________________________________                   │
└──────────────────────────────────────────────────────┘
```

### 4.6 Property Journey

**Purpose:** Visual timeline of the property purchase process.

```
┌──────────────────────────────────────────────────────┐
│  PROPERTY JOURNEY                                     │
│                                                        │
│  ①───→②───→③───→④───→⑤───→⑥───→⑦                    │
│  │    │    │    │    │    │    │                       │
│  │    │    │    │    │    │    │                       │
│  ▼    ▼    ▼    ▼    ▼    ▼    ▼                       │
│  Search  │  Inspect │  Offer  │  Finance  │  Exchange  │
│  │       │  │       │  │      │  │        │  │         │
│  ▼       │  ▼       │  ▼      │  ▼        │  ▼         │
│  Identify  │  Viewings │  Negotiate  │  Approve  │  Settle│
│                                                        │
│  Current Stage:  ______                                │
│  Expected Settlement:  ______                          │
└──────────────────────────────────────────────────────┘
```

### 4.7 Blank

No background drawing. Creates a clean whiteboard page with no template overlay.

---

## 5. Template Rendering Pipeline

### 5.1 Page Data Extension

When a template is applied, the whiteboard page stores the template key:

```javascript
// Existing whiteboard page object:
{
  strokes: [...],
  textAnnotations: [...],
  template: 'borrowing'   // null or undefined = no template
}
```

### 5.2 Rendering Order

In `wbRenderPage()`:

```javascript
function wbRenderPage() {
  var idx = wbCurrentPage;
  var page = wbPages[idx];
  if (!page) return;
  
  // 1. Clear canvas
  wbCtx.clearRect(0, 0, ...);
  
  // 2. Draw template background if set
  if (page.template && WHITEBOARD_TEMPLATES[page.template]) {
    WHITEBOARD_TEMPLATES[page.template].draw(wbCtx, wbCanvas.width / 2, wbCanvas.height / 2);
  }
  
  // 3. Draw strokes (user drawings on top)
  for (var s = 0; s < page.strokes.length; s++) { ... }
  
  // 4. Draw text annotations
  for (var a = 0; a < page.textAnnotations.length; a++) { ... }
}
```

**Templates are ALWAYS drawn beneath user strokes.** This makes templates a background guide, not editable artwork. If the user wants to remove the template, they can clear the page or switch templates.

---

## 6. PDF/ZIP Behaviour

### 6.1 PDF Rendering

The `drawWhiteboardPage()` function renders the template background, then the strokes, then text annotations — exactly like the on-screen canvas:

```javascript
function drawWhiteboardPage(pageIdx, pageNumber, totalPages, scale, loadedImg) {
  // ... existing canvas setup ...
  
  // Draw template background if set
  var pageData = wbPages[pageIdx]; // or from draft data
  if (pageData && pageData.template && WHITEBOARD_TEMPLATES[pageData.template]) {
    WHITEBOARD_TEMPLATES[pageData.template].draw(ctx, W, H);
  }
  
  // Draw loaded image (existing saved page content)
  if (loadedImg) { ... }
  
  // ... existing title, footer ...
}
```

**Note:** If a page has both a template AND saved strokes (from saving while using a template), the template is drawn first, then the loaded PNG of the strokes on top. This preserves the "template as background" model.

### 6.2 ZIP Behaviour

Each saved whiteboard page generates an individual PDF with the template rendered as background. No change needed — `buildIndividualPdfs()` already renders each whiteboard page via `drawOutputPage()` → `drawWhiteboardPage()`.

---

## 7. Draft Behaviour

### 7.1 Storage

The template key is stored in the whiteboard page data:

```javascript
// In getDraft():
data.whiteboardPages = wbPages.map(function(p){
  return {
    strokes: p.strokes,
    dataURL: null,
    template: p.template || null   // <-- new field
  };
});
```

### 7.2 Restoration

In `setDraft()`, the template key is restored alongside strokes:

```javascript
wbPages = data.whiteboardPages.map(function(p){
  return {
    strokes: p.strokes || [],
    dataURL: null,
    template: p.template || null   // <-- new field
  };
});
```

### 7.3 Backward Compatibility

Old drafts without a `template` property are handled by the fallback `|| null`. Pages without a template render as plain white — unchanged from current behaviour.

---

## 8. Mobile/iPad Behaviour

| Aspect | Behaviour |
|---|---|
| **Picker on mobile** | Full-width dropdown, scrollable if needed. Template buttons maintain 44px min-height for touch. |
| **Drawing over templates** | Unchanged from current whiteboard drawing — pointer events work on top of template |
| **Canvas dimensions** | Template adapts to current canvas size via `w, h` parameters |
| **PDF output** | Template renders at PDF scale (scale=2 or 3) — same as strokes |
| **Performance** | Templates are lightweight Canvas 2D calls — no image loads, no performance impact |

```css
@media (max-width: 480px) {
  .wb-picker {
    left: 0;
    right: 0;
    min-width: auto;
  }
  .wb-template-option {
    min-height: 44px;
  }
}
```

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Template draw function fails | Low | Medium | Wrap each draw in try/catch; fall back to blank page on error |
| Template looks wrong at different canvas sizes | Medium | Low | Test at both screen and PDF scale. Templates use proportional coordinates (A4 ratio) |
| User clears page → template is lost | Low | Low | Clearing only removes strokes, not the template. User can re-select template if needed |
| Multiple templates per page | Low | Low | Each page has at most one template. Switching templates replaces the background |
| Draft compatibility — old drafts without template field | None | None | `p.template || null` handles missing field gracefully |

---

## 10. Implementation Order

| Step | Description | Files | Risk |
|---|---|---|---|
| 1 | Add template definitions (`WHITEBOARD_TEMPLATES` registry with 6 draw functions) | `js/app.js` | Low |
| 2 | Add template picker HTML + CSS | `index.html`, `css/app.css` | Low |
| 3 | Wire 📐 button to toggle picker | `js/app.js` | Low |
| 4 | Apply template on selection: set `page.template`, close picker, re-render | `js/app.js` | Low |
| 5 | Update `wbRenderPage()` to draw template before strokes | `js/app.js` | Low |
| 6 | Update `drawWhiteboardPage()` for PDF to draw template | `js/app.js` | Low |
| 7 | Add `template` field to `getDraft()` and `setDraft()` | `js/app.js` | Low |
| 8 | Run smoke tests (must pass 45/45) | — | — |
| 9 | Commit and push | — | — |

---

## 11. Summary

| Aspect | Decision |
|---|---|
| Template nature | Background guide drawn with Canvas 2D calls — NOT images, NOT editable strokes |
| Storage | `page.template` key in whiteboard page object |
| Rendering order | Template → strokes → text annotations (template always behind user content) |
| Picker UI | Floating card below toolbar with 6 options, close on Escape/click-outside |
| PDF/ZIP | Template renders as background in both compiled booklet and individual PDFs |
| Draft | Template key serialized in `whiteboardPages[]`, old drafts handled gracefully |
| Mobile | Full-width picker, 44px touch targets |
| Risk | Low — all changes scoped to whiteboard module; existing behaviour unchanged |
