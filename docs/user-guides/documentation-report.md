# Documentation Automation Report

## Documentation Automation Result

- Overall status: **WARN**
- Summary: All structural checks passed; advisory findings require human review.
- Human visual review required: Yes

## Source

- Application version: 2.7.0-alpha.1
- Guide version: 1.0.0
- Generated: 9 September 2026
- Git branch: main
- Source commit: c56fe0035e2093e43cbd7d010657da7bf11b6b94

## Environment and Tooling

- Node: 24.18.0
- Python command: python
- LibreOffice: soffice.com
- Poppler pdfinfo: pdfinfo
- Poppler renderer: pdftoppm.exe
- Platform: win32 x64

## Screenshot Pipeline

| Screenshot | Classification | SHA-256 | Last generated | Validation |
|---|---|---|---|---|
| 01-appointment-type-selection.png | UPDATED | `fc656c8b54c602db697839332f07008fa2f01e326e9cf19ffc7128f09585147e` | 2026-09-09T14:30:43.585Z | PASS |
| 02-in-person-workspace.png | UPDATED | `9cd0d46ad5a8210fa65e9818d1d420350a04cfb354e78d8a3c72430608376638` | 2026-09-09T14:30:43.585Z | PASS |
| 03-sale-details-mobile.png | UPDATED | `8bc637a5fbd7b921d762a8af1bc3cdd3f776198852631420ff3d3a429a18656a` | 2026-09-09T14:30:43.585Z | PASS |
| 04-zoom-workspace.png | UPDATED | `54a513f5173fde0246d42842b775a8ef3e3b82e27540d39303e2d63b9198fe83` | 2026-09-09T14:30:43.585Z | PASS |
| 05-zoom-whiteboard.png | UPDATED | `d6404d65f5c07852fedce1fc4982ecce5924e81d393faa68effeed70ec8074ef` | 2026-09-09T14:30:43.585Z | PASS |
| 06-draft-controls.png | UPDATED | `63c90a7c4ab02c5b84268b37cb52e694697d10449a555d452c900996bac4c3c7` | 2026-09-09T14:30:43.585Z | PASS |
| 07-id-signatures.png | UPDATED | `d22ec32b205410c7a187f0745d2123c4f2bffc78b8c1a6af6c75c2bd68dca32d` | 2026-09-09T14:30:43.585Z | PASS |
| 08-package-ready.png | UPDATED | `8b1ba4437014054fd872320b0645d64a66f238566bb40ff6d7b800a4ac19cb48` | 2026-09-09T14:30:43.585Z | PASS |
| 09-downloads-started.png | UPDATED | `f018e3d3341da7322aabea9ca8497e29f4de8cc5975ec628d75f4cd28671f86a` | 2026-09-09T14:30:43.585Z | PASS |

## Document Generation

| Artifact | Canonical path | Result | Bytes | SHA-256 | Generation | Pages | Metadata |
|---|---|---|---:|---|---|---:|---|
| DOCX | docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx | updated | 3660056 | `6c31b23e44bb0a527da7870d4b807e7d039a3ba9cb54be13135f2c2cb3782201` | PASS | n/a | PASS |
| PDF | docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf | updated | 1510531 | `ae32a88051f82c676efd62835e00a0b838e32d7cf19d3d7c292657f22a44ad30` | PASS | 17 | PASS |

- Observed determinism contract: DOCX may be byte-identical across unchanged runs.
- LibreOffice PDF bytes may vary despite equivalent validated content.

## Validation

| Stage | Status | Code | Message | Remediation | Evidence |
|---|---|---|---|---|---|
| docx | PASS | DOCX_VALID | DOCX structure, metadata, relationships, and media are valid. | No action required. | mediaCount=10 |
| markdown | PASS | MARKDOWN_VALID | Canonical Markdown metadata, links, screenshots, and hashes are valid. | No action required. | none |
| pdf | PASS | PDF_VALID | PDF structure and Poppler metadata are valid. | No action required. | encrypted=false, pageSize="595.304 x 841.89 pts (A4)", pages=17, pdfVersion="1.7" |
| render | PASS | RENDER_COMPLETE | All 17 PDF pages rendered successfully. | No action required. | height=1123, width=794 |
| visual | WARN | VISUAL_EDGE | Content contacts a large portion of the page edge. | Review possible clipping manually. | edgeRatio=1 |

## Cleanup and Safety

- Temporary directories: cleanup pending
- Remaining documentation server processes: 0
- Remaining LibreOffice processes: 0
- Remaining Poppler processes: 0
- Occupied documentation ports: 0
- Write boundary: pending
- Runtime integrity: pending

## Human Review

Automated heuristics detect obvious corruption only; human visual review remains required for changed screenshots and changed document layouts.

Automation does not replace human page-by-page review.

## Final Decision

**WARN** — All structural checks passed; advisory findings require human review.
