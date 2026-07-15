# ASG UI Guidelines — v1.9.0

## Design Principles

1. **Midnight as foundation.** The deepest navy (`#030A14`) anchors the interface. It appears in the header and as the landing panel. It should feel like velvet — deep, warm, absorbing.

2. **Bronze as signal.** Bronze (`#B89948`) is the only accent colour. It indicates primary actions, active states, focus, and completion. It does not decorate. It communicates.

3. **Paper as surface.** All content sits on warm off-white surfaces (`#FDFDFE`), never pure white. The canvas (`#F5F6F9`) provides barely perceptible separation from the browser chrome.

4. **Weight creates hierarchy.** Headings at 550, body at 400, labels at 500. The 350 weight provides a lightweight counterpoint for secondary text. 600 is reserved for interactive elements only.

5. **Every pixel earns its place.** Before adding a border, shadow, or colour, ask: "Does this help the user complete their task?"

---

## Colour Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--asg-navy` | `#030A14` | Header background, landing panel |
| `--asg-bronze` | `#B89948` | Primary buttons, focus rings, active states |
| `--asg-bronze-dark` | `#A6863A` | Hover/pressed states |
| `--asg-bronze-subtle` | `rgba(184,153,72,0.08)` | Selected items, subtle highlights |
| `--asg-bronze-glow` | `rgba(184,153,72,0.10)` | Focus ring glow |
| `--asg-surface` | `#FDFDFE` | Card and panel backgrounds |
| `--asg-surface-raised` | `#FFFFFF` | Modals, dropdowns, elevated elements |
| `--asg-surface-soft` | `#F3F4F7` | Subtle section backgrounds |
| `--asg-canvas` | `#F5F6F9` | Page background |
| `--asg-text-primary` | `#0E1A2E` | Headings, body text |
| `--asg-text-secondary` | `#5E6878` | Helper text, hints |
| `--asg-text-tertiary` | `#949DB0` | Placeholders, disabled text |
| `--asg-border` | `#DFE1E7` | Input and card borders |
| `--asg-border-light` | `#E8EAF0` | Subtle separators |
| `--asg-border-focus` | `#A6863A` | Focus ring border colour |
| `--asg-success` | `#2D8C5A` | Completion states |
| `--asg-warning` | `#C2842A` | Warning states |
| `--asg-danger` | `#C44040` | Error states |
| `--asg-disabled-bg` | `#E8E6E1` | Disabled button background |
| `--asg-disabled-text` | `#9C9688` | Disabled button text |

---

## Typography Scale

| Token | Size | Weight | Line-height | Usage |
|-------|------|--------|-------------|-------|
| `--asg-text-2xs` | 10px | 400 | 1.4 | Version, legal, meta |
| `--asg-text-xs` | 11px | 500 | 1.4 | Badges, labels, captions |
| `--asg-text-sm` | 13px | 400 | 1.5 | Hints, secondary text |
| `--asg-text-base` | 15px | 400 | 1.55 | Body, inputs |
| `--asg-text-md` | 17px | 550 | 1.35 | Subsection headings |
| `--asg-text-lg` | 20px | 550 | 1.25 | Card/section headings |
| `--asg-text-xl` | 28px | 550 | 1.15 | Major section titles |
| `--asg-text-2xl` | 36px | 550 | 1.10 | Page titles (reserved) |

**Font families:**
- UI: Inter, Arial, Helvetica, sans-serif
- Display: 'Playfair Display', 'Times New Roman', serif (landing page and major titles only)

**Weight tokens:**
- `--asg-weight-light`: 350 — secondary text in dark panels
- `--asg-weight-body`: 400 — body text
- `--asg-weight-label`: 500 — labels, metadata
- `--asg-weight-strong`: 550 — headings, emphasis
- `--asg-weight-heavy`: 600 — interactive elements, buttons

---

## Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--asg-space-xs` | 4px | Icon-to-text gaps, tight pairs |
| `--asg-space-sm` | 8px | Label-to-input, badge padding |
| `--asg-space-md` | 12px | Field-to-field vertical |
| `--asg-space-lg` | 16px | Card internal padding |
| `--asg-space-xl` | 24px | Between-section gap |
| `--asg-space-2xl` | 32px | Major section separation |
| `--asg-space-3xl` | 48px | Page-level breathing room |

---

## Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--asg-radius-sm` | 8px | Badges, tags, small elements |
| `--asg-radius-md` | 10px | Menu items |
| `--asg-radius-lg` | 12px | Inputs, selects, cards |
| `--asg-radius-xl` | 16px | Modals, panels |
| `--asg-radius-2xl` | 24px | Outer containers |
| `--asg-radius-pill` | 999px | Buttons, pills |

---

## Shadow Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--asg-shadow-subtle` | `0 1px 2px rgba(8,16,32,0.04)` | Cards, sections |
| `--asg-shadow-card` | `0 2px 8px rgba(8,16,32,0.06)` | Elevated cards |
| `--asg-shadow-toolbar` | `0 2px 6px rgba(8,16,32,0.06)` | Sticky header |
| `--asg-shadow-floating` | `0 8px 28px rgba(8,16,32,0.08)` | Modals, dropdowns |
| `--asg-shadow-focus` | `0 0 0 3px var(--asg-bronze-glow)` | Focus rings |

---

## Button Hierarchy

| Level | Class | Background | Text | Border | Usage |
|-------|-------|------------|------|--------|-------|
| 1 — Primary | `.btn.primary` | Bronze solid | White | None | Generate PDF |
| 2 — Secondary | `.btn.secondary` | White | Navy | `--asg-border` | Download PDF |
| 3 — Tertiary | `.btn.ghost` | Transparent | Muted | `--asg-border-light` | Save Draft, Settings |
| 4 — Dark | `.btn.dark` | Navy | White | None | Alternative primary |
| Danger | `.btn.danger` | Red tint | Red | None | New Appointment |

**Rules:**
- Only ONE primary button per view
- All buttons use `--asg-radius-pill` (999px) for full-round or `--asg-radius-lg` (12px) for footer bar
- Standard height: 40-48px for inline, 48-56px for standalone
- Icon gap: 8px (`--asg-space-sm`)
- Font weight: 600 (`--asg-weight-heavy`)

---

## Form Control Rules

- Height: 48px for text inputs and selects
- Border: `1px solid var(--asg-border)` default, `var(--asg-border-focus)` on focus
- Focus ring: `var(--asg-shadow-focus)` — 3px bronze glow
- Error: `border-color: var(--asg-danger)` with subtle red glow
- Placeholder: `var(--asg-text-tertiary)`, 400 weight
- Labels: 11px, 500 weight, `var(--asg-text-primary)`, 8px bottom margin
- Required indicator: Bronze asterisk (`var(--asg-bronze-dark)`)
- Optional indicator: Muted text, 400 weight

---

## Icon Rules

- Use inline SVG, never emoji
- Stroke width: 1.5px consistently
- Standard sizes: 16px (toolbar), 18px (standalone)
- `aria-hidden="true"` on all decorative icons
- `stroke="currentColor"` to inherit text colour
- Opacity: 0.55-0.65 default, 0.9-1.0 on hover/active

---

## Card Rules

- Background: `var(--asg-surface)` (warm paper, not pure white)
- Border: `1px solid var(--asg-border-light)` (near-invisible)
- Radius: `var(--asg-radius-xl)` (16px)
- Shadow: `var(--asg-shadow-subtle)`
- Internal padding: 20px horizontal, 24px vertical minimum
- Section headings: 20px, 550 weight, `--asg-text-primary`

---

## Status Colour Rules

| State | Background | Text | Border |
|-------|------------|------|--------|
| Complete | `rgba(45,140,90,0.08)` | `--asg-success` | `rgba(45,140,90,0.15)` |
| Incomplete | `rgba(194,132,42,0.08)` | `--asg-warning` | `rgba(194,132,42,0.15)` |
| Required | `rgba(196,64,64,0.06)` | `--asg-danger` | `rgba(196,64,64,0.12)` |
| Optional | `var(--asg-surface-soft)` | `--asg-text-secondary` | `var(--asg-border-light)` |

---

## Landing vs Workspace

### Transfers from landing to workspace:
- Midnight navy for header
- Warm paper surfaces for cards
- Bronze for primary actions and focus
- Subtle warm shadows
- Inter 350-600 weight range
- SVG outlined icons
- 10-16px radii

### Does NOT transfer:
- Playfair Display for general headings (reserved for landing + page title)
- 60px oversized typography
- Curved SVG divider
- Wave/contour background patterns
- 40/60 split panel layout
- Security badge
- Gold divider with hexagon
- Full-viewport height lock
- 28px outer radius (use 16px max in workspace)

---

## Do and Do Not

### Do:
- Use tokens for every visual property
- Use bronze only for primary actions, focus, and active states
- Use weight contrast (350 vs 550) instead of colour for hierarchy
- Test at 1366×768, 1920×1080, 768×1024, and 390×844
- Preserve all IDs, JS hooks, and event handlers
- Keep the landing page entirely unchanged when modifying workspace CSS

### Do NOT:
- Use raw colour values outside the token section
- Add decorative bronze borders or accents
- Use emoji for icons
- Change button text or behaviour
- Rename or remove any element IDs
- Touch PDF generation, draft, signature, or photo logic
- Copy landing-page decorative elements into the workspace

---

## Component Migration Order

1. **Phase 1 (complete):** Design tokens, global controls, application shell, icons, footer bar
2. **Phase 2:** Header, toolbar, appointment summary card, section cards
3. **Phase 3:** Form sections (EOI, IA), photo boxes, signature pad
4. **Phase 4:** Preview panel, settings overlay, live summary
5. **Phase 5:** Accessibility audit, responsive polish, edge cases
