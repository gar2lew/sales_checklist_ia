# Sales Appointment Capture user guide

The canonical content is `source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`. Screenshots in `screenshots/` contain fictional test data and are generated from the current application.

## Regenerate screenshots

The automation invokes the retained Playwright capture with an already verified local server and a temporary candidate directory:

```powershell
$env:DOCS_BASE_URL = "http://127.0.0.1:8766"
$env:DOCS_SCREENSHOT_OUTPUT = Join-Path (Get-Location) ".tmp/docs-user-guide/screenshots"
node tests/user-guide-screenshots.spec.mjs
```

The capture script never starts or stops a server and never writes directly to committed screenshots. The documentation automation owns server lifecycle and applies candidates only after the complete manifest validates.

## Build DOCX and PDF

Use the repository workspace Python runtime with `python-docx`, then run:

```powershell
python scripts/generate-sales-appointment-user-guide.py
```

LibreOffice is used for PDF export. Outputs are written to this directory:

- `ASG_Sales_Appointment_Capture_User_Guide.docx`
- `ASG_Sales_Appointment_Capture_User_Guide.pdf`

## Validate artifacts

```powershell
node tests/user-guide-artifacts.test.mjs
```

After regeneration, render and inspect every PDF page before delivery.
