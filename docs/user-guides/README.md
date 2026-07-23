# Sales Appointment Capture user guide automation

The canonical guide content is
`source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`. The nine screenshots under
`screenshots/` use fictional test data. Generated DOCX and PDF files are written
to this directory.

## Prerequisites

- Node.js 18 or newer and the repository dependencies, including Playwright
  Chromium.
- Python with `python-docx` and Pillow. Discovery order is `DOCS_PYTHON`,
  `python`, then Windows `py -3`.
- LibreOffice. On Windows the automation supports the direct `soffice.com`
  launcher.
- Poppler `pdfinfo` and `pdftoppm`. Set `DOCS_PDFINFO` and
  `DOCS_PDF_RENDERER` to native executable paths when they are not on `PATH`.
- A named Git branch and clean working tree, except when running the clean
  command.

Paths containing spaces are supported. Commands invoke tools directly without
a shell; do not wrap executable paths in extra quote characters.

## Public commands

```powershell
npm run docs:user-guide
npm run docs:user-guide:capture
npm run docs:user-guide:validate
npm run docs:user-guide:clean
```

- `docs:user-guide` captures screenshots, updates generated Markdown metadata,
  generates DOCX/PDF, validates all artifacts, and updates the report and
  changelog.
- `docs:user-guide:capture` updates only content-changed screenshots and
  `screenshots.json`.
- `docs:user-guide:validate` performs read-only structural and visual-heuristic
  validation.
- `docs:user-guide:clean` removes only `.tmp/docs-user-guide/`. It is safe on a
  dirty tree and does not remove committed guide outputs.

Compatibility aliases `docs:screenshots`, `docs:validate`, and `docs:clean`
remain available.

## Generated outputs

- `ASG_Sales_Appointment_Capture_User_Guide.docx`
- `ASG_Sales_Appointment_Capture_User_Guide.pdf`
- `documentation-report.md`
- `changelog.md`
- `screenshots.json`
- `screenshots/*.png`

`Source commit` identifies the revision used to generate the guide. It is not
the later commit that records generated artifacts.

## Expected validation result

The current guide returns `WARN` because the intentional full-bleed navy cover
touches the PDF page edge. Structural validation still passes. Automated visual
heuristics do not replace a manual review of all 17 PDF pages.

## Server and cleanup behaviour

Capture reuses a server only when runtime-file fingerprints match the current
checkout. Otherwise it starts a temporary Python server on
`127.0.0.1:8766`, using the finite range through `8776` when necessary.
Pipeline-owned servers and temporary files are cleaned after success or
failure; pre-existing servers are never stopped.

Optional overrides:

```powershell
$env:DOCS_BASE_URL = "http://127.0.0.1:8766"
$env:DOCS_PORT = "8766"
$env:DOCS_PYTHON = "C:\Path\To\python.exe"
$env:DOCS_PDFINFO = "C:\Path\To\pdfinfo.exe"
$env:DOCS_PDF_RENDERER = "C:\Path\To\pdftoppm.exe"
```

## Troubleshooting

- **Dirty-tree rejection:** preserve or commit existing work, then rerun from a
  clean named branch.
- **Wrong server fingerprint:** stop or bypass the unrelated server; the
  automation will not terminate it.
- **Python import failure:** install `python-docx` and Pillow in the selected
  interpreter or set `DOCS_PYTHON`.
- **LibreOffice not found:** install LibreOffice or add its `program` directory
  to `PATH`.
- **Poppler not found:** set the two Poppler environment variables to native
  `.exe` files.
- **Playwright Chromium unavailable:** restore repository dependencies and the
  installed Chromium browser.
- **Interrupted run:** run `npm run docs:user-guide:clean`, inspect
  `git status --short`, and rerun only after the tree is clean.
