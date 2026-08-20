# Documentation Automation Report

## Documentation Automation Result

- Overall status: **WARN**
- Summary: All structural checks passed; the intentional full-bleed navy cover requires human review.
- Human visual review required: Yes

## Source

- Application version: 2.7.0-alpha.1
- Guide version: 1.0.0
- Generated: 22 July 2026, 10:00 AM AWST
- Git branch: fix/staff-dropdown-seeding-v2
- Source commit: 9db1800ce947f634520bb391826ad44ded8a6b82

## Environment and Tooling

- Node: 22.23.1
- Python command: Python 3.12.13
- LibreOffice: LibreOffice 26.2.4.2
- Poppler pdfinfo: pdfinfo.exe 26.05.0
- Poppler renderer: pdftoppm.exe 26.05.0
- Platform: Windows x64

## Screenshot Pipeline

| Screenshot | Classification | SHA-256 | Last generated | Validation |
|---|---|---|---|---|
| 01-appointment-type-selection.png | UNCHANGED | `64ec142263da095e67425438e0a8ac5d4558f8d496d122c75edb85829ca666e9` | 2026-07-22T02:00:00.000Z | PASS |
| 02-in-person-workspace.png | UNCHANGED | `dc43facbeb75cf9f6883f760c7e4534b1139050ca12d287bcdd39335d10b1cc6` | 2026-07-22T02:00:00.000Z | PASS |
| 03-sale-details-mobile.png | UNCHANGED | `685713b4f6146172809f409c4834e92e431c81d1835804bc8ecd3288c266ca7b` | 2026-07-22T02:00:00.000Z | PASS |
| 04-zoom-workspace.png | UNCHANGED | `e0b3cbe76b650883943c594b36889f8f2164b8596285ec4b465212fab111a6b9` | 2026-07-22T02:00:00.000Z | PASS |
| 05-zoom-whiteboard.png | UNCHANGED | `f7bbe8712ca7774349babf9454355688ec529f0fb6decc06c9546a0781518c8e` | 2026-07-22T02:00:00.000Z | PASS |
| 06-draft-controls.png | UNCHANGED | `d5ee28f32653f3a1f98b24b9f0177172e39539f1fd6a94aa5e9366397e0c81e3` | 2026-07-22T02:00:00.000Z | PASS |
| 07-id-signatures.png | UNCHANGED | `e9df11086a3f43badf4e8c5e463dbaa1610b0bdef7a3c7e99a721c6b723cea51` | 2026-07-22T02:00:00.000Z | PASS |
| 08-package-ready.png | UNCHANGED | `164e0c61636dedfc1ca957e89bcb3586c25e4ad2a1491d07beae5adefb231025` | 2026-07-22T02:00:00.000Z | PASS |
| 09-downloads-started.png | UNCHANGED | `eb178566f740e55106dc9153280e4739c169b17ed91fb5abba6e23106c8cebec` | 2026-07-22T02:00:00.000Z | PASS |

## Document Generation

| Artifact | Canonical path | Result | Bytes | SHA-256 | Generation | Pages | Metadata |
|---|---|---|---:|---|---|---:|---|
| DOCX | docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx | UPDATED | 3608829 | `2349af8e385c4239a90663a8096accd979f0208638fe94f2d7430d6c84153828` | PASS | n/a | PASS |
| PDF | docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf | UPDATED | 1325931 | `b64a98d0f46c324485b43c0f55e1d6fc8264e1ded8c7af0bd2fe949b7dffd419` | PASS | 17 | PASS |

- Observed determinism contract: DOCX may be byte-identical across unchanged runs.
- LibreOffice PDF bytes may vary despite equivalent validated content.

## Validation

| Stage | Status | Code | Message | Remediation | Evidence |
|---|---|---|---|---|---|
| docx | PASS | DOCX_VALID | DOCX structure, metadata, relationships, and media are valid. | No action required. | mediaCount=10 |
| markdown | PASS | MARKDOWN_VALID | Canonical Markdown metadata, links, screenshots, and hashes are valid. | No action required. | none |
| pdf | PASS | PDF_VALID | PDF structure and Poppler metadata are valid. | No action required. | encrypted=false, pageSize="A4", pages=17 |
| render | PASS | RENDER_COMPLETE | All 17 PDF pages rendered successfully. | No action required. | height=1123, width=794 |
| visual | WARN | VISUAL_EDGE | The intentional full-bleed navy cover reaches the page edge. | Retain human review for the cover and changed layouts. | edgeRatio=1, page=1 |

## Cleanup and Safety

- Temporary directories: removed
- Remaining documentation server processes: 0
- Remaining LibreOffice processes: 0
- Remaining Poppler processes: 0
- Occupied documentation ports: 0
- Write boundary: PASS
- Runtime integrity: PASS

## Human Review

Automated heuristics detect obvious corruption only; human visual review remains required for changed screenshots and changed document layouts.

Pages 1, 8 and 17 were inspected manually; no clipping, distortion or legibility issue was found.

## Final Decision

**WARN** — All structural checks passed; the intentional full-bleed navy cover requires human review.
