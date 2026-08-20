# Consultation Whiteboard Workspace Plan

> Document created 2026-07-09  
> Phase 7A — Planning/design pass only. No code changes.

---

## 1. Whiteboard UI Design

### 1.1 Location in Zoom Workflow

The whiteboard card sits between Strategy & Next Actions and Appointment Outputs:

```
Discovery Conversation
Financial Position
Professional Team
Strategy & Next Actions
Whiteboard                ← toggle-able
Appointment Outputs
Package Preview
Attachments
```

### 1.2 Card Structure

```html
<section class="card zoom-only" id="zoomWhiteboardSection">
  <div class="whiteboard-header">
    <h2>Whiteboard</h2>
    <label class="whiteboard-toggle">
      <input type="checkbox" id="whiteboardToggle">
      <span class="toggle-slider"></span>
      <span class="toggle-label">Show Whiteboard</span>
    </label>
  </div>
  <div id="whiteboardContainer" class="hidden">
    <div class="whiteboard-toolbar">
      <button class="wb-btn active" data-tool="pen" title="Draw">✏️</button>
      <button class="wb-btn" data-tool="text" title="Text">Aa</button>
      <button class="wb-btn" data-tool="eraser" title="Eraser">🧹</button>
      <button class="wb-btn" data-tool="undo" title="Undo">↩</button>
      <button class="wb-btn" data-tool="redo" title="Redo">↪</button>
      <button class="wb-btn" data-tool="clear" title="Clear page">🗑️</button>
      <span class="wb-separator"></span>
      <button class="wb-btn" id="wbNewPage" title="New page">+ Page</button>
      <button class="wb-btn" id="wbDeletePage" title="Delete page">− Page</button>
      <span class="wb-page-counter" id="wbPageCounter">1 / 1</span>
      <span class="wb-separator"></span>
      <button class="wb-btn" id="wbTemplate" title="Sketch templates">📐</button>
    </div>
    <div class="whiteboard-canvas-wrap">
      <canvas id="whiteboardCanvas"></canvas>
    </div>
    <div class="whiteboard-footer">
      <div class="whiteboard-thumbnails" id="wbThumbnails"></div>
    </div>
  </div>
</section>
```

### 1.3 Toolbar Controls

| Button | Shortcut | Action |
|---|---|---|
| ✏️ Draw | P | Freehand pen mode (default) |
| Aa Text | T | Click on canvas to place text |
| 🧹 Eraser | E | Eraser brush that removes strokes |
| ↩ Undo | Ctrl+Z | Undo last stroke/text |
| ↪ Redo | Ctrl+Shift+Z | Redo last undone action |
| 🗑️ Clear | — | Clear all strokes on current page (with confirm) |
| + Page | — | Add new blank page, switch to it |
| − Page | — | Delete current page (if >1) |
| 📐 Templates | — | Open sketch template picker |

### 1.4 Toggle Behaviour

- Default state: hidden (collapsed)
- User checks "Show Whiteboard" → the toolbar + canvas appears
- State is not saved in draft (whiteboard pages are saved regardless of toggle state)

---

## 2. Whiteboard Data Model

### 2.1 In-Memory Structure

```javascript
const whiteboardState = {
  pages: [
    {
      strokes: [
        {
          type: 'pen',         // 'pen' | 'eraser'
          points: [{x, y}],    // array of mouse/pointer positions in canvas coords
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
  ],
  currentPage: 0,
  undoStack: [],   // array of {action, data} for undo
  redoStack: []    // array for redo
};
```

### 2.2 Stroke Object

```javascript
{
  type: 'pen',                    // 'pen' | 'eraser'
  points: [                       // array of sampled points
    { x: 45.2, y: 102.1 },
    { x: 46.0, y: 104.3 },
    // ...
  ],
  color: '#1e3a5f',               // hex colour string
  width: 3                        // stroke width in canvas pixels
}
```

### 2.3 Text Annotation Object

```javascript
{
  text: 'Purchase price: $875,000',
  x: 200,
  y: 350,
  fontSize: 18,
  color: '#111',
  fontFamily: 'Inter, sans-serif'
}
```

### 2.4 Page Counter

```javascript
const MAX_WHITEBOARD_PAGES = 20;
```

---

## 3. Canvas & Drawing Implementation

### 3.1 Canvas Setup

```javascript
const wbCanvas = $('whiteboardCanvas');
const wbCtx = wbCanvas.getContext('2d');

function resizeWhiteboard() {
  const wrap = wbCanvas.parentElement;
  wbCanvas.width = wrap.clientWidth * devicePixelRatio;
  wbCanvas.height = Math.min(wrap.clientHeight, 500) * devicePixelRatio;
  wbCanvas.style.width = wrap.clientWidth + 'px';
  wbCanvas.style.height = Math.min(wrap.clientHeight, 500) + 'px';
  wbCtx.scale(devicePixelRatio, devicePixelRatio);
}
```

### 3.2 Drawing Pipeline

```
pointerdown → record start point → beginPath() → moveTo()
pointermove → sample point → lineTo() → stroke() → record point
pointerup → end stroke → push completed stroke object → push undo entry
```

Uses the same pattern as the signature pads (`pointerdown`/`pointermove`/`pointerup` with `setPointerCapture`), but stores vector points instead of raster pixels.

### 3.3 Rendering

Each page is fully redrawn from its stroke data whenever the page changes:

```javascript
function renderWhiteboardPage(pageIndex) {
  const page = whiteboardState.pages[pageIndex];
  if (!page) return;
  wbCtx.clearRect(0, 0, wbCanvas.width, wbCanvas.height);
  // White background
  wbCtx.fillStyle = '#fff';
  wbCtx.fillRect(0, 0, wbCanvas.width, wbCanvas.height);
  // Draw strokes
  for (const stroke of page.strokes) {
    if (stroke.points.length < 2) continue;
    wbCtx.beginPath();
    wbCtx.strokeStyle = stroke.color;
    wbCtx.lineWidth = stroke.width;
    wbCtx.lineCap = 'round';
    wbCtx.lineJoin = 'round';
    wbCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      wbCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    wbCtx.stroke();
  }
  // Draw text annotations
  for (const ann of page.textAnnotations) {
    wbCtx.font = `${ann.fontSize}px ${ann.fontFamily || 'Inter, sans-serif'}`;
    wbCtx.fillStyle = ann.color;
    wbCtx.textBaseline = 'top';
    wbCtx.fillText(ann.text, ann.x, ann.y);
  }
}
```

### 3.4 Undo / Redo

```javascript
// On stroke complete:
whiteboardState.undoStack.push({ type: 'stroke', strokeIndex: page.strokes.length - 1 });
whiteboardState.redoStack = [];

function undo() {
  const entry = whiteboardState.undoStack.pop();
  if (!entry) return;
  if (entry.type === 'stroke') {
    const page = whiteboardState.pages[whiteboardState.currentPage];
    const removed = page.strokes.splice(entry.strokeIndex, 1);
    whiteboardState.redoStack.push({ type: 'stroke', stroke: removed[0], index: entry.strokeIndex });
  }
  renderWhiteboardPage(whiteboardState.currentPage);
}

function redo() {
  // reverse of undo — re-insert the stroke at its original index
}
```

### 3.5 Eraser

The eraser records strokes with `type: 'eraser'`. During rendering, eraser strokes are not drawn. Instead, they are used to clip or remove sections of other strokes.

Simpler approach: the eraser draws white strokes (same width as pen), which visually erases content. When the whiteboard page is rendered to the PDF, the white strokes are rendered as-is, effectively masking the underlying content.

Alternatively, use compositing: `globalCompositeOperation = 'destination-out'` for eraser strokes.

**Recommendation (simple):** Use white strokes for eraser. This works for both on-screen display and PDF output.

---

## 4. Save Pages + Draft Persistence

### 4.1 Saving to Draft

In `getDraft()`:
```javascript
data.whiteboardPages = whiteboardState.pages.map(page => ({
  strokes: page.strokes.map(s => ({
    type: s.type,
    points: s.points,
    color: s.color,
    width: s.width
  })),
  textAnnotations: page.textAnnotations.map(a => ({
    text: a.text,
    x: a.x,
    y: a.y,
    fontSize: a.fontSize,
    color: a.color
  }))
}));
```

### 4.2 Restoring from Draft

In `setDraft()`:
```javascript
if (Array.isArray(data.whiteboardPages) && data.whiteboardPages.length > 0) {
  whiteboardState.pages = data.whiteboardPages;
  whiteboardState.currentPage = 0;
  renderWhiteboardPage(0);
}
```

### 4.3 Independent Persistence

Optionally, save to a separate localStorage key for recall across sessions:
```javascript
localStorage.setItem('salesAppointmentWhiteboard', JSON.stringify(whiteboardState.pages));
```

### 4.4 localStorage Size Risk

A single whiteboard page with moderate drawing is approximately **10-50 KB** as JSON (vector points). With the 5 MB localStorage limit, up to ~100 pages can be stored before hitting limits. The cap of 20 pages provides a large safety margin.

---

## 5. Text Mode

When the user clicks the canvas in text mode:
1. A prompt appears or a text input is placed at the click position.
2. The user types the text and presses Enter or clicks elsewhere.
3. A `textAnnotation` is created with the entered text, position, and default font settings.
4. The annotation is added to `whiteboardState.pages[currentPage].textAnnotations`.

```javascript
wbCanvas.addEventListener('pointerdown', (e) => {
  if (currentTool !== 'text') return;
  const rect = wbCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Show a floating input at (x, y)
  showTextInput(x, y, (text) => {
    const page = whiteboardState.pages[whiteboardState.currentPage];
    page.textAnnotations.push({ text, x, y, fontSize: 18, color: '#111' });
    renderWhiteboardPage(whiteboardState.currentPage);
  });
});
```

---

## 6. PDF/ZIP Integration

### 6.1 Whiteboard Page Rendering for PDF

```javascript
function drawWhiteboardPage(pageData, pageNumber, totalPages, scale) {
  const W = 595, H = 842;
  const c = document.createElement('canvas');
  c.width = Math.round(W * scale);
  c.height = Math.round(H * scale);
  const ctx = c.getContext('2d');
  ctx.scale(scale, scale);
  // White background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  // Draw strokes
  for (const stroke of pageData.strokes) {
    if (stroke.points.length < 2) continue;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }
  // Draw text annotations
  for (const ann of pageData.textAnnotations) {
    ctx.font = `${ann.fontSize}px ${ann.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = ann.color;
    ctx.textBaseline = 'top';
    ctx.fillText(ann.text, ann.x, ann.y);
  }
  // Draw footer
  drawGeneratedFooter(ctx, pageNumber, totalPages, 'Whiteboard', 42, 817);
  return c;
}
```

### 6.2 Output Plan Update

In `zoomOutputPlan()`, after the IA group:
```javascript
/* Whiteboard pages */
if (whiteboardState.pages.length > 0) {
  for (let w = 0; w < whiteboardState.pages.length; w++) {
    pages.push({ id: 'whiteboard', pageIndex: w });
  }
  groups.push({
    id: 'whiteboard',
    pageOffset: offset,
    pageCount: whiteboardState.pages.length,
    getFilename: function() { return 'Whiteboard - ' + clientNamesForFilename() + ' - ' + teamMember + ' - ' + date + '.pdf'; }
  });
  offset += whiteboardState.pages.length;
}
```

### 6.3 Page Drawing Dispatch

In `drawOutputPage()` (the dispatcher), add a case for `'whiteboard'`:
```javascript
pages.push({
  id: page.id,
  pageIndex: page.pageIndex,
  draw: () => drawWhiteboardPage(whiteboardState.pages[page.pageIndex], pageNumber, totalPages, scale)
});
```

Alternatively, integrate into the existing `drawOutputPage()` switch statement.

### 6.4 ZIP Integration

Whiteboard PDFs are already included in the ZIP via the group system:
- `buildIndividualPdfs()` iterates over all groups including `'whiteboard'`
- Each whiteboard page group generates its own PDF with a distinct filename
- The ZIP package will include these PDFs alongside EOI, IA, etc.

### 6.5 Compiled PDF Integration

Whiteboard pages are appended after the IA page in the compiled Zoom booklet:
- The `zoomOutputPlan()` places them last in the `pages` array
- `drawOutputPage()` dispatches to `drawWhiteboardPage()` based on the page `id`
- The cover-to-IA pages remain unchanged

---

## 7. Sketch Templates

### 7.1 Template Definitions

```javascript
const whiteboardTemplates = {
  borrowing: {
    name: 'Borrowing Capacity',
    overlay: function(ctx, w, h) {
      // Draw borrowing calculation grid
      ctx.strokeRect(50, 50, w-100, h-100);
      ctx.fillText('Income:', 60, 80);
      ctx.fillText('Expenses:', 60, 120);
      ctx.fillText('Borrowing Capacity:', 60, 160);
    }
  },
  cashflow: {
    name: 'Cashflow',
    overlay: function(ctx, w, h) {
      // Draw income/expense table
    }
  },
  smsf: {
    name: 'SMSF Structure',
    overlay: function(ctx, w, h) {
      // Draw SMSF entity diagram placeholder
    }
  },
  trust: {
    name: 'Trust Structure',
    overlay: function(ctx, w, h) {
      // Draw trust diagram placeholder
    }
  },
  propertyJourney: {
    name: 'Property Journey',
    overlay: function(ctx, w, h) {
      // Draw property timeline steps
    }
  },
  blank: {
    name: 'Custom Blank Page',
    overlay: null  // No overlay — just a blank canvas
  }
};
```

### 7.2 Template Picker UI

A modal or dropdown triggered by the 📐 button:

```html
<div id="wbTemplatePicker" class="hidden">
  <div class="template-picker-header">Sketch Templates</div>
  <div class="template-picker-grid">
    <button class="template-option" data-template="borrowing">💰 Borrowing Capacity</button>
    <button class="template-option" data-template="cashflow">📊 Cashflow</button>
    <button class="template-option" data-template="smsf">🏛️ SMSF Structure</button>
    <button class="template-option" data-template="trust">📜 Trust Structure</button>
    <button class="template-option" data-template="propertyJourney">🏡 Property Journey</button>
    <button class="template-option" data-template="blank">📄 Custom Blank Page</button>
  </div>
</div>
```

### 7.3 Applying a Template

When a template is selected:
1. A new page is created (or the current page is used if blank).
2. The template's `overlay` function is called with the canvas context.
3. The overlay is baked into the background — it is NOT part of the stroke data (it's a background image).
4. The user can then draw on top of the template.

```javascript
function applyTemplate(pageIndex, templateKey) {
  const page = whiteboardState.pages[pageIndex];
  if (!page) return;
  page.template = templateKey;
  renderWhiteboardPage(pageIndex);
}
```

When rendering, if a page has a template, draw the template overlay first, then draw strokes on top.

---

## 8. Mobile and iPad Behaviour

### 8.1 Touch Drawing

The canvas uses `pointerdown` / `pointermove` / `pointerup` events, which work for both mouse and touch. This is the same pattern used by the existing signature pads.

```css
#whiteboardCanvas {
  touch-action: none;   /* Prevent scroll/zoom while drawing */
}
```

### 8.2 Canvas Sizing

On mobile, the canvas should be responsive:
- Use CSS width 100% of parent
- Height: fixed at 300px on mobile, 500px on desktop
- Pointer coordinates are scaled from CSS pixels to canvas pixels

```css
.whiteboard-canvas-wrap {
  width: 100%;
  min-height: 300px;
  max-height: 500px;
  position: relative;
}
#whiteboardCanvas {
  width: 100%;
  height: 100%;
  touch-action: none;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
}
```

### 8.3 Apple Pencil / Stylus

- Pointer events natively support `pointerType === 'pen'` for stylus input.
- Future enhancement: use `e.pressure` to vary line width.
- The existing signature pads already handle stylus via the same pointer events.

### 8.4 Toolbar on Mobile

The toolbar wraps to two rows on narrow screens:

```css
@media (max-width: 600px) {
  .whiteboard-toolbar {
    flex-wrap: wrap;
    gap: 4px;
  }
  .wb-btn {
    padding: 8px 10px;
    font-size: 13px;
  }
  .whiteboard-canvas-wrap {
    min-height: 220px;
  }
}
```

---

## 9. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **localStorage size** — whiteboard pages with many strokes could exceed 5 MB limit | Low | Medium | Cap at 20 pages; vector data is compact (~10-50 KB/page) |
| **Canvas image size** — high-DPI canvas exported to PDF could be slow | Low | Medium | Use `devicePixelRatio` only for on-screen rendering; PDF uses fixed 595×842 at scale 2 or 3 (same as other pages) |
| **Touch drawing** — touch scrolling conflicts with drawing | Low | High | Use `touch-action: none` on canvas; same pattern as signature pads |
| **Apple Pencil / stylus** — pressure not used | Low | Low | Future enhancement; basic pointer events handle pen input |
| **Undo/redo complexity** — large stroke arrays consume memory | Low | Low | Cap undo stack at 50 entries; each entry is a lightweight reference |
| **PDF quality** — re-rendering strokes at PDF resolution | Low | Low | Same rendering code used for screen and PDF; scale parameter handles quality |
| **Whiteboard toggle state** — user hides whiteboard, loses work | Medium | Low | Toggle is cosmetic only; pages are always persisted in state and draft |
| **Draft compatibility** — old drafts without whiteboardPages | None | None | `Array.isArray(data.whiteboardPages)` check handles missing data |
| **Output plan change** — existing tests must pass | Medium | High | Whiteboard pages are conditional (0 pages when empty); existing page counts unchanged |
| **ZIP filenames** — whiteboard filenames must be unique | Low | Low | Use existing deduplication in `buildZip()` |

---

## 10. Phased Implementation Plan

### Phase 7B: Basic Whiteboard UI Only
- Add toggle show/hide to the whiteboard placeholder card
- Add toolbar with Draw, Text, Eraser buttons (non-functional)
- Add canvas element with responsive sizing
- **No drawing logic yet**
- **Files:** `index.html`, `css/app.css`

### Phase 7C: Drawing + Text Tools
- Implement pen drawing (pointer events, stroke recording)
- Implement text tool (click-to-type text annotations)
- Implement eraser (white strokes or destination-out compositing)
- Implement undo/redo (stroke-level)
- Implement clear page
- Implement new page / delete page
- Implement page counter
- **Files:** `js/app.js`

### Phase 7D: Save Pages + Draft Persistence
- Add whiteboard page data to `getDraft()` and `setDraft()`
- Update `saveDraft()` flow to include whiteboard pages
- Update `loadDraft()` flow to restore whiteboard pages
- Add thumbnail strip for page navigation
- **Files:** `js/app.js`, `css/app.css`

### Phase 7E: PDF/ZIP Integration
- Add `drawWhiteboardPage()` function
- Add whiteboard group to `zoomOutputPlan()`
- Add whiteboard page dispatch to `drawOutputPage()`
- Add whiteboard filename function
- Ensure ZIP includes whiteboard PDFs
- Smoke test update: verify whiteboard pages in output plan
- **Files:** `js/app.js`

### Phase 7F: Sketch Templates
- Implement template overlay definitions (borrowing, cashflow, SMSF, trust, property journey, blank)
- Add template picker UI
- Apply template as page background when selected
- Render template background to PDF
- **Files:** `index.html`, `css/app.css`, `js/app.js`

---

## 11. Appendix: Existing Code Patterns to Reuse

| Pattern | Source | How to Reuse |
|---|---|---|
| Pointer drawing | Signature pad (lines 2136-2162) | Same pattern for pen strokes |
| Canvas coordinate transform | `pos()` function (line 2138) | Same `getBoundingClientRect` scaling |
| Async image loading | `loadImage()` (line 2035) | For restoring whiteboard page images (if used) |
| Draft array serialization | `photos` pattern in `getDraft()` | Same `.map()` approach for whiteboard pages |
| Draft array restoration | `photos` pattern in `setDraft()` | Same `Array.isArray()` check |
| Output plan groups | `zoomOutputPlan()` | Add new group with `id: 'whiteboard'` |
| PDF page rendering | `drawOutputPage()` | Add `'whiteboard'` case |
| ZIP file deduplication | `uniqueName()` in `buildZip()` | Whiteboard filenames handled automatically |
| Footer generation | `drawGeneratedFooter()` | Reuse with context `'Whiteboard'` |
| Touch action prevention | `touch-action: none` on signature canvas | Apply same to whiteboard canvas |
