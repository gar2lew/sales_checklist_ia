# Complete Appointment Package Generation Design

## Purpose

Every successful final-generation path must produce and retain one complete appointment package containing both the combined PDF and the ZIP of approved standalone documents. An incomplete PDF-only or ZIP-only result is a failure, not a successful package.

## Existing Behaviour and Root Cause

The application currently caches the combined PDF, individual PDFs, and ZIP in separate variables. `sharePdf()` catches ZIP failures and continues with a PDF-only fallback, while `downloadPackage()` can report PDF-only success. Cache checks rely on truthiness, so empty arrays, zero-byte blobs, and incomplete combinations are not consistently rejected. PDF and ZIP work is also orchestrated independently by each caller.

## Chosen Architecture

Add one in-memory `lastAppointmentPackage` object as the authoritative completed-package cache:

```js
{
  combinedPdfBlob,
  combinedPdfFile,
  zipBlob,
  zipFile,
  individualPdfs,
  generatedAt,
  filenames: {
    combinedPdf,
    zip,
    entries
  },
  revision
}
```

The existing `lastPdfBlob`, `lastPdfName`, `lastIndividualPdfs`, `lastZipBlob`, and `lastZipName` values remain internal compatibility views for the current preview, buttons, and tests. They are populated from the complete pipeline and cleared together. No Blob is persisted to localStorage.

`buildAppointmentPackage()` is the single orchestration boundary. It captures one local timestamp, validates or builds the combined PDF, validates or builds the standalone PDFs and ZIP, creates both `File` objects, validates the complete result, caches it, and returns it. A valid cached package is returned unchanged when the document revision has not changed.

Concurrent callers for the same revision share one in-flight promise and receive the same package object. A caller for a newer revision waits for the obsolete build to stop before starting, preventing global rendering state from mixing artifacts or timestamps across operations.

## Artifact Validation

A valid PDF Blob must be a Blob, have type `application/pdf`, have a non-zero size, and begin with `%PDF-`. A valid ZIP Blob must be a Blob, have the approved `application/zip` type, have a non-zero size, and begin with the ZIP local-file signature. Both Files must have the corresponding MIME type, non-zero size, and the exact approved filename. Standalone PDF arrays must be non-empty and every entry must contain a valid PDF Blob and a safe, unique `.pdf` filename.

An appointment package is valid only when every artifact passes validation, its filenames match the files, its entry list matches the standalone documents, its timestamp is a valid Date, and its revision equals the current document revision. Empty arrays, zero-byte blobs, incomplete objects, stale revisions, and duplicate entries are rejected.

## Generation and Timestamp Flow

`buildAppointmentPackage()` captures `generatedAt` once at the beginning of a new logical operation. `buildPdf(generatedAt)` uses that timestamp for generated footer metadata. Standalone PDF rendering and ZIP creation occur under the same `currentGeneratedAt`. The package object exposes the same timestamp.

If ZIP generation fails after a valid combined PDF was created, the complete package is not cached or reported as successful. The valid PDF and its timestamp may remain in memory for a retry of the same document revision, avoiding unnecessary combined-PDF regeneration. A retry regenerates only the missing or invalid package parts. Any document-affecting edit clears all partial and complete generated state.

## Entry-Point Behaviour

- Generate PDF builds the complete package, refreshes the existing combined-PDF preview, and retains both artifacts.
- Download PDF obtains the shared package and downloads only its combined PDF, preserving the existing action meaning.
- Download Package obtains the shared package and downloads both the combined PDF and ZIP.
- Prepare Email/native Share obtains the shared package. Native Share receives both Files. The existing compatibility fallback downloads both files and exposes the prepared mailto action.
- No caller may catch a ZIP failure and report PDF-only package success.

Prompt 3 email subject, body, recipient, CC, native-share text, and mailto content remain unchanged.

## Cache and Invalidation

Maintain an in-memory `documentRevision`. `clearGenerated()` increments it and clears the complete package and every partial artifact. Existing form, inclusion, photo, signature, settings, and draft/reset hooks use `clearGenerated()`; staff or appointment-mode changes at appointment entry also invalidate explicitly. PDF and standalone-PDF builders verify the operation revision again after asynchronous rendering and before publishing cache state. Package reuse requires an exact revision match plus full artifact validation.

No generated Blob, File, timestamp, or revision is added to storage or draft shapes.

## Filename Safety and Templates

Use the existing shared `safePart()` helper for all dynamic filename components. Extend it narrowly to remove path traversal fragments and leading/trailing punctuation or whitespace while preserving readable text. It must remove Windows-invalid characters and both path separators, collapse whitespace, prevent `..`, avoid hidden dotfiles, limit component length, and return a safe fallback if sanitisation empties the value.

Preserve filename templates:

- In-person combined PDF: `Sales Appointment - DD-MM-YYYY - <Client Names> - <Staff>.pdf`
- Zoom combined PDF: `Sales Appointment - Zoom - <Client Names> - <Staff> - DD-MM-YYYY.pdf`
- ZIP: `DD-MM-YYYY - <Client Names> - Sales Appointment Documents.zip`
- EOI: `EOI - <Client Names> - <Property> - <Staff> - DD-MM-YYYY.pdf`
- IA: `IA - <Client Names> - <Staff> - DD-MM-YYYY.pdf`
- Zoom standalone entries retain their existing First Consultation, Client Review, EOI, La Vida, and IA templates.
- Photo/additional-document entries retain their existing client-specific templates.

The combined PDF is not added to the ZIP because the current approved package contains standalone documents only.

## Errors and Recovery

Combined-PDF failure aborts the package. ZIP failure aborts the package and propagates through the caller’s existing user-facing error handling. No stack trace or internal path is shown to the user. Buttons remain retryable. Success messages occur only after a complete package result exists.

## Scope Boundaries

No UI redesign, new actions, email copy change, Contract Due Date change, conveyancer change, Prepared By field, PDF layout change, EOI/IA rule change, storage change, dependency, backend, push, merge, deployment, or RC-server restart is included.

Application version remains `2.7.0-alpha.1`. Service-worker cache advances from `v2.7.0-alpha.13` to `v2.7.0-alpha.14`.

## Verification Strategy

Add behavior-first coverage for complete artifact construction, signatures/MIME/size, File creation, shared timestamps, exact names and ZIP entries, sanitisation, incomplete-cache rejection, cache reuse/invalidation, call counts, all entry points, and failure propagation. Retain Prompt 1–3, IA/PDF, mobile/share, service-worker, landing/workspace, and Phase 5 regression coverage.
