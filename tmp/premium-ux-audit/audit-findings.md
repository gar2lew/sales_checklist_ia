# Premium UX Audit — Findings & Action Plan

**Date:** 2026-09-16
**Repository:** C:\dev\Irrevoccable Authority CHECKLIST
**HEAD:** 4edde80

## Measurements (Baseline)

| Viewport | Load | DOM Nodes | Overflow | Small Touch Targets |
|----------|------|-----------|----------|---------------------|
| 375×667 (SE) | 624ms | 1,545 | No | 15 |
| 390×844 (14) | 944ms | 1,545 | No | 15 |
| 393×852 (14PM) | 935ms | 1,545 | No | 15 |
| 430×932 (15PM) | 875ms | 1,545 | No | 15 |
| 768×1024 (iPad) | 936ms | 1,545 | No | 13 |
| 1280×800 (Desk) | 1,022ms | 1,545 | No | 10 |

## Top Issues (Ranked)

### P0 — Missing `:active` States (Critical for mobile perceived responsiveness)
- `.btn` has NO `:active` style → users get zero visual feedback when tapping
- `.mode-card` has NO `:active` state
- `.toolbar-btn` has NO `:active` state
- Timeline `.tl-step-btn` has NO `:active` state
- This makes the app feel "clunky" and "web-form-like"

### P1 — Missing Form Attributes (Mobile keyboard & autofill)
- Name fields lack `autocapitalize="words"` → mobile keyboard won't auto-capitalize
- Email fields lack `autocomplete="email"` → no quick-fill
- Phone fields lack `autocomplete="tel"` → no quick-fill
- No `spellcheck="false"` on email/phone/name fields → red squiggles
- No `enterkeyhint` attributes → keyboard shows "return" instead of "next"/"done"
- Date inputs lack `autocomplete="bday"` or similar hints

### P1 — Touch Target Sizing
- Timeline step buttons: 40×44px (borderline — width below 44px)
- Checkboxes: 20-22px native (too small, though label click helps)
- RadioCard inputs: 20px (small)

### P2 — Information Density
- Landing benefits hidden on mobile (display:none below 600px) — loses value props
- Footer version number shows inconsistent values

### P3 — Performance
- 1,545 DOM nodes (acceptable but could be reduced)
- pdf-lib.min.js (525KB) loaded upfront (acceptable for offline, but heavy)
- No lazy loading of PDF library (must load for app to function)

## Action Plan

### Checkpoint 1: Critical mobile bugs (P0)
1. Add `.btn:active` states for immediate press feedback
2. Add `.mode-card:active` state
3. Add `.toolbar-btn:active` state
4. Add `.tl-step-btn:active` state

### Checkpoint 2: Touch/input/iOS fixes (P1)
1. Add `autocapitalize`, `autocomplete`, `spellcheck` attributes to all inputs
2. Add `enterkeyhint` for keyboard flow
3. Increase timeline touch targets to ≥44×44px
4. Increase checkbox/radio visible size

### Checkpoint 3: Navigation/workflow polish (P2)
1. Show simplified benefits on mobile (not display:none)
2. Consistent version labeling

### Checkpoint 4: Visual system consistency (P2)
1. Normalize border-radius values
2. Subtle shadow/depth improvements

## Files to Modify
- `css/app.css` — add `:active` states, adjust touch targets
- `index.html` — add input attributes

## NOT Modifying
- `js/app.js` (no business logic changes)
- `service-worker.js` (cache version stays at .32)
- Legal waiver PDF
- Any test files
- Any existing functionality
