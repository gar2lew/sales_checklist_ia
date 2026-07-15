# Premium Appointment Workspace — Visual Audit & Upgrade Plan

**Date:** 2026-07-15  
**Auditor:** Lead Product Designer (ASG Design System)  
**Benchmark:** Landing page v1.8.0 (bronze-on-midnight luxury financial services)  
**Scope:** Appointment workspace UI (post-landing, all sections, all viewports)  
**Status:** Audit only — no code modified

---

## 1. Current UI Critique

### 1.1 Two Competing Design Systems

The landing page and the appointment workspace use fundamentally different visual languages:

| Property | Landing Page | Main App |
|----------|-------------|----------|
| Navy | `#030A14` — midnight, warm undertone | `#1e3a5f` — corporate blue |
| Gold | `#B89948` — warm bronze, restrained | `#b8933a` — bright yellow-gold |
| White | `#FDFDFE` — warm paper tone | `#FFFFFF` — pure white |
| Borders | `#DFE1E7` — near-invisible, 2% contrast | `#e7e7ef` — cool grey, ~8% contrast |
| Soft bg | None — surfaces use subtle gradients | `#f6f6fb` — cool blue-grey |
| Type weight | 350–550 range, editorial | 700–800 range, uniform |
| Shadows | Layered, warm undertone, ambient | Single layer, neutral black |
| Radius | 28px outer, 13–14px inner | 18px cards, 12–16px mixed |
| Iconography | SVG outlined, precise stroke weight | Emoji (💾📥📦📤⚡🗑️🧪) |

The workspace reads as a different product from the same company, not the next screen after the landing page.

### 1.2 Application Header

**Problems:**
- White header on white page background creates no visual separation — the sticky header should anchor the page
- Status badge uses `var(--gold)` text on `var(--soft)` background — a muted yellow on grey-blue reads as "inactive"
- Toolbar action groups are segmented pill containers with `var(--soft)` backgrounds — this is a Bootstrap-era segmented-button pattern
- Emoji icons (`💾🧪↩↻`) are inconsistent with the landing page's outlined SVG iconography
- The header has `border-bottom: 2px solid var(--line)` — a thick rule that fights with the card borders below
- The ASG logo is `max-height: 40px` — undersized compared to the landing page's 60px brand presence

**Severity: Critical**

### 1.3 Primary Action Toolbar

**Problems:**
- Three segmented pill groups with equal visual weight — Generate PDF should be the primary action, not equal to Save Draft
- `btn.toolbar-btn.primary` uses `var(--gold)` background with `#111` text — bright yellow-gold, not the landing's bronze
- Ghost-dark buttons use `var(--navy)` (#1e3a5f) text — a navy that doesn't exist in the landing palette
- No iconography — relies on emoji characters
- Button padding `6px 12px` is cramped — the landing page uses 56px tall buttons with generous internal space
- Hover state is `rgba(30,58,95,0.08)` — a cool navy tint that doesn't relate to the bronze accent

**Severity: Critical**

### 1.4 Appointment Summary Card

**Problems:**
- `background: var(--soft)` (#f6f6fb) — a cool blue-grey that doesn't exist in the landing palette
- Header uses gold text (`var(--gold)`) at 11px/800w/uppercase — reads as shouting, not informative
- The emoji status indicator `🟠 6 Items Remaining` is the only emoji used functionally — inconsistent
- 6-column grid at 9px column titles and 11px item text is extremely dense
- Column title `letter-spacing: 0.03em` at 9px is nearly illegible
- Row items at 11px with `○` circle icons — the circles render differently across platforms
- `border-bottom: 1px solid rgba(0,0,0,0.05)` — a near-invisible separator that doesn't add value
- Click targets (`summary-card-item`) are 11px tall with `white-space: nowrap` — hard to tap on mobile

**Severity: High**

### 1.5 Form Sections (Cards)

**Problems:**
- `.card` uses `border: 1px solid var(--line)` (#e7e7ef) — a cool grey border. The landing page has moved to near-invisible warm borders
- Card padding is 16px — cramped compared to the landing's generous 22–26px padding
- Section headings (`card h2`) at 18px/800w — too small and heavy for the editorial hierarchy
- `.hint` text at 13px in `var(--muted)` — grey on white with low contrast
- `.subsection` borders are `1px solid var(--line)` — creates a ladder of horizontal rules within each card
- `.fields` grid gap is 12px — fields feel mechanically stacked
- Labels at 13px/800w — same weight as headings, no typographic distinction

**Severity: High**

### 1.6 Form Controls

**Problems:**
- Inputs have `border: 1px solid #dfe1eb` — a cool grey that differs from the landing's `#DFE1E7`
- Input border-radius is 12px — close to landing's 13px but inconsistent
- Input padding is 12px — less than the landing's 16px, making fields feel tight
- Focus state: `box-shadow: 0 0 0 4px rgba(209,171,111,0.18)` — bright yellow-gold glow, not the landing's subtle bronze ring
- `.required` indicator is `var(--danger)` (#b42318) — a harsh red. The landing uses bronze for required indicators
- Select elements use browser-native rendering — no custom styling
- Date fields use `inputmode="numeric"` with text inputs — no date picker affordance
- Checkboxes use `accent-color: var(--navy)` — the old navy, not bronze
- Radio cards (`.radioCard`) use `var(--soft)` background — the cool blue-grey

**Severity: High**

### 1.7 Output Preview (Sidebar)

**Problems:**
- `.previewWrap` is `position: sticky; top: 14px` — sits awkwardly beside the form, scrolled independently
- `.paper` has `aspect-ratio: 595/842` — a fixed proportion that may not match actual PDF output
- `.paper` border is `1px solid #ddd` — generic grey
- `.liveSummaryContainer` uses `var(--soft)` background — the cool blue-grey
- Summary header has `border-bottom: 2px solid var(--gold)` — bright yellow-gold
- Section headings at 11px/800w/uppercase — difficult to read
- Row text at 13px is fine but `strong` elements at `#30364a` don't match the landing palette
- Previous/Next buttons are generic `.btn.small` — no preview-specific styling
- The preview toggle row has no visual distinction from form elements
- Empty state shows "Click 'Refresh Preview'" in `var(--muted)` — a confusing call to action

**Severity: High**

### 1.8 Sticky Bottom Action Bar

**Problems:**
- White bar with `box-shadow: 0 -4px 14px` — a harsh upward shadow
- Buttons use emoji icons (🗑️📥📦📤⚡💾)
- `Generate PDF` button uses `.btn.dark` (navy background) — inconsistent with landing's bronze primary action
- Buttons at `padding: 12px 16px` and `border-radius: 999px` — pill-shaped, 800w, with shadows — feels heavy
- `box-shadow: 0 4px 14px rgba(0,0,0,0.12)` on every button — excessive elevation for a toolbar
- File name preview at 13px with `text-overflow: ellipsis` — cramped
- On mobile (≤767px), buttons collapse to a 5-column grid at 11px — nearly unusable

**Severity: Critical**

### 1.9 Responsive Behaviour

**Problems:**
- The `.grid` layout changes from `1.1fr .9fr` to single column at 900px — the preview sidebar drops below the form
- At ≤480px, toolbar buttons shrink to 11px with `padding: 7px 8px` — impossible to tap
- The sticky header horizontal margins use negative values (`margin: 0 -14px 20px -14px`) — a hack that breaks when viewport changes
- The footer bar at ≤767px uses a 5-column grid with `font-size: 11px` — illegible on mobile
- Signature tools become `flex-direction: column` at ≤480px — functional but visually broken
- No breakpoint between 900px and 600px — the middle tablet range is underserved

**Severity: High**

### 1.10 Settings Overlay

**Problems:**
- Background `rgba(16,24,40,0.48)` — a cold overlay. The landing uses warm tones
- Settings tabs use `background: var(--navy)` for active state — the old navy
- `.pinPanel` uses `var(--line)` border — the cool grey
- Tab inactive state is white with `var(--navy)` text — inconsistent palette
- Import/Export buttons are generic `.btn.small`
- Version display at 11px in `var(--muted)` — an afterthought

**Severity: Medium**

---

## 2. Priority Issues

### Critical (blocks visual consistency)
1. **Two competing colour palettes** — the workspace must adopt the landing's bronze-on-midnight system
2. **Emoji iconography in toolbar and footer** — must be replaced with outlined SVG icons matching the landing page
3. **Toolbar hierarchy** — Generate PDF must be the single most prominent action
4. **Footer bar styling** — pill buttons with emojis and heavy shadows read as template defaults

### High (degrades perceived quality)
5. **Form controls** — borders, focus states, and required indicators use the wrong palette
6. **Appointment Summary card** — dense, cramped, uses wrong colors and type
7. **Section cards** — spacing, borders, and typography don't match landing
8. **Preview panel** — disconnected from the rest of the interface
9. **Responsive gaps** — tablet range under-designed, mobile too compressed
10. **Sticky header** — no visual separation, wrong colours

### Medium (noticeable but not urgent)
11. Settings overlay styling
12. Signature pad styling
13. Photo box styling
14. Checklist styling
15. Radio card styling

### Low (nice to have)
16. Toast notification
17. Legal text
18. Field highlight animation
19. `.callout` styling
20. `.fieldError` styling

---

## 3. Proposed ASG Workspace Design Tokens

```css
:root {
  /* Surfaces */
  --asg-canvas:        #F5F6F9;   /* Page background — warm off-white */
  --asg-surface:       #FDFDFE;   /* Card/panel surface — warm paper */
  --asg-surface-raised:#FFFFFF;   /* Elevated surface (modals, dropdowns) */
  --asg-surface-soft:  #F3F4F7;   /* Subtle section background (not blue-grey) */

  /* Brand */
  --asg-navy:          #030A14;   /* Midnight — deepest brand colour */
  --asg-navy-light:    #0C1F38;   /* Midnight variant for gradients */
  --asg-bronze:        #B89948;   /* Primary accent — warm brass */
  --asg-bronze-dark:   #A6863A;   /* Hover/pressed bronze */
  --asg-bronze-subtle: rgba(184,153,72,0.08); /* Selected/highlight states */

  /* Text */
  --asg-text-primary:  #0E1A2E;   /* Headings, body text */
  --asg-text-secondary:#5E6878;   /* Helper text, hints */
  --asg-text-tertiary: #949DB0;   /* Placeholders, disabled text */

  /* Borders */
  --asg-border:        #DFE1E7;   /* Default input/card border */
  --asg-border-light:  #E8EAF0;   /* Subtle separators */
  --asg-border-focus:  #A6863A;   /* Focus ring colour */

  /* Semantic */
  --asg-success:       #2D8C5A;   /* Completion green */
  --asg-warning:       #C2842A;   /* Warning amber */
  --asg-danger:        #C44040;   /* Error red */
  --asg-info:          #5B7FA5;   /* Info blue */

  /* Shadows */
  --asg-shadow-xs:     0 1px 2px rgba(8,16,32,0.04);
  --asg-shadow-sm:     0 2px 8px rgba(8,16,32,0.06);
  --asg-shadow-md:     0 8px 24px rgba(8,16,32,0.08);
  --asg-shadow-lg:     0 24px 64px rgba(8,16,32,0.10);

  /* Radii */
  --asg-radius-sm:     8px;
  --asg-radius-md:     12px;
  --asg-radius-lg:     16px;
  --asg-radius-xl:     24px;

  /* Spacing */
  --asg-space-xs:      4px;
  --asg-space-sm:      8px;
  --asg-space-md:      12px;
  --asg-space-lg:      16px;
  --asg-space-xl:      24px;
  --asg-space-2xl:     32px;
  --asg-space-3xl:     48px;
}
```

---

## 4. Typography System

```
Family:      Inter (body), Playfair Display (major section titles only)
Scale:
  --asg-text-2xs:   10px / 1.4 / 400    (version, legal, meta)
  --asg-text-xs:    11px / 1.4 / 500    (badges, labels, captions)
  --asg-text-sm:    13px / 1.5 / 400    (hints, secondary text)
  --asg-text-base:  15px / 1.55 / 400   (body, inputs)
  --asg-text-md:    17px / 1.35 / 500   (subsection headings)
  --asg-text-lg:    20px / 1.25 / 600   (card/section headings)
  --asg-text-xl:    32px / 1.10 / 550   (major section titles, Playfair)
  --asg-text-2xl:   44px / 1.06 / 550   (page titles, Playfair) — reserved

Weight usage:
  350 — body text in dark panels
  400 — body text in light panels
  500 — labels, metadata, secondary headings
  550 — primary headings, strong emphasis
  600 — interactive element labels (buttons)
  700 — reserved for critical emphasis only
```

**Playfair Display rule:** Only used for the page title "Sales Appointment Capture" in the header and for major section dividers. Never used for form labels, button text, or body copy.

---

## 5. Colour System

**Semantic colour mapping:**

| Role | Token | Usage |
|------|-------|-------|
| Primary action | `--asg-bronze` | Generate PDF button, primary CTAs |
| Primary hover | `--asg-bronze-dark` | Hover/pressed states |
| Active/focus | `--asg-bronze-subtle` | Selected items, focus rings |
| Section accent | `--asg-bronze` at 40% opacity | Section title underlines, active nav |
| Header bg | `--asg-navy` | Sticky header background |
| Card bg | `--asg-surface` | Form sections, summary cards |
| Page bg | `--asg-canvas` | Main page background |
| Disabled | `#E8E6E1` / `#9C9688` | Disabled button fill/text |

**Bronze restraint rule:** Bronze appears on:
- Primary action buttons (Generate PDF)
- Active/focus ring on inputs
- Section header underlines (subtle, 40% opacity)
- Summary card header text
- Status indicator dots (completed state)

It does NOT appear on:
- Every border
- Every heading
- Secondary buttons
- Decorative elements
- Disabled states

---

## 6. Spacing and Radius System

```
Spacing scale (4px base):
  4px  — icon-to-text gaps, tight pairs
  8px  — label-to-input, badge padding
  12px — field-to-field vertical
  16px — card internal padding, section gap
  24px — between-section gap
  32px — major section separation
  48px — page-level breathing room

Radius scale:
  8px  — small elements (badges, tags, small buttons)
  10px — menu items, checkboxes
  12px — inputs, selects, cards
  16px — modals, panels
  24px — outer containers
```

---

## 7. Button Hierarchy

```
Level 1 — Primary (only ONE per view)
  Solid bronze fill (#B89948)
  White text, 600 weight
  48-56px height, 12px radius
  Subtle ambient shadow
  Example: "Generate PDF"

Level 2 — Secondary
  White fill, 1px warm border (#DFE1E7)
  Navy text (#0E1A2E), 500 weight
  40-44px height, 10px radius
  No shadow
  Example: "Save Draft", "Download PDF"

Level 3 — Tertiary/Ghost
  Transparent fill
  Muted text, 500 weight
  36-40px height
  Hover: subtle warm fill (2% bronze)
  Example: "Refresh Preview", "Settings"

Level 4 — Danger
  White fill, red border on hover
  Red text, 500 weight
  Example: "New Appointment" (reset), "Clear Signature"
```

---

## 8. Form-Control Specification

```
Text input:
  height: 48px
  border: 1px solid #DFE1E7
  border-radius: 12px
  padding: 0 14px
  font-size: 15px
  background: #FFFFFF
  color: #0E1A2E
  placeholder: #949DB0

Select:
  Same dimensions as text input
  Custom dropdown arrow (chevron SVG)

Focus state:
  border-color: #A6863A
  box-shadow: 0 0 0 3px rgba(166,134,58,0.08)
  transition: 0.15s ease

Error state:
  border-color: #C44040
  box-shadow: 0 0 0 3px rgba(196,64,64,0.06)
  Error text below: 12px, 500w, #C44040

Disabled:
  background: #F3F4F7
  border-color: #E8EAF0
  color: #949DB0
  cursor: not-allowed

Label:
  font-size: 12px
  font-weight: 500
  color: #0E1A2E
  margin-bottom: 8px
  letter-spacing: 0.01em

Required indicator:
  color: #A6863A (bronze, not red)
  font-weight: 500

Optional indicator:
  color: #949DB0
  font-weight: 400
  font-size: 11px
```

---

## 9. Card and Section Specification

```
Card (form section):
  background: #FDFDFE (warm paper)
  border: 1px solid #E8EAF0 (near-invisible)
  border-radius: 16px
  padding: 20px 24px
  box-shadow: 0 1px 2px rgba(8,16,32,0.03)

Section heading (h2):
  font-family: Inter (not Playfair — reserved for page titles)
  font-size: 18px
  font-weight: 550
  color: #0E1A2E
  letter-spacing: -0.01em
  margin-bottom: 8px

Section heading with bronze accent:
  border-bottom: 1px solid rgba(184,153,72,0.30)
  padding-bottom: 10px
  margin-bottom: 16px

Subsection (h3):
  font-size: 15px
  font-weight: 550
  color: #0E1A2E
  border-top: 1px solid #E8EAF0
  padding-top: 16px
  margin-top: 16px

Helper text (.hint):
  font-size: 13px
  font-weight: 400
  color: #5E6878
  line-height: 1.5
  margin-bottom: 16px
```

---

## 10. Header Redesign Recommendation

```
Concept: Midnight header bar with bronze accents

Structure:
┌─────────────────────────────────────────────────────────┐
│ [ASG logo]  Sales Appointment Capture  v1.8.0  Ready.  │  ← dark bar
│                                                        │
│ [Change Staff] [Save] [Load] [Test] │ [⚡Generate PDF] │  ← toolbar row
│ [Download] [Package] [Share] [Refresh] │ [⚙ Settings] │
└─────────────────────────────────────────────────────────┘

Changes:
- Header background: var(--asg-navy) (#030A14) — matches left panel
- Product title: Inter 550w, white
- Version: Inter 400w, rgba(white, 0.4)
- Status badge: subtle pill, bronze tint when ready
- Toolbar: lighter navy (#0C1F38) or transparent on navy
- Primary button (Generate PDF): solid bronze, white text
- Secondary buttons: ghost style, white/off-white text
- Toolbar buttons lose the segmented pill containers
- Replace emoji with outlined SVG icons (consistent 1.5px stroke)
```

---

## 11. Preview Panel Recommendation

```
Concept: Clean document preview in a dedicated panel

Changes:
- Move from sticky sidebar to a dedicated panel with clear separation
- Panel background: var(--asg-surface-soft) (#F3F4F7)
- Paper frame: subtle bronze border, soft shadow, consistent aspect ratio
- Navigation: Previous/Next as ghost buttons with chevron SVGs
- Page counter: centered, 12px, 500w, muted
- Empty state: "Generate PDF to preview" with subtle illustration
- Summary below preview: cleaner typography, bronze section headers
```

---

## 12. Sticky Action Bar Recommendation

```
Concept: Floating toolbar with clear hierarchy

Changes:
- Background: white with subtle top border and minimal shadow
- Generate PDF: solid bronze pill, largest, most prominent
- Secondary actions: ghost style, no shadows
- Replace emoji with SVG icons
- File name: left-aligned, 13px, 400w, muted
- On mobile: collapse to icon-only toolbar with tooltips
- Add "New Appointment" as leftmost ghost button (not emoji)
```

---

## 13. Responsive Recommendations

```
Breakpoints:
  ≥1100px: Full grid (form + preview sidebar)
  900–1099px: Reduced grid, single column preview below form
  600–899px: Single column, stacked sections
  <600px: Mobile-optimised, larger touch targets

Specific fixes:
- Remove negative margin hack on sticky header
- Increase mobile touch targets to minimum 44px
- Collapse toolbar to icon-only at <600px
- Prevent horizontal scrolling at all breakpoints
- Ensure signature canvas scales properly
- Photo grid: 1 column at <600px (already correct)
- Footer bar: allow wrapping, minimum 40px button height
```

---

## 14. Accessibility Considerations

```
Current issues:
- Emoji icons have no accessible names (except via title attributes on some)
- `accent-color: var(--navy)` on checkboxes may not meet 3:1 contrast against white
- Required fields use colour alone (red asterisk) — need text indication
- Focus rings use the old gold colour
- Summary card text at 9px violates minimum font size recommendations
- Mobile toolbar at 11px is below readable threshold

Recommended fixes:
- All icon-only buttons need aria-labels
- Required fields: add "(required)" text for screen readers
- Maintain minimum 4.5:1 text contrast ratio
- Ensure focus indicators use bronze with sufficient contrast
- Minimum 12px type for all interactive elements
- Respect prefers-reduced-motion
```

---

## 15. Phased Implementation Plan

### Phase 1 — Palette & Tokens (1 session)
- Replace all `:root` CSS variables with ASG workspace tokens
- Update global input, label, button, card, and text styles
- Replace emoji icons with SVG outlines
- Fix responsive breakpoints
- **Risk:** Changes to `:root` variables affect all elements globally
- **Mitigation:** Test every control type after token migration
- **Files:** `css/app.css` (lines 1–199, 320–480)

### Phase 2 — Header & Toolbar (1 session)
- Redesign sticky header with navy background
- Restructure toolbar hierarchy (Generate PDF as primary)
- Replace action group pill containers
- Add SVG icon system
- **Risk:** Toolbar button IDs must remain unchanged for JS
- **Mitigation:** Only change CSS classes and SVG content
- **Files:** `css/app.css` (lines 200–319), `index.html` (lines 181–214)

### Phase 3 — Cards & Sections (1 session)
- Restyle `.card`, section headings, subsection dividers
- Update Appointment Summary card
- Improve form field spacing
- Restyle radio cards, checklists, photo boxes
- **Risk:** Card padding changes may affect information density
- **Mitigation:** Test with realistic data at all viewports
- **Files:** `css/app.css` (lines 32–66, 320–480)

### Phase 4 — Preview & Footer (1 session)
- Redesign preview panel
- Restyle footer bar with icon buttons
- Improve sticky bar behaviour
- **Risk:** Preview panel uses sticky positioning — layout changes may cause scroll issues
- **Mitigation:** Test at all breakpoints with content-filled preview
- **Files:** `css/app.css` (lines 89–101, 320–400), `index.html` (lines 587–630, 759–783)

### Phase 5 — Settings & Polish (1 session)
- Restyle settings overlay
- Update signature pad styling
- Polish toast notifications, error states
- Final accessibility audit
- **Risk:** Settings overlay uses dynamic tab switching
- **Mitigation:** Preserve all JS classes (`.hidden`, `.active`, etc.)
- **Files:** Various CSS sections

---

## 16. Files Likely to Change

| File | Sections | Risk |
|------|----------|------|
| `css/app.css` lines 1–199 | Global styles, tokens, inputs, cards | High — affects everything |
| `css/app.css` lines 200–319 | Header, toolbar | Medium — JS references classes |
| `css/app.css` lines 320–480 | Summary, preview, badges, section cards | Medium — JS updates badge states |
| `css/app.css` lines 92–101, 759–783 | Footer bar | Low |
| `index.html` lines 181–214 | Header HTML (SVG icons only) | Low — IDs preserved |
| `index.html` lines 587–630 | Preview panel HTML (minor) | Low |

---

## 17. Elements That Must NOT Change

- All element IDs (`id="..."`)
- All `data-*` attributes
- All `role` and `aria-*` attributes
- `<form>` structure and field IDs
- `<canvas>` elements for signatures
- JavaScript function names and event bindings
- `localStorage` key names
- PDF generation pipeline
- Draft save/load logic
- Settings import/export format
- Service worker cache strategy
- `<meta>` tags

---

## 18. Regression Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `:root` variable rename breaks JS-dependent styles | High | Keep variable names unchanged; only change values |
| Card padding reduction hides content | Medium | Test with maximum content (all fields filled, all sections expanded) |
| Toolbar button restyling breaks click targets | Medium | Maintain button dimensions; only change visual styling |
| Mobile footer button collapse hides actions | Medium | Test all mobile breakpoints with all buttons enabled |
| Focus ring colour change reduces visibility | Low | Verify 3:1 contrast ratio on all backgrounds |
| SVG icon replacement breaks layout | Low | Match SVG viewBox dimensions to container |
| Header redesign breaks sticky positioning | Low | Maintain existing `.stickyHeader` positioning CSS |

---

## Landing Page vs Workspace

### Elements that SHOULD carry into the workspace:

| Landing Element | Workspace Application |
|----------------|----------------------|
| Midnight navy `#030A14` | Sticky header background |
| Bronze `#B89948` | Primary action buttons, focus rings, section accents |
| Warm white `#FDFDFE` | Card and panel backgrounds |
| Near-invisible borders `#DFE1E7` | Input and card borders |
| Layered ambient shadows | Card elevation, modals |
| 12–14px radii | Inputs, buttons, cards |
| Inter 400–550 weight range | All body text, labels, headings |
| SVG outlined icon style | All toolbar and action icons |
| Generous padding (16–24px) | Cards, form sections |
| Subtle focus rings (3px, 8% bronze) | All interactive controls |

### Elements that should NOT carry into the workspace:

| Landing Element | Reason |
|----------------|--------|
| Playfair Display for general headings | Reserved for the page title only — the workspace is operational, not editorial |
| 60px oversized typography | Belongs on the front door, not in a data-entry form |
| Sweeping curved SVG divider | A decorative landing-page element with no functional purpose in the workspace |
| Wave/contour background patterns | Atmospheric decoration that adds noise to a data-dense interface |
| 40/60 split-panel layout | The workspace needs a form + sidebar grid, not a brand + form split |
| Security badge | Security messaging belongs on the landing page, not repeated in the tool |
| Gold divider with hexagon | A marketing ornament |
| Info box "What happens next?" | Onboarding content — dead weight after first use |
| Full-viewport height lock | The workspace scrolls; the landing is a single screen |
| 28px outer radius | Belongs to the landing card; workspace uses 16px max |
| Backdrop-filter glass effects | Not appropriate for a data-entry workspace |

---

## Audit Summary

The appointment workspace is a functional, well-built application that suffers from a single overarching problem: it was designed before the landing page existed. The colour palette, typography, iconography, and spacing conventions belong to a different product. The upgrade is not a redesign — it is a unification. The bones are solid. Every section has a clear purpose. Every control works correctly. The fix is a palette migration, a toolbar restructure, a spacing pass, and an icon replacement.

**Top Five Visual Issues:**
1. Two competing colour systems (landing bronze vs. app yellow-gold/navy)
2. Emoji iconography in toolbar and footer
3. Undifferentiated toolbar hierarchy (Generate PDF should dominate)
4. Dense, cramped Appointment Summary card with 9px type
5. Sticky header with no visual separation from page content

**Recommended approach:** Phase 1 (palette unification) produces the largest visual improvement and touches the most elements. It should be implemented first, tested thoroughly, then followed by the remaining phases in order.

---

*Document path: `docs/design/premium-appointment-workspace-audit.md`*  
*Screenshots captured: `screenshots/main-app-1920x1080.png`, `screenshots/main-app-1366x768.png`*  
*No application files modified during this audit.*

---

## Phase 1 Implementation Status — 2026-07-15

**Branch:** `design/asg-ui-foundation`

### Completed
- [x] 32 ASG design tokens created in `:root` block (colours, typography, spacing, radius, shadows, motion)
- [x] Legacy compatibility tokens preserved for JS references
- [x] All emoji icons replaced with inline SVG (Lucide-style, 1.5px stroke, 16px)
- [x] 4-level button system implemented (primary, secondary, ghost, dark)
- [x] Form control foundation standardised (48px height, warm borders, bronze focus)
- [x] Card and section styles migrated to ASG tokens
- [x] Application header migrated to midnight navy with white text
- [x] Toolbar restructured (segmented pill groups on dark background, bronze primary)
- [x] Sticky footer bar refined (warm white, bronze Generate PDF, icon buttons)
- [x] Status badges updated to use ASG semantic colours
- [x] Appointment Summary card migrated to ASG tokens
- [x] Settings overlay migrated to ASG tokens
- [x] Version bumped to 1.9.0 (APP_VERSION, CACHE_VERSION, landing labels aligned)
- [x] `ASG_UI_GUIDELINES.md` created with complete design system documentation
- [x] Landing page CSS completely preserved and unchanged

### Verified
- [x] `node --check js/app.js` — PASS
- [x] `node --check service-worker.js` — PASS
- [x] `git diff --check` — PASS
- [x] No emoji remain in toolbar or footer
- [x] No IDs changed
- [x] Screenshots captured (landing ×4, workspace ×2)

### Remaining for Phase 2
- [ ] EOI form section migration
- [ ] IA form section migration
- [ ] Photo section migration
- [ ] Signature pad migration
- [ ] Preview panel full migration
