# Landing Page Visual Migration Design

## Objective

Make the production landing page visually match `design/reference/LandingPage_Final/` while preserving production content, semantics, accessibility, and behavior exactly.

## Sources of Truth

- Visual presentation: `design/reference/LandingPage_Final/`
- Content and behavior: `index.html`, `js/app.js`, `service-worker.js`

## Allowed Scope

- The landing-page section of `index.html`
- The isolated landing-page styles in `css/app.css`
- Presentation-only wrappers and classes
- Decorative inline SVG changes
- Non-interactive structure required for visual fidelity

## Immutable Contracts

- Do not modify `js/app.js`, `service-worker.js`, PDF code, storage logic, draft logic, or non-landing application screens.
- Preserve all production wording, labels, placeholders, option values, version metadata, and legal text.
- Preserve every existing ID, role, ARIA attribute, label association, form semantic, and the hidden native select.
- Preserve keyboard behavior, pointer behavior, data flow, autofill, business rules, and Start/New Appointment flows.
- Add no dependencies.

## Presentation Architecture

Use a CSS-first migration. Keep all functional elements in place and change HTML only where a decorative wrapper or revised inline SVG is necessary. The landing styles remain isolated under `.landing-*` selectors so the rest of the application cannot inherit the new visual system.

### Canvas and frame

Use the prototype's stone canvas, near-full-viewport composition, 3px gold perimeter, 24px outer radius, white base, and layered navy/gold shadow treatment.

### Panels

Use a 40/60 desktop split. The left panel uses a deep radial navy surface, low-opacity contour lines, and a curved gold-edged desktop boundary. The right panel uses the warm ivory vertical gradient from the prototype.

### Left panel

Render the existing production logo wording as a stacked lockup without changing the text. Align desktop content left, use the prototype's serif hierarchy, and place each existing decorative benefit icon in a circular gold outline. Retain the production version text unchanged.

### Right panel

Centre the welcome/form hierarchy within the right panel. Apply the prototype's elevated security badge, spacing, warm borders, 13-14px radii, form focus rings, dropdown materiality, rounded-rectangle gold button, information panel, and footer treatment. Keep all current copy and metadata.

### Responsive behavior

At tablet/mobile widths, stack panels vertically, remove the desktop curve where it no longer represents a panel boundary, maintain comfortable touch targets, avoid horizontal overflow, and preserve reduced-motion behavior. Target viewports are 1920x1080, 1366x768, 768x1024, and 390x844.

## Verification Strategy

1. Static DOM contract checks confirm all landing IDs, roles, ARIA attributes, labels, form semantics, and the hidden select remain present.
2. A source diff confirms `js/app.js`, `service-worker.js`, and non-landing application markup/styles are untouched.
3. Browser checks cover dropdown mouse and keyboard operation, click-outside close, Start disabled/enabled states, staff/client autofill, Start Appointment, and Back to Start/New Appointment.
4. Screenshots are captured after each visual stage and at all four final target viewports.
5. Final screenshots are compared to the approved prototype. Differences caused by immutable production content are documented, not “fixed” by changing copy or behavior.

## Stop Conditions

Stop and report before proceeding if visual parity would require JavaScript changes, behavior changes, altered accessibility semantics, new dependencies, or edits outside the allowed landing-page scope.
