# Mobile Conveyancer Selector Design

**Status:** Approved for implementation

## Objective

Replace the mobile-unfriendly `#iaSolicitor` text-input/datalist interaction with a native three-option select and an explicit custom-text mode. Preserve one resolved conveyancer string for existing draft and PDF consumers without adding storage keys, changing the draft schema, or altering workflow behavior outside this control.

## Preconditions

- Branch: `fix/staff-dropdown-seeding-v2`
- Baseline: `eda3503a8aad0c8c35e7ded7263123a1cf46ec73`
- Application version: `2.7.0-alpha.1`
- Service-worker cache before implementation: `v2.7.0-alpha.11`
- Prompt 1 Contract Due Date behavior remains unchanged.

## Control Structure

Render the existing `#solicitorControl` with:

- a labelled native `<select id="iaSolicitorOption">`;
- options in this exact order: `B.O.S.S Conveyancing`, `Natalie to Confirm`, `Other`;
- a separate labelled `<input id="iaSolicitorOther" type="text">` for custom text;
- the existing `#iaSolicitor` retained as a hidden synchronized field containing the final resolved string.

`#iaSolicitor` remains the sole persisted and downstream value. The visible selector controls are projections of it and are not added to the draft field list or persisted shape.

## State and Synchronisation

Use a narrow resolver/synchronizer with these rules:

- `B.O.S.S Conveyancing` selects the matching option, hides and disables `#iaSolicitorOther`, and sets `#iaSolicitor` to exactly `B.O.S.S Conveyancing`.
- `Natalie to Confirm` selects the matching option, hides and disables `#iaSolicitorOther`, and sets `#iaSolicitor` to exactly `Natalie to Confirm`.
- `Other` reveals and enables `#iaSolicitorOther`; trimmed custom text becomes the resolved `#iaSolicitor` value.
- Blank custom text resolves to an empty string. Do not add new validation unless the current generation path already requires a non-empty solicitor value.
- Selecting `Other` must not focus the custom input or scroll the page.
- Selecting a standard option must not focus any text field.
- While hidden, the custom input is disabled and therefore excluded from sequential keyboard focus.

The fresh appointment default is `B.O.S.S Conveyancing`. Rerendering derives the visible mode from the current resolved value before replacing the control, preserving custom values without form-wide rerenders on custom keystrokes.

## Draft and Legacy Compatibility

Keep the existing `salesAppointmentDraft` key and flat `iaSolicitor` property unchanged. Do not persist `iaSolicitorOption` or `iaSolicitorOther` and do not introduce a migration.

On restoration:

- `B.O.S.S Conveyancing` maps to the B.O.S.S option;
- `Natalie to Confirm` maps to the Natalie option;
- any other non-empty string maps to `Other` and restores the exact value into the custom input and resolved field;
- a missing or blank legacy value maps to the fresh `B.O.S.S Conveyancing` default, matching the existing renderer's fresh-default convention.

The current `preserveDraftDropdownValue('solicitor', ...)` path must not add arbitrary restored values as new visible standard options. Global Settings ownership and existing configured solicitor data remain unchanged.

## Mobile, Focus, and Accessibility

- Use native select and text input controls with explicit `<label for>` associations.
- Both controls have a minimum 44px touch target.
- The custom input is hidden and disabled outside `Other` mode.
- No programmatic focus occurs on mode change, so the software keyboard opens only when the user deliberately focuses the custom field.
- On actual custom-field focus, use the browser's native focus scrolling first. If a focused adjustment is needed, apply it only to that field and avoid a form-wide rerender or aggressive page scroll.
- Preserve ordinary Tab and Shift+Tab behavior.
- Orientation and responsive rerenders preserve the resolved/custom value and do not focus the input.

## PDF and Runtime Integration

Existing `fieldText('iaSolicitor')` consumers continue receiving one resolved string. IA PDF layout, overlay coordinates, styling, page count, EOI behavior, ZIP/package actions, and prepared-email content remain unchanged.

The existing generated-output invalidation and draft-dirty behavior must run when either visible control changes, with no extra invalidation semantics.

## Versions and Delivery

- Keep application version `2.7.0-alpha.1`.
- Advance `CACHE_VERSION` from `v2.7.0-alpha.11` to `v2.7.0-alpha.12` because runtime assets change.
- Create one local commit: `fix: improve mobile conveyancer selection`.
- Do not push, merge, deploy, restart the RC server, or resume RC testing.

## Verification Contract

Test-first coverage must prove exact options/order, fresh default, both standard selections, explicit Other disclosure, hidden-field focus exclusion, no automatic focus, custom draft round-trip, legacy mapping, responsive/orientation preservation, resolved standard/custom PDF values, labels, 44px targets, unchanged Contract Due Date behavior, application/cache versions, service-worker upgrade from alpha.11, all focused suites, and Phase 5.

Manual browser evidence may confirm that selection itself does not focus the custom field. A desktop automation environment cannot claim physical iPhone keyboard or keyboard-overlay behavior; that remains a physical-device RC check.
