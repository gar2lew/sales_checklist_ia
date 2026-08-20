# RC Email, Conveyancer, and ZIP Polish Design

**Status:** Approved design pending written-spec review

## Objective

Implement only the missing RC polish contracts for prepared-email content, editable solicitor/conveyancer entry, client-specific ZIP entries, and the date-first ZIP package filename. Preserve existing IDs, storage keys, draft fields, PDF layouts, workflow behavior, permissions, and configuration architecture.

## Current-State Findings

- The prepared-email subject uses a legacy staff/forms/property format rather than the approved subject.
- The prepared-email body has manual-attachment guidance and staff sign-off but lacks the approved greeting, structured fields, conditional next appointment, and contract issue timestamp.
- `#iaSolicitor` is rendered as a native select and cannot accept arbitrary custom text.
- ID PDFs inside ZIP packages use literal `Client 1` and `Client 2` names.
- ZIP package names use separate legacy in-person and Zoom formats rather than the approved date-first format.

## Prepared Email

Keep the existing recipient and CC resolution unchanged. The subject becomes:

```text
Sales Appointment Documents | <Client Names> | <Appointment Date>
```

The prepared-email body contains:

```text
Hi Natalie,

Please find the completed sales appointment documents for the following clients:

Clients:
<Client Names>

Property:
<Property Address>

Appointment Date:
<Appointment Date>

Next Appointment:
<Relevant Next Appointment>

Contract Issued:
<Current Local Date and Time>

The appointment PDF and supporting ZIP package have been downloaded to this device.

Please attach both files to this email before sending.

Kind regards,

<Selected Staff>
```

The complete `Next Appointment` line and its surrounding block are omitted when no relevant value exists.

- In-person uses the existing EOI next-appointment date and time.
- Zoom uses the existing Client Review next-appointment date. It includes a time only if that workflow already stores one; no new field is introduced.
- `Contract Issued` captures the current local date and time when the prepared-email content is built.
- Date display is `DD/MM/YYYY`; time display is 12-hour with `AM`/`PM`.
- The prepared-email fallback continues to state that attachments are manual and never claims automatic attachment.
- Native share behavior continues using the existing subject, body, files, timeout, and fallback flow.

## Solicitor / Conveyancer Combobox

Render `#iaSolicitor` as a text input with an associated datalist of configured solicitor/conveyancer options.

- Preserve the `iaSolicitor` ID and existing label.
- Allow configured options to be selected and arbitrary custom text to be entered.
- Keep `B.O.S.S Conveyancing` as the fresh default.
- Keep current field binding, draft save/load, generated-output invalidation, validation, and IA PDF `fieldText('iaSolicitor')` consumption.
- Do not add storage fields or change Global Settings option management.

## ZIP Filenames

Use the existing filename sanitization helper for every inserted client value.

- Client 1 ID entries use the actual Client 1 name, falling back to `Client 1` only when blank.
- Client 2 ID entries use the actual Client 2 name, falling back to `Client 2` only when blank.
- Additional-document client aliases `Client 1` and `Client 2` resolve to the corresponding actual names before filename construction.
- Other existing internal document filenames retain their current formats.

Use one ZIP package filename for in-person and Zoom:

```text
DD-MM-YYYY - <Client Names> - Sales Appointment Documents.zip
```

Invalid filename characters are removed through the existing sanitization path. Missing values retain the existing safe fallbacks.

## Test and Cache Contract

Add focused behavioral coverage for:

- exact prepared-email subject and body;
- conditional next-appointment omission and in-person/Zoom source selection;
- current contract issue timestamp format;
- recipient and CC deduplication;
- configured and custom conveyancer entry;
- custom conveyancer draft restoration and generated IA PDF value;
- client-specific ZIP entries and filename sanitization;
- exact date-first ZIP package filename;
- unchanged IA/PDF visual smoke and Phase 5 61/61 regression.

Because `js/app.js` changes, advance only `CACHE_VERSION` from `v2.7.0-alpha.9` to `v2.7.0-alpha.10`. Keep application version `2.7.0-alpha.1`.

## Delivery Boundary

Create one local focused implementation commit containing this specification, tests, runtime changes, and cache-test updates. Do not push, merge, deploy, or restart the RC server.
