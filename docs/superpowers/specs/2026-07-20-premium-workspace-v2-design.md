# Premium Workspace v2 Design

## Status

Approved by the user on 20 July 2026. This document records the supplied implementation specification without expanding scope.

## Objective

Retain the accepted premium split-panel landing while restoring the configured native staff dropdown, stabilising the light appointment surface on iPhone Safari, and carrying the navy, cream, and restrained-gold visual system into the authenticated workspace.

## Architecture

- Keep `index.html` semantics, IDs, controls, and workspace structure authoritative.
- Reuse `adminSettings.staff.options` and the existing `renderLandingStaffControl()` lifecycle for the landing staff `<select>`; do not create a second staff source.
- Keep the staff control ID `landingStaff`, existing listeners, stored selection restoration, and appointment-mode routing.
- Apply light-surface stabilisation and the workspace visual system in narrowly scoped CSS. Preserve the existing responsive grid, summary disclosure, More actions interaction, sticky footer, and safe-area rules.
- Change only the service-worker cache identifier from `v2.7.0-alpha.3` to `v2.7.0-alpha.4`; keep the application version at `2.7.0-alpha.1` and keep the cache strategy and asset list unchanged.

## Presentation system

- Navy application header and major headings; cream page canvas; white/ivory operational cards; restrained gold borders and primary actions.
- Serif only for major product and section headings. Sans-serif remains authoritative for labels, controls, status text, and dense operational content.
- One consistent card, input, button, badge, and shadow vocabulary across summary, forms, preview, and footer.
- Existing 60/40 wide workspace layout and stacked tablet/mobile layouts remain unchanged.

## Accessibility and responsive contract

- Native staff select with a visible label and placeholder, keyboard and VoiceOver semantics, and a 44px minimum target.
- Explicit light colour scheme and opaque light surfaces for the landing form and native controls under dark device appearance.
- Existing focus indicators, ARIA state, disclosure behaviour, tab order, touch targets, safe-area padding, and reduced-motion behaviour remain intact.
- No horizontal overflow at desktop, iPad landscape/portrait, or iPhone portrait/landscape.

## Protected behaviour

No change to business rules, validation, storage keys or shapes, drafts, PDF/EOI/IA/package generation, native share/fallback, appointment routing, Client 2 logic, navigation, IDs, or application version. JavaScript is limited to the existing landing staff-control presentation helper.

## Testing

Test-first coverage will prove the native staff select uses configured options, selection enters both appointment modes, dark appearance retains the cream landing surface, workspace premium tokens render across approved viewports, IDs remain intact, and existing workflow/accessibility suites stay green. Visual evidence is generated outside Git and inspected manually.

