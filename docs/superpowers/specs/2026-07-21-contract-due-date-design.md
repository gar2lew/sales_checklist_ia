# Contract Due Date RC Correction Design

**Status:** Approved design pending written-spec review

## Objective

Add a Contract Due Date control to the shared appointment workflow. Staff may select a date or explicitly select `To Be Confirmed`. The two controls are mutually exclusive, persist through drafts and normal responsive rerendering, and expose one resolved business value for later prepared-email integration.

## Scope

This correction applies to both in-person and Zoom appointments. It adds one final-generation validation requirement but does not change PDF content or overlays, storage keys, unrelated workflow rules, permissions, architecture, the existing prepared-email template, or the existing Contract Issued timestamp.

## Workspace UI

Place a new section directly after the existing Appointment Date field in the shared appointment details area:

```text
Contract Due Date

[ Native date input ]

[ ] To Be Confirmed
```

Use the existing workspace form styles, spacing, focus treatment, checkbox treatment, mobile layout, and minimum touch-target conventions.

The native date control must not default to today. Its stored value remains the browser-standard ISO date value, while browser presentation follows the device locale and all generated display text uses the application's Australian `DD/MM/YYYY` policy.

## Interaction Contract

- Selecting a date clears `To Be Confirmed`.
- Checking `To Be Confirmed` clears and disables the date input.
- Unchecking `To Be Confirmed` re-enables the date input without restoring a previously cleared date.
- The field may remain blank while the appointment is being completed and while drafts are saved.
- Before final appointment generation, package preparation, or prepared-email preparation, the user must provide exactly one of a valid Contract Due Date or `To Be Confirmed`.
- Final-generation actions must show a clear inline validation error and stop when neither value is selected.
- Ordinary form refreshes, responsive rerendering, orientation changes, and mode-specific presentation updates must not lose or alter the current state.
- The control is shared by both in-person and Zoom workflows rather than duplicated per mode.

## State and Draft Persistence

Add two fields to the existing field/draft ownership path:

- `contractDueDate`: ISO date string or blank.
- `contractDueDateTbc`: boolean checkbox state.

Use the existing draft object capture and restoration mechanisms. Do not introduce a new localStorage key, schema migration, nested draft object, or alternate state store.

Draft restoration must reapply the mutual-exclusion presentation state so a restored `To Be Confirmed` value disables the date input. Legacy drafts without either field remain valid and restore both controls to blank/unchecked/enabled.

## Email Integration Boundary

Expose a single resolved Contract Due Date value for later use by the prepared-email builder:

- selected date → `DD/MM/YYYY`;
- selected checkbox → `To Be Confirmed`;
- neither selected → invalid final-generation state.

Do not change the current prepared-email template in this correction. The email wording, Contract Issued removal, and attachment-instruction removal belong to the dedicated Prompt 3 email work.

The resolver must never infer `To Be Confirmed` from a blank form. When neither value is selected, final appointment generation, package preparation, or prepared-email preparation must stop and display the Contract Due Date validation message.

Tests may verify the resolved value and invalid state, but recipient, selected-staff CC, fallback-CC, attachment wording, subject, native-share, mailto behavior, and the email body itself remain byte-for-byte unchanged in this commit.

## Accessibility

- Associate the visible label with the date input.
- Give the checkbox an explicit accessible label of `To Be Confirmed`.
- Preserve keyboard operation for the native date input and checkbox.
- Use the native `disabled` property when the checkbox is selected.
- Do not communicate mutual exclusion through colour alone.
- Preserve existing focus visibility and at least 44px touch targets.

## Testing

Add focused failing tests before runtime changes for:

- the section's placement and unique IDs;
- no implicit current-date default;
- date selection clearing the checkbox;
- checkbox selection clearing and disabling the date;
- checkbox deselection re-enabling the date;
- blank state remaining valid during ordinary editing and draft saving;
- blank state being rejected by final generation with an inline validation error;
- in-person and Zoom availability;
- preservation through ordinary UI refresh and viewport/orientation changes;
- draft save/load restoration for date and TBC states;
- legacy draft compatibility;
- resolver output of Australian `DD/MM/YYYY` for a selected date;
- resolver output of `To Be Confirmed` only when the checkbox is selected;
- resolver invalid state when neither control is selected, with no inferred TBC value;
- unchanged prepared-email template, Contract Issued text, and attachment instructions;
- separation from Contract Issued;
- unchanged PDF rendering and unrelated workflow validation;
- application/cache version contracts.

Run the existing syntax, configuration, staff, landing/workspace, mobile/accessibility, draft/share, ZIP/PDF, service-worker, and Phase 5 regression gates.

## Version and Delivery Contract

- Keep application version `2.7.0-alpha.1`.
- Advance service-worker cache from `v2.7.0-alpha.10` to `v2.7.0-alpha.11` because tracked runtime assets change.
- Deliver the correction as focused local work on `fix/staff-dropdown-seeding-v2`.
- Do not push, merge, deploy, or restart the RC server during implementation.

## Self-review

- No placeholders or unresolved behavior remain.
- Blank is allowed during editing but explicitly invalid at the final-generation boundary.
- No blank state is silently converted to `To Be Confirmed`.
- Prepared-email wording is deferred to Prompt 3; this correction exposes only the resolved value.
- The new due-date value is not conflated with Contract Issued.
- Draft persistence uses the existing shape and key rather than a migration.
- PDF output is explicitly excluded.
- Both appointment modes use one shared control and state path.
