# Sales Appointment Capture user guide

The canonical content is `source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md`. Screenshots in `source/screenshots/` contain fictional test data and are generated from the current application.

## Regenerate screenshots

From the repository root, with Playwright available:

```powershell
node tests/user-guide-screenshots.spec.mjs
```

The script uses an existing server at `http://localhost:8766` when available. Otherwise, it starts and stops its own temporary local server.

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
