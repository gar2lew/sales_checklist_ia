# Prepared Email Rewrite Design

**Status:** Approved for implementation

## Objective

Rewrite only the prepared appointment email content so it presents business handover information, uses Prompt 1's resolved Contract Due Date, removes the email-only Contract Issued timestamp, and removes all technical download/attachment instructions. Preserve recipients, subject, next-appointment behavior, native share, mailto, PDF/ZIP generation, and all unrelated workflows.

## Preconditions

- Branch: `fix/staff-dropdown-seeding-v2`
- Baseline: `eb07b23d980c9e5dbcc091e96ca41b4d4407416d`
- Application version: `2.7.0-alpha.1`
- Cache before implementation: `v2.7.0-alpha.12`
- Prompt 1 Contract Due Date and Prompt 2 conveyancer selector are present.
- Working tree is clean and the RC server remains stopped.

## Subject and Recipients

Preserve the exact subject template:

```text
Sales Appointment Documents | <Client Names> | <Appointment Date>
```

Preserve `Natalie@sjssolutionscorp.com.au` as the primary recipient, selected-staff CC resolution, primary-recipient deduplication, and fallback CC behavior. Do not expose recipient logic in the body.

## Exact Plain-Text Body

Use this exact order and wording:

```text
Hi Natalie,

Please find the completed sales appointment documents for the following appointment.

Clients:
<Client Names>

Property:
<Property Address>

Appointment Date:
<Appointment Date>

Contract Due Date:
<Resolved Contract Due Date>

Next Appointment:
<Relevant Next Appointment>

Kind regards,

<Selected Staff Name>
```

The complete `Next Appointment` block, including its leading blank line, is omitted when no valid value exists. The body is plain text only: no HTML, Markdown, bullets, tables, or decorative characters.

## Existing Value Resolution

- Keep current client-name resolution and approved one/two-client formatting.
- Keep current property resolution and validation.
- Keep current appointment date resolution and `DD/MM/YYYY` formatting.
- Keep current in-person next appointment from EOI date/time.
- Keep current Zoom next appointment from Client Review date.
- Keep `DD/MM/YYYY` and 12-hour `AM/PM` formatting; never invent a missing time.
- Keep selected staff display name as the closing value.

## Contract Due Date Integration

Call the existing `resolveContractDueDate()` and use its resolved value:

- selected date → `DD/MM/YYYY`;
- TBC → `To Be Confirmed`;
- blank/conflicting → invalid final-generation state.

Do not infer TBC, use the current date, expose ISO/raw checkbox values, or generate an email body from an invalid due-date state. The existing final-generation path must continue showing Prompt 1's inline error before native share or mailto preparation begins.

## Removed Email Content

Remove only these concepts from prepared-email content:

- `Contract Issued:` and its local timestamp;
- statements that PDF/ZIP files were downloaded;
- instructions to attach files manually;
- browser, Downloads, Files app, native-share, or mailto limitations.

Do not remove timestamps used by document metadata, filenames, logs, or other unrelated output. Remove any now-obsolete fallback-body string replacement that targeted the deleted instructions, without changing the share capability flow.

## Behavioral Boundaries

Preserve the email preparation entry point, native-share and mailto paths, package-generation order, loading/error states, PDF/ZIP generation and names, controls, storage, Contract Due Date controls/drafts/validation, and conveyancer selector. Do not add an email service, backend, dependency, Prepared By, or direct sending.

## Versions and Delivery

- Keep application version `2.7.0-alpha.1`.
- Advance cache from `v2.7.0-alpha.12` to `v2.7.0-alpha.13` because `js/app.js` changes.
- Create one local commit: `fix: simplify prepared appointment email`.
- Do not push, merge, deploy, restart the RC server, or resume RC testing.

## Verification Contract

Test meaningful returned email objects and real share-entry behavior for exact body/subject, date and TBC due dates, invalid due-date blocking, no inferred TBC, removed wording/timestamp, in-person and Zoom next appointments, empty-block omission, formatting, staff closing, recipients/CC/fallback, unchanged native share/mailto paths, Prompt 1/2 regressions, alpha.13 service-worker upgrade from alpha.12, all focused suites, and Phase 5.
