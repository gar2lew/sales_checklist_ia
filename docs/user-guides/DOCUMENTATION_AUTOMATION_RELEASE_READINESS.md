# Documentation Automation v1 Release Readiness

## 1. Executive decision

**GO WITH DOCUMENTED WARNINGS** for push, pull request, CI review, deployment
preview, and controlled staff acceptance testing.

Production promotion remains conditional on pull-request approval, CI,
deployment-preview smoke testing, and physical iPad/iPhone validation. The only
current documentation warning is the intentional full-bleed navy cover touching
the PDF page edge.

## 2. Scope verified

Documentation Automation v1 phases 1-9 were reviewed end to end:

- command foundation and write contracts;
- Git/tooling preflight;
- fingerprinted server reuse and PID-scoped ownership;
- deterministic screenshot capture;
- canonical metadata;
- atomic DOCX/PDF generation;
- deep artifact validation;
- report/changelog generation;
- cleanup, signals, and orchestration.

Runtime application behaviour was regression-tested and no runtime file was
changed by documentation commands.

## 3. Commit range

- Application release-candidate baseline: `0e18df5`
- Documentation guide baseline: `9ebc287`
- Automation phase range: `c30092a..fc4b23b`
- Verified implementation commit: `fc4b23b29f18035857b96e745dedbf18de1c99cc`
- Phase 10 verification commit: recorded by the commit containing this report

The nine implementation phases appear in order as one focused commit per phase.
The approved specification and implementation plan precede implementation.

## 4. Public commands

| Command | Result | Approximate runtime | Cleanup |
|---|---|---:|---|
| `npm run docs:user-guide:clean` | PASS / missing target tolerated | 0.43-0.51 s | No temp path |
| `npm run docs:user-guide:validate` | WARN, exit 0 | 3.80-4.37 s | Render temp removed |
| `npm run docs:user-guide:capture` | PASS, exit 0 | 9.63 s | Owned server/temp removed |
| `npm run docs:user-guide` (run 1) | WARN, exit 0 | 25.40 s | Owned server/temp removed |
| `npm run docs:user-guide` (run 2) | WARN, exit 0 | 28.67 s | Owned server/temp removed |

Stage order for full generation was:

`preflight -> tooling -> server -> screenshots -> metadata -> documents ->
validation -> report -> integrity -> cleanup`.

Both independent clean generation runs classified all nine screenshots as
UNCHANGED and updated metadata, DOCX, PDF, report, and changelog for the new
Source commit.

## 5. Test results

- Complete Node suite: 94/94 passed.
- Authoritative Phase 5 application regression: 61/61 passed.
- Documentation automation, server integration, generation, validation,
  reporting, orchestration, and artifact suites: passed.
- JavaScript and service-worker syntax: passed.
- Python generator syntax parsing: passed.
- Git whitespace validation: passed.

Focused coverage includes phase boundaries, earliest-failure preservation,
failure cleanup, write contracts, runtime integrity, server ownership,
screenshot determinism, atomic pair promotion and rollback, warning semantics,
report ordering, changelog duplicate prevention, link/reparse safety, and signal
cleanup.

## 6. Artifact results

- Canonical Markdown: valid metadata block and resolvable links.
- Screenshot metadata: schema version 1, nine records, matching SHA-256 hashes.
- Screenshots: nine valid PNGs using fictional data.
- DOCX: valid OOXML package, no macros/executables or external relationships,
  nine approved screenshots plus the logo, and stable bytes across identical
  clean runs.
- PDF: readable, A4, 17 pages, unencrypted, PDF 1.7.
- Report: accurately records WARN and the human-review requirement.
- Changelog: one entry per matching Source commit/guide/output state.
- No duplicate canonical guide artifact or real client information was found.

## 7. Manual visual review

All 17 rendered PDF pages were reviewed on 23 July 2026:

1. Cover
2. Overview
3. Quick Start
4. Choosing the Appointment Type
5. Staff Login and Appointment Setup
6. In-Person Workflow
7. Sale Details
8. Zoom Workflow
9. Zoom Whiteboard
10. ID Documents and Signatures
11. Saving and Loading Drafts
12. Generating the Appointment Package
13. Downloading and Emailing
14. Reviewing Generated Documents
15. Troubleshooting
16. Best Practices and Physical-Device Tips
17. Final Checklist

No clipping, overlap, distorted screenshot, broken image, unreadable text,
incorrect page break, cut-off metadata, or accidental real data was observed.
Some pages intentionally use generous whitespace. The navy cover is intentionally
full bleed and causes the recorded edge-contact warning.

## 8. Security and safety review

| Severity | Finding |
|---|---|
| CRITICAL | None |
| HIGH | None |
| MEDIUM | None unresolved |
| LOW | Environment overrides can select local executables; this is documented operator trust and each command is invoked directly without a shell. |
| INFORMATIONAL | Debug mode can print local stack paths to the local console. Generated reports record tool names/platform but not secrets or environment dumps. |

Controls verified:

- no shell-based command construction;
- bounded stdout/stderr and HTTP response sizes;
- redirects rejected during fingerprint checks;
- strict clean-tree and command write contracts;
- SHA-256 runtime integrity checks;
- exact cleanup target with real-path/lstat link protection;
- PID-scoped owned-process cleanup;
- atomic writes and DOCX/PDF pair rollback;
- DOCX external relationship, macro, and executable validation;
- screenshot/ZIP path and filename safety remain covered by application tests.

## 9. Known warnings

- `VISUAL_EDGE` on PDF page 1 is expected because the cover intentionally
  reaches all page edges.
- Automated visual heuristics are advisory and never replace manual review.

## 10. Known limitations

- The supported and verified operator environment is Windows x64.
- Linux/macOS may work but were not validated and are not claimed supported.
- PDF bytes are not deterministic because LibreOffice can vary embedded-font or
  export internals. Page count, extracted text, A4 metadata, rendering, and
  findings were stable.
- Real report bytes can vary with approved timestamps and environment facts.
- Physical-device RC checks remain separate from desktop automation verification.

## 11. Environment prerequisites

- Node.js 18+ with repository dependencies and Playwright Chromium.
- Python with `python-docx` and Pillow.
- LibreOffice with direct `soffice.com`/`soffice` access.
- Poppler native `pdfinfo` and `pdftoppm`.
- A clean named Git branch for generate/capture/validate.
- Human review of all generated PDF pages before release.

Windows paths containing spaces, `py -3`, native `.exe` tools, CRLF files,
junction rejection, and direct no-shell argument handling were reviewed.

## 12. Release sequence

1. Push `fix/staff-dropdown-seeding-v2`.
2. Open a pull request.
3. Review the full commit history and diff.
4. Run CI.
5. Resolve review findings.
6. Merge using the approved repository strategy.
7. Create a deployment preview.
8. Run the preview smoke test.
9. Test on the target tablet and mobile devices.
10. Confirm Download Package and Prepare Email.
11. Confirm Zoom and in-person appointment flows.
12. Promote the approved build to production.
13. Run a production smoke test.
14. Begin controlled staff UAT.
15. Monitor results and retain the rollback point.

## 13. Rollback plan

- Preserve history; use ordinary revert commits rather than reset or force-push.
- Application rollback point: `0e18df5`.
- To remove the automation, revert the Phase 10 verification commit and the
  focused automation commits from `fc4b23b` back through `c30092a`, reviewing
  the generated-artifact changes before committing the revert.
- Restore canonical guide artifacts from the last approved Git revision.
- Roll back a deployment through the hosting platform to the last verified
  deployment; do not change production from this branch directly.
- Service-worker cache remains `v2.7.0-alpha.21`; after deployment rollback,
  verify cache upgrade/reload on a real installed PWA.
- Remove temporary automation state with
  `npm run docs:user-guide:clean`.

## 14. Staff UAT checklist

- Open landing and select staff plus appointment type.
- Complete one in-person and one Zoom workflow.
- Confirm Client 2 absent and present states.
- Exercise Save Draft and Load Draft.
- Confirm EOI, IA, photos, signatures, and whiteboard behaviour.
- Generate the appointment package.
- Confirm combined PDF and ZIP filenames/content.
- Download Package and Prepare Email.
- Check native Share where supported.
- Repeat on target iPad and iPhone in portrait and landscape.
- Verify software keyboard, focus scrolling, safe areas, offline reload, and
  installed-PWA cache upgrade.
- Record device, OS/browser, result, and evidence for every physical check.

## 15. Final decision

**GO WITH DOCUMENTED WARNINGS**

The branch is ready for controlled push and pull-request review. Merge,
deployment, and staff UAT should follow the gated release sequence above.
Production is not approved directly by this local verification phase.
