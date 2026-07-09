# Collapsible Appointment Sections — Implementation Plan

> Document created 2026-07-09  
> Planning only — no code changes.

---

## 1. Goal

Reduce vertical scrolling during appointments by allowing completed cards to collapse into a compact header. Staff can expand any section to review or edit, then collapse it when done.

---

## 2. Which Sections Can Collapse

### 2.1 Zoom Mode

| Section | ID | Collapsible? | Completion Rule |
|---|---|---|---|
| Discovery Conversation | `#firstConsultSection` | ✅ Yes | Any field in this card has a value |
| Financial Position | `#fcFinancial` | ✅ Yes | Any one of the 8 financial fields filled |
| Professional Team | `#crProfessionalTeam` | ✅ Yes | Any one of the 4 selects has a value |
| Strategy & Next Actions | `#crNextActions` | ✅ Yes | Any one field has a value |
| Consultation Workspace | `#zoomWorkspaceSection` | ✅ Yes | At least 1 saved whiteboard page |
| Appointment Outputs | `#zoomOutputsSection` | ❌ No (compact already) | — |
| Package Preview | `#zoomPackagePreview` | ❌ No (read-only, compact) | — |
| Attachments | `#zoomAttachmentsSection` | ❌ No (read-only, compact) | — |

### 2.2 In-Person Mode

| Section | ID | Collapsible? | Completion Rule |
|---|---|---|---|
| Appointment & Client Info | _(shared section 1)_ | ✅ Yes | `clientName` AND `date` filled |
| EOI Details | `#eoiDetailsCard` | ✅ Yes | `includeEOI` checked AND `eoiSaleAddress` filled |
| IA Details | `#iaDetailsCard` | ✅ Yes | `includeIA` checked AND `iaForm` filled |
| Client ID Photos | _(photo cards)_ | ✅ Yes | At least 1 photo uploaded |
| Signatures | _(sigWrap area)_ | ✅ Yes | At least 1 signature captured |

### 2.3 Sections That Never Collapse

- Appointment Summary card (`.appointment-summary-card`) — always visible as the progress indicator
- Package Preview — compact enough already
- Outputs — compact checkbox list
- Attachments — compact placeholders
- Whiteboard — the toolbar + canvas must remain visible while using

---

## 3. Collapse Behaviour

### 3.1 Visual Design

Each collapsible card gets a collapse toggle button (chevron icon) in the header:

```
┌─────────────────────────────────────────────────────┐
│  🟢 Discovery Conversation                     ▼   │  ← collapsed
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  🟢 Discovery Conversation                     ▲   │  ← expanded
│                                                     │
│  [Client Goals ..................]                  │
│  [Notes .........................]                  │
└─────────────────────────────────────────────────────┘
```

**States:**
- **Chevron down (▼):** card collapsed, fields hidden
- **Chevron up (▲):** card expanded, fields visible
- **All cards start expanded** on page load
- **States are NOT persisted** in drafts (collapsing is a UI preference, not document state)

### 3.2 Completion Indicator

A small green dot (🟢) appears next to the heading when the section's completion rule is met. A grey dot (⚪) appears when incomplete.

```css
.section-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.section-indicator.complete { background: #1b8a5a; }
.section-indicator.incomplete { background: #d0d5dd; }
```

### 3.3 Toggle Button

```html
<button class="collapse-toggle" aria-expanded="true" aria-controls="firstConsultSection-body">
  <span class="section-indicator complete" aria-hidden="true"></span>
  <span class="collapse-label">Discovery Conversation</span>
  <span class="collapse-chevron" aria-hidden="true">▲</span>
</button>
<div id="firstConsultSection-body" class="collapse-body">
  <!-- existing field content -->
</div>
```

### 3.4 Collapse/Expand Animation

```css
.collapse-body {
  overflow: hidden;
  transition: max-height .3s ease, opacity .25s ease;
  max-height: 2000px; /* large enough for any card */
  opacity: 1;
}
.collapse-body.collapsed {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
  margin-bottom: 0;
}
.collapse-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  color: var(--navy);
  text-align: left;
}
.collapse-chevron {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
  transition: transform .3s ease;
}
.collapse-chevron.collapsed {
  transform: rotate(180deg);
}
```

---

## 4. Completion Rules

The completion rules map to existing field checks that `updateSummaryCard()` already performs.

| Section | Check |
|---|---|
| Discovery Conversation | `fieldText('firstConsultNotes')` OR `firstConsultGoalType` radio checked |
| Financial Position | Any of the 8 fields has a value |
| Professional Team | Any of `clientReviewBuilder/Developer/Broker/Conveyancer` has a value |
| Strategy & Next Actions | `fieldText('clientReviewStrategy')` OR `fieldText('clientReviewNextActions')` OR `fieldText('clientReviewProperty')` OR `clientReviewTimeline` has a value |
| Workspace | `wbSavedPages.length > 0` |
| Client Info | `fieldText('clientName')` AND `fieldText('date')` |
| EOI | `isChecked('includeEOI')` AND `fieldText('eoiSaleAddress')` |
| IA | `isChecked('includeIA')` AND `fieldText('iaForm')` |
| Photos | `hasC1Photo()` |
| Signatures | `hasSignature` |

A new helper function `updateCollapseIndicators()` iterates each collapsible section and updates its indicator dot. Called from `clearGenerated()` alongside the other UI update functions.

```javascript
function updateCollapseIndicators() {
  var checks = {
    'indicator-discovery': fieldText('firstConsultNotes') || document.querySelector('input[name="firstConsultGoalType"]:checked'),
    'indicator-financial': ['firstConsultAnnualIncome','firstConsultExistingMortgage','firstConsultSavings','firstConsultSuper','firstConsultInvestmentProperties','firstConsultBorrowingCapacity','fcMinBudget','fcMaxBudget'].some(function(id){ return fieldText(id); }),
    'indicator-professional': ['clientReviewBuilder','clientReviewDeveloper','clientReviewBroker','clientReviewConveyancer'].some(function(id){ return fieldText(id); }),
    'indicator-strategy': fieldText('clientReviewStrategy') || fieldText('clientReviewNextActions') || fieldText('clientReviewProperty') || fieldText('clientReviewTimeline'),
    'indicator-workspace': typeof wbSavedPages !== 'undefined' && wbSavedPages.length > 0,
    'indicator-clientinfo': fieldText('clientName') && fieldText('date'),
    'indicator-eoi': isChecked('includeEOI') && fieldText('eoiSaleAddress'),
    'indicator-ia': isChecked('includeIA') && fieldText('iaForm'),
    'indicator-photos': hasC1Photo(),
    'indicator-signatures': hasSignature
  };
  for (var id in checks) {
    var dot = $(id);
    if (!dot) continue;
    dot.className = 'section-indicator ' + (checks[id] ? 'complete' : 'incomplete');
  }
}
```

---

## 5. Auto-Collapse Behaviour

### 5.1 Option A: Manual only (recommended for Phase 1)

- All cards start expanded.
- Staff manually collapse completed sections by clicking the header.
- Collapsed sections can be re-expanded at any time.
- No auto-collapse logic.

**Why Phase 1:** Predictable behaviour. Staff control the layout. No risk of auto-collapsing a section the user is still editing.

### 5.2 Option B: Auto-collapse on completion (Phase 2)

- When a section's completion rule becomes `true`, it auto-collapses after a 2-second delay.
- Staff can always re-expand by clicking the header.
- Expands automatically if a field in that section gains focus.

**Why Phase 2:** Requires careful handling of focus events to avoid fighting the user. More complex.

**Recommendation:** Implement Option A first. Add Option B later if users request it.

---

## 6. Mobile Behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥900px (desktop) | Collapse toggle visible. Cards collapse/expand inline. Two-column grid layout preserved. |
| 768px (tablet) | Same behaviour. Chevron buttons maintain 44px minimum touch target. |
| ≤480px (mobile) | Collapse buttons full-width with larger tap area. Animations shortened to 200ms for perceived performance. |

```css
@media (max-width: 480px) {
  .collapse-toggle {
    padding: 16px;
    min-height: 48px;
  }
  .collapse-body {
    transition-duration: .2s;
  }
}
```

---

## 7. Accessibility

| Requirement | Implementation |
|---|---|
| **aria-expanded** | `aria-expanded="true"` when expanded, `aria-expanded="false"` when collapsed |
| **aria-controls** | Points to the `id` of the collapsible body container |
| **Keyboard** | Toggle button is focusable (`<button>`), activated with Enter/Space |
| **Focus management** | When expanding, focus stays on the toggle button. When collapsing, no focus change needed |
| **Screen reader** | Current state announced: "Discovery Conversation, expanded" / "Discovery Conversation, collapsed" |
| **Reduced motion** | Respect `prefers-reduced-motion`: disable transition entirely |

```css
@media (prefers-reduced-motion: reduce) {
  .collapse-body {
    transition: none;
  }
}
```

---

## 8. Draft Compatibility

- Collapse state is **NOT saved** in the draft. The `getDraft()` function is unchanged.
- All field IDs remain unchanged — draft save/load is unaffected.
- Completion indicator state is recalculated on page load and after every field change.

---

## 9. Smoke Test Impact

### 9.1 Existing Tests

All 45 existing tests target specific field IDs (`#clientReviewStrategy`, `#firstConsultNotes`, etc.) but do not depend on card expansion state. Since all cards start expanded by default, existing tests will pass without modification.

**Risk:** If a test fills a field and then checks its value via `fill()`, that will still work because the fields exist in the DOM even if the card is collapsed (the fields are hidden via `max-height: 0; opacity: 0` but still present and accessible). Playwright's `fill()` can target hidden elements.

### 9.2 New Tests

Add to `phase5-regression.js`:

1. **Collapse toggle exists** — Each collapsible section has a `.collapse-toggle` button.
2. **Expand/Collapse toggles visibility** — Click toggle, verify body gets `.collapsed` class.
3. **Completion indicator updates** — Fill a required field, verify indicator dot changes from `incomplete` to `complete`.
4. **Renders on mobile** — Set viewport to 390px, verify collapse buttons have min-height 44px.

---

## 10. Implementation Order

| Step | Description | Files | Risk |
|---|---|---|---|
| 1 | Add `.collapse-toggle`, `.collapse-body`, `.section-indicator` classes to HTML structure for each collapsible card | `index.html` | Low — classes only, no behaviour change |
| 2 | Add CSS for `.collapse-toggle`, `.collapse-body`, `.section-indicator`, chevron, mobile, reduced motion | `css/app.css` | Low |
| 3 | Add `updateCollapseIndicators()` function and wire toggle click handlers | `js/app.js` | Low — new function, no existing behaviour changed |
| 4 | Call `updateCollapseIndicators()` from `clearGenerated()` | `js/app.js` | Low — single line addition |
| 5 | Add collapse/expand keyboard + ARIA support | `js/app.js` | Low |
| 6 | Run full smoke suite | — | Must pass 45/45 |
| 7 | Add new collapse-specific smoke tests | `test-smoke/phase5-regression.js` | Low |
| 8 | Commit and push | — | — |

---

## 11. Rollback Plan

1. **Revert the commit:**
   ```bash
   git revert <collapsible-commit-hash>
   git push origin main
   ```

2. **If partial rollback is needed:**
   - Remove `.collapse-toggle` and `.collapse-body` from `index.html`
   - Remove collapse CSS from `app.css`
   - Remove `updateCollapseIndicators()` and event handlers from `app.js`
   - Fields, drafts, and PDF generation are completely unaffected

3. **Backward compatibility:**
   - Collapse state is not persisted — removing collapse does not leave any stale data
   - All field IDs unchanged
   - All `aria-*` attributes added by collapse JS can be safely removed

---

## 12. Summary

| Aspect | Decision |
|---|---|
| Zoom sections collapsible | 5 of 9 sections |
| In-person sections collapsible | 5 sections |
| Collapse model | Option A — manual only (Phase 1) |
| Completion indicator | Green/grey dot next to heading |
| State persistence | Not saved (UI preference only) |
| Animation | `max-height` + `opacity` transition, 300ms |
| Reduced motion | `prefers-reduced-motion: reduce` disables animation |
| Existing tests | Unchanged — fields remain in DOM |
| New tests | 4 new smoke tests |
| Rollback | `git revert` or remove classes from HTML/CSS/JS |
