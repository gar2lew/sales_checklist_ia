# Authenticated Workspace Responsive Density Refinement

## Objective

Refine the authenticated ASG appointment workspace so it uses desktop and iPad space deliberately and remains compact and usable on iPhone, without changing workflow, business rules, validation, storage, PDF output, filenames, readiness calculations, accessibility semantics, IDs, or landing-page behaviour.

The primary reference is a 13-inch iPad Air in landscape at approximately 1366×1024 CSS pixels. Secondary references are 1024×1366, 1920×1080, 1366×768, 440×956, 956×440, and 390×844.

## Evidence and root causes

The physical iPhone 17 Pro Max screenshot at 440×956 shows four action rows in the sticky header, six summary groups stacked vertically, and a two-line fixed footer. These surfaces consume most of the usable viewport before the first form section.

The current implementation causes this through:

- `.app { max-width:1120px }` and `.headerInner { max-width:1092px }`, which create excessive gutters on wide screens.
- `.appointment-summary-card` being nested inside `main`, preventing it from spanning the form/preview grid.
- `.grid { grid-template-columns:1.1fr .9fr }`, which does not provide the intended form emphasis.
- `.summary-card-body { grid-template-columns:repeat(6,1fr) }`, which gives unequal content equal widths and makes Client 2 status chips wrap.
- `.headerActions` and `.actionGroup` wrapping every action without compact-layout priority.
- Disabled output actions remaining visible on compact layouts.
- `.summary-card-body` collapsing to one full-detail column below 600px.
- The mobile footer showing a full filename and six 44px controls at once.

## Responsive architecture

### Fluid shell

Use shared responsive custom properties on the authenticated workspace:

- `--workspace-max: 1440px`
- `--workspace-gutter: clamp(16px, 2.5vw, 40px)`
- `--section-gap: clamp(20px, 2vw, 32px)`
- `--control-height: clamp(46px, 4vw, 52px)`
- `--card-radius-responsive: clamp(14px, 1.5vw, 20px)`

The `.app`, `.headerInner`, and `.footerInner` use the same width and gutter system. The landing screen remains outside this system and unchanged.

### Workspace composition

Move `#appointmentSummaryCard` to be the first child of `.grid`, before the form/preview layout. Add a presentation wrapper for the existing `main` and `.previewWrap` elements. The summary spans the full authenticated workspace; beneath it, the wrapper uses:

```css
grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);
```

The two-column composition activates only when the container can satisfy both columns without squeezing the form or preview. Otherwise it becomes one column with form first and preview second. This keeps 1366×1024, 1920×1080, and 1366×768 in the approximately 60/40 composition while allowing 1024×1366 and compact layouts to stack.

The preview remains sticky only in the two-column composition. In a stacked composition it returns to normal document flow.

### Summary layout

On wide layouts, the summary uses content-driven columns with `minmax()` and `auto-fit`, giving Property and Client groups more room than Photos or Signatures. Status chips use `white-space:nowrap` where space permits.

On compact layouts, the readiness status remains visible in the summary header. The detailed six-group body defaults collapsed. A real button labelled “View details” controls the existing body with `aria-expanded` and `aria-controls`; its label changes to “Hide details” while expanded. Keyboard activation uses the button’s native Enter and Space behaviour. The readiness calculation and existing summary content are untouched.

The disclosure is visible only on compact layouts. At larger widths the details are always visible and the disclosure is hidden.

## Header and action hierarchy

Brand, appointment utilities, output actions, and confidence states remain distinct groups. Desktop and iPad landscape use increased group gaps and the shared 1440px shell.

Compact layouts expose these immediate utilities:

- Change Staff / Clients
- Save Draft
- Load Draft

`#loadTestData` and `#openSettings` move into one secondary-utility `<details>` disclosure while retaining their IDs, handlers, titles, focusability, and behaviour. On wide layouts its disclosure label is visually suppressed and the two existing controls render inline with the utility group. On compact layouts the native summary is a clearly labelled “More actions” control. This avoids placing Load Test Data behind the admin PIN-protected Settings content and requires no JavaScript action-menu state.

Generate PDF remains visible and primary. Disabled Download PDF, Download Package, and Share controls are hidden on compact layouts. Existing button state reveals them after successful generation. `#previewTop` moves beside the Output preview heading and keeps its existing handler and ID.

No action is duplicated and no handler is replaced.

## Mobile footer and viewport behaviour

On compact layouts the fixed footer shows only:

- New Appointment
- Save Draft
- Generate PDF

The existing bottom Download PDF, Download Package, and Share buttons remain in the DOM with their IDs and handlers but are visually hidden on compact layouts because their enabled equivalents are available in the header after generation.

The visible footer filename is shortened to client names and appointment date using a presentation-only helper. The real generated/downloaded filename functions are unchanged.

Footer controls remain at least 44px high. Footer padding includes `env(safe-area-inset-bottom)`. Authenticated content uses matching bottom clearance, `scroll-padding-bottom`, and form controls use `scroll-margin-block`. Dynamic viewport units provide a CSS-only keyboard fallback. A `visualViewport` helper will not be added unless screenshot and focus testing proves CSS insufficient.

## Target layouts

- **1366×1024:** full-width compact summary, then 60/40 form/preview; touch-friendly toolbar and footer.
- **1024×1366:** full-width summary; form then preview in one column; footer clearance retained.
- **1920×1080:** centred shell capped at 1440px with proportional gutters and 60/40 content split.
- **1366×768:** same desktop composition with fluidly reduced gaps and no field over-stretching.
- **440×956:** compact header, three immediate utility actions, primary Generate action, collapsed summary, three-action footer.
- **956×440:** compact landscape header and summary; columns activate only if minimum readable widths are met; safe footer clearance remains.
- **390×844:** same compact model with the 44px control floor and no horizontal overflow.

## Presentation helpers

Only two JavaScript helpers are approved:

1. `setSummaryDisclosureExpanded(expanded)` updates the mobile summary class, `aria-expanded`, and “View details”/“Hide details” text.
2. `updateFooterDisplayName()` derives a short display label from existing client and appointment-date fields while leaving `pdfFileName()`, ZIP names, and all download behaviour unchanged.

Both helpers are session-only DOM presentation. They do not read or write storage, change validation, alter readiness, or mutate application data.

## Verification strategy

Extend `tests/ux-polish-presentation.test.mjs` test-first to prove:

- the full-width summary and 60/40 layout at wide reference sizes;
- stacked flow at 1024×1366 and compact widths;
- no horizontal overflow at all seven target sizes;
- every visible interactive target is at least 44px;
- compact summary defaults collapsed and toggles through keyboard activation;
- `aria-expanded` and `aria-controls` remain correct;
- disabled output controls are hidden compactly and enabled controls appear after generation;
- Load Test Data remains reachable through Settings;
- the footer exposes only the approved three mobile actions;
- the short footer label does not change the generated download filename;
- all 193 integration-base IDs remain present.

Run the existing IA overlay, PDF visual smoke, and UX presentation suites. Capture and manually inspect all required sizes and state screenshots without committing them.

## Documentation and completion

Update `docs/design/UX_POLISH_BACKLOG.md` to mark H4 complete only after the 440×956 and 390×844 screenshots materially reduce the header footprint and retain all required actions. Record any remaining limitations separately.

No version bump, service-worker change, dependency, merge, push, deployment, landing-page change, or unrelated cleanup is permitted.
