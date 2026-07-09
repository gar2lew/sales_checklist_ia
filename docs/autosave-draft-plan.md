# Autosave Draft — Implementation Plan

> Document created 2026-07-09  
> Planning only — no code changes.

---

## 1. Goals

- Automatically save the draft at regular intervals so staff never lose work.
- Show a "Saved just now" / "Saving..." status so the user knows the draft is being persisted.
- Manual "Save Draft" button continues to work and resets the autosave timer.
- Minimise localStorage writes (debounce).
- Handle errors gracefully (storage full, quota exceeded).
- Maintain backward compatibility with existing drafts.
- Allow rollback by keeping all existing manual save infrastructure intact.

---

## 2. Autosave Interval

### 2.1 Recommendation: 15-second debounced autosave

- **Trigger:** Any field change (input, change, checkbox toggle, signature, photo, whiteboard stroke) resets a debounce timer.
- **Timer:** After the last field change, wait 15 seconds of inactivity, then auto-save.
- **Why 15 seconds?** Short enough that users won't lose meaningful work; long enough that rapid typing doesn't trigger continuous saves.
- **On page load:** If a draft exists and has been modified, autosave triggers after the debounce period.
- **Edge case:** If the user closes the tab within 15 seconds of the last change, the work is lost. This is acceptable — the previous autosave snapshot exists.

### 2.2 Implementation

```javascript
const AUTOSAVE_DELAY = 15000; // 15 seconds
let autosaveTimer = null;

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(doAutosave, AUTOSAVE_DELAY);
  updateSaveStatus('saving');
}

function doAutosave() {
  try {
    saveDraft(); // calls existing saveDraft() which serializes getDraft() + draftSavedAt
    updateSaveStatus('saved');
  } catch(e) {
    updateSaveStatus('error');
  }
  autosaveTimer = null;
}

function cancelAutosave() {
  if (autosaveTimer) {
    clearTimeout(autosaveTimer);
    autosaveTimer = null;
  }
}
```

### 2.3 Where to schedule

The autosave should be scheduled whenever the form state changes. These are the same points where `clearGenerated()` is already called:

- All field `input` / `change` event handlers (already wired via `bindFieldEvents`)
- Checkbox toggles (EOI, IA, outputs)
- Signature pad `pointerup` events
- Photo add/remove/rotate events
- Whiteboard stroke complete / save page / clear page / new page events
- Template/selector change events
- Draft load (reset the timer after restoring a draft)
- Form reset (cancel autosave, clear timer)

Rather than wiring each event individually, the simplest approach is to call `scheduleAutosave()` from within `clearGenerated()`. Since `clearGenerated()` is already called on every field change, this is a single-line addition with no risk of missing events.

```javascript
function clearGenerated(){
  // ... existing code ...
  updatePackagePreview();
  scheduleAutosave();  // <-- single addition
}
```

### 2.4 Exclusions

Do NOT schedule autosave when:
- The save is triggered by the autosave itself (avoid infinite loops — `saveDraft` calls `clearGenerated` indirectly via `getDraft` which reads fields, but it does NOT call `clearGenerated` itself, so no loop risk)
- The user is on the landing screen (no form to save)
- The form is being reset (`resetForm()` already clears the draft in memory)

---

## 3. "Saved just now" Status

### 3.1 UI Location

Add a subtle status indicator next to the Save Draft button in the toolbar.

```html
<span class="save-status" id="saveStatus" role="status" aria-live="polite"></span>
```

States:
| State | Text | Colour | Timeout |
|---|---|---|---|
| Idle (no draft) | _(hidden)_ | — | — |
| Saving… | "Saving…" | muted/grey | shown while saving |
| Saved just now | "Saved just now" | green | auto-hide after 4 seconds |
| Saved N min ago | "Saved 2 min ago" | green | updates every 30 seconds |
| Save failed | "Save failed" | red | auto-hide after 6 seconds |

### 3.2 Implementation

```javascript
function updateSaveStatus(state) {
  const el = $('saveStatus');
  if (!el) return;
  if (state === 'saving') {
    el.textContent = 'Saving…';
    el.style.color = 'var(--muted)';
    el.style.display = '';
  } else if (state === 'saved') {
    const now = new Date();
    el.textContent = 'Saved just now';
    el.style.color = 'var(--success)';
    el.style.display = '';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
  } else if (state === 'error') {
    el.textContent = 'Save failed';
    el.style.color = 'var(--danger)';
    el.style.display = '';
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 6000);
  } else {
    el.style.display = 'none';
  }
}
```

### 3.3 Last Saved Timestamp

The existing `draftSavedAt` metadata field (ISO string) in the draft data is already displayed on the recent draft card as "Last saved: DD/MM/YYYY HH:mm". No additional storage is needed.

The save status indicator is different — it's a transient UI element that shows the result of the most recent save attempt. It does not need to be persisted.

---

## 4. Manual Save Draft

The existing manual "Save Draft" button remains unchanged:

```javascript
$('saveDraft').addEventListener('click', saveDraft);
```

When the user clicks "Save Draft":
1. The manual save fires immediately (no debounce).
2. The autosave timer is reset (`cancelAutosave()` followed by `scheduleAutosave()`).
3. The "Saved just now" status is shown.
4. The `draftSavedAt` timestamp is updated.

To implement this, modify `saveDraft()`:

```javascript
function saveDraft(){
  try{
    var data = getDraft();
    data.draftSavedAt = new Date().toISOString();
    localStorage.setItem('salesAppointmentDraft', JSON.stringify(data));
    toast('Draft saved on this device.');
    updateSaveStatus('saved');
    cancelAutosave();
    scheduleAutosave();
  }catch(e){
    toast('Draft could not be saved. Photos may be too large for browser storage.');
    updateSaveStatus('error');
  }
}
```

---

## 5. Draft Timestamp Handling

### 5.1 Existing

The `draftSavedAt` field is already added by `saveDraft()`:

```javascript
data.draftSavedAt = new Date().toISOString();
```

### 5.2 Autosave Timestamp

The autosave function calls `saveDraft()`, which already sets `draftSavedAt`. No additional timestamp field is needed.

### 5.3 Display

The recent draft card already shows `draftSavedAt` formatted as DD/MM/YYYY HH:mm via `formatDraftSavedAt()`.

---

## 6. Save Status HTML

Add a single span to the toolbar next to the Save Draft button:

```html
<button class="btn toolbar-btn" id="saveDraft" title="Save Draft">💾 Save Draft</button>
<span class="save-status" id="saveStatus" role="status" aria-live="polite"></span>
```
```css
.save-status {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  transition: opacity .3s ease;
}
```

---

## 7. localStorage Risk

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Quota exceeded** — large photos push draft over ~5 MB limit | Medium | Medium | Autosave calls `saveDraft()` which already catches `QuotaExceededError` via try/catch. The `saveDraft()` function already handles this: `toast('Draft could not be saved. Photos may be too large for browser storage.')` |
| **Frequent writes** — continuous saves degrade performance on low-end devices | Low | Low | 15-second debounce ensures at most 4 writes per minute. This is negligible. |
| **Corrupted state** — saving mid-change produces inconsistent data | Low | Low | `getDraft()` reads field values synchronously at the time of save. By the time the timer fires (15s after last change), the user has stopped typing. |
| **Tab close** — last 15 seconds of work lost if tab is closed | Low | Low | Acceptable trade-off. Previous autosave snapshot exists. Manual "Save Draft" is always available for important milestones. |
| **Storage event conflicts** — other tabs overwrite draft | Low | Low | This app is single-tab by design (no multi-tab editing). |

---

## 8. Smoke Test Updates

### 8.1 New Tests

Add to `phase5-regression.js`:

1. **Autosave triggers on field change:**
   - Fill a field
   - Wait 16 seconds
   - Verify `localStorage` has a draft with updated `draftSavedAt`

2. **Status indicator appears:**
   - After a field change, check that `#saveStatus` textContent is "Saving…" or "Saved just now"

3. **Manual save resets timer:**
   - Click "Save Draft"
   - Immediately check that `draftSavedAt` is updated

4. **Autosave does not fire when idle:**
   - Navigate to landing page
   - Wait 20 seconds
   - Verify no excess localStorage writes

### 8.2 Test Count

The existing 45 tests should remain passing. New tests will increase the total to approximately 48-50.

---

## 9. Implementation Order

| Step | Description | Files | Risk |
|---|---|---|---|
| 1 | Add `saveStatus` span to HTML toolbar | `index.html` | Low |
| 2 | Add `.save-status` CSS | `css/app.css` | Low |
| 3 | Add `scheduleAutosave()`, `doAutosave()`, `cancelAutosave()`, `updateSaveStatus()` functions | `js/app.js` | Low |
| 4 | Add `scheduleAutosave()` call in `clearGenerated()` | `js/app.js` | Low |
| 5 | Update `saveDraft()` to call `updateSaveStatus('saved')` and reset timer | `js/app.js` | Low |
| 6 | Update `resetForm()` to cancel autosave | `js/app.js` | Low |
| 7 | Update `deleteDraft()` to hide save status | `js/app.js` | Low |
| 8 | Add smoke tests | `test-smoke/phase5-regression.js` | Low |
| 9 | Run full smoke suite (must pass) | — | — |
| 10 | Commit and push | — | — |

---

## 10. Rollback Plan

If the autosave feature causes issues:

1. **Revert the commit:**
   ```bash
   git revert <autosave-commit-hash>
   git push origin main
   ```

2. **If partial rollback is needed:**
   - Comment out or remove the `scheduleAutosave()` call in `clearGenerated()`
   - Remove the `#saveStatus` element from HTML
   - Remove the `.save-status` CSS
   - The existing `saveDraft()` function is completely unchanged — manual saves still work

3. **Backward compatibility:**
   - Old drafts without autosave timestamps are handled by the existing `formatDraftSavedAt()` function (returns "Unknown" for missing ISO strings)
   - The manual `saveDraft()` function is unchanged — it already sets `draftSavedAt`
   - Disabling autosave leaves all existing draft data untouched

---

## 11. Summary

| Aspect | Decision |
|---|---|
| Autosave trigger | Any field change → 15s debounce → save |
| Timer management | `setTimeout` / `clearTimeout` in `scheduleAutosave()` |
| Call site | `clearGenerated()` (single line addition) |
| Status display | "#saveStatus" span with "Saved just now" / "Saving…" / error states |
| Manual save | Unchanged — immediately saves, resets timer |
| Storage risk | Handled by existing try/catch in `saveDraft()` |
| Test impact | 3-5 new smoke tests, ~48-50 total |
| Rollback | Single `git revert` or comment out one line |
