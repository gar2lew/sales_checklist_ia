# Share Workflow

## Overview

The share workflow allows staff to send generated PDFs via email. It uses the Web Share API when file sharing is supported, and falls back to downloading the PDF and opening a pre-filled `mailto:` link.

In zoom mode, the same share workflow applies to the compiled booklet PDF. **Download Package** additionally generates a ZIP containing individual documents.

## Entry points

All actions are available as buttons (top toolbar and bottom footer):

| Button | Handler | ID attributes |
|--------|---------|---------------|
| Generate PDF | `generatePdfOnly()` | `generateTop`, `generateBottom` |
| Download PDF | `downloadPdf()` | `downloadTop`, `downloadBottom` |
| Download Package | `downloadPackage()` | `downloadPackageTop`, `downloadPackageBottom` |
| Share PDF | `sharePdf()` | `shareTop`, `shareBottom` |

## Generate PDF

1. Calls `buildPdf()` which runs the full pipeline: validation, rendering, PDF assembly.
2. In zoom mode, uses `zoomOutputPlan()` for page layout and draws zoom-specific pages.
3. Calls `refreshPreview()` to update the preview panel.
4. Sets status to `"PDF ready: {filename} ({size} MB). Use Download PDF or Share PDF."`
5. Enables Download and Share buttons via `updateActionButtons()`.

## Download PDF

1. If `lastPdfBlob` is null, calls `buildPdf()` first.
2. Calls `downloadBlob(lastPdfBlob, lastPdfName || pdfFileName())` which creates a temporary anchor element with `URL.createObjectURL(blob)` and clicks it programmatically.
3. Shows toast: `"PDF download started."`
4. On validation failure: shows `"Please fix the highlighted fields."`
5. In zoom mode, the filename format is: `Sales Appointment - Zoom - {clients} - {staff} - {date}.pdf`

## Download Package

**In-person mode:**

1. Generates the compiled PDF.
2. Builds individual PDFs for each document group (EOI, IA, photos).
3. Creates a ZIP containing all individual PDFs.
4. Downloads both the compiled PDF and the ZIP.
5. ZIP filename: `{clientNames} - Separated Appointment Documents - {date}.zip`

**Zoom mode:**

1. Generates the compiled booklet PDF.
2. Builds individual PDFs for each zoom document (Cover, First Consultation, Client Review, optional EOI, optional IA).
3. Creates a ZIP with unique filenames for each document.
4. Downloads both the compiled PDF and the ZIP.
5. ZIP filename: `{clientNames} - Zoom Appointment Documents - {date}.zip`

**Individual zoom document filenames in ZIP:**

| Document | Filename |
|----------|----------|
| Compiled booklet | `Sales Appointment - Zoom - {clients} - {staff} - {date}.pdf` |
| First Consultation | `First Consultation - {clients} - {staff} - {date}.pdf` |
| Client Review | `Client Review Assessment - {clients} - {staff} - {date}.pdf` |
| Standard EOI | `EOI - {clients} - {staff} - {date}.pdf` |
| La Vida EOI | `La Vida EOI - {clients} - {staff} - {date}.pdf` |
| IA | `IA - {clients} - {staff} - {date}.pdf` |

Standard EOI and La Vida EOI use distinct filenames to avoid ZIP collisions.

## Share PDF

### Preferred path: Web Share API with files

**Conditions:** `navigator.share` exists, `navigator.canShare({ files: [...] })` returns `true`.

1. Opens a `mailto:` link synchronously (before the async share, to avoid popup blockers).
2. Calls `navigator.share({ title, text, files: [pdfFile] })` with the PDF file attached.
3. If share succeeds: closes the mailto tab and shows `"Share sheet opened."`
4. If share fails (not user cancel): keeps mailto tab open and also downloads the PDF.

**Timeout:** 2500ms (`CONFIG.share.nativeShareTimeoutMs`). If `navigator.share()` does not resolve/reject within the timeout (Chrome on HTTP), the fallback path is used.

### Fallback path: Download + mailto

**Conditions:** Web Share API is unavailable, or the native share fails/timeouts.

1. Downloads the PDF via `downloadBlob()`.
2. Opens a `mailto:` link in a new tab/window.
3. Status: `"PDF downloaded. Email draft opened; attach the PDF to send."`
4. Toast: `"PDF downloaded. Email draft opened; please attach the downloaded PDF if it is not already attached."`

### Distinguishing user cancel from platform failure

The native `navigator.share()` promise rejects with `AbortError` in two cases:
- **User cancel:** `AbortError` with no message or a message containing "cancel"
- **Platform failure:** `AbortError` with message "Share failed" (Chrome on HTTP) or timeout

User cancel → do NOT fall back (user chose not to share).
Platform failure → fall back to download + mailto.

## Default To / CC

From `CONFIG.share` (Section A of `js/app.js`):

```javascript
share: {
  to: 'Natalie@sjssolutionscorp.com.au',
  cc: 'Garry@sjssolutionscorp.com.au',
  fallbackStaffName: 'ASG Team',
  nativeShareTimeoutMs: 2500,
},
```

## Email subject / body generation

**Function:** `buildShareEmailContent()` (Section O)

**Subject format:**
```
{staffName} - Sales Appointment - {formsIncluded} Forms - {clientNames} - {propertyAddress} - {date}
```

**Body format:**
```
Hey Natalie,

Please see the PDF attached for {clientNames} - {propertyAddress} - {date}. If you need anything else, please let me know!

Regards,
{staffName}
```

**Field derivation:**
- `staffName`: `teamMember` field value, fallback `"ASG Team"`
- `clientNames`: `"Client1 & Client2"` if both present, else individual name, fallback `"Client"`
- `propertyAddress`: `propertySaleAddress` field, fallback `"Property"`
- `date`: `formatDisplayDate(date field)` in DD/MM/YYYY
- `formsIncluded`: `"EOI+IA"`, `"EOI"`, `"IA"`, or `"PDF"` based on checkbox state

In zoom mode, the same email template is used. The compiled booklet filename reflects the zoom workflow.

## Browser limitations around attachments

- **mailto: cannot attach files.** The `mailto:` protocol does not support file attachments. The fallback path tells staff to attach the downloaded PDF manually.
- **Web Share API with files requires HTTPS.** On insecure contexts (HTTP, `file://`), `navigator.share()` silently fails or hangs.
- **Desktop Firefox does not support `navigator.share()`.** Falls back to download + mailto.
- **Desktop Safari supports `navigator.share()` but not `navigator.canShare()`.** In this case, `canSharePdfFiles()` returns `false`, so the fallback path is taken.
- **Chrome on HTTP** has `navigator.share` defined but the call hangs. The 2500ms timeout ensures the fallback path activates.

## Known behaviour on desktop / mobile

| Platform | Browser | Web Share with files? | Fallback path |
|----------|---------|----------------------|---------------|
| Desktop Windows | Chrome (HTTPS) | Yes | No |
| Desktop Windows | Chrome (HTTP) | No (hangs) | Yes |
| Desktop Windows | Edge (HTTPS) | Yes | No |
| Desktop Windows | Firefox | No | Yes |
| Desktop Mac | Safari | No (`canShare` unsupported) | Yes |
| Desktop Mac | Chrome (HTTPS) | Yes | No |
| iPhone | Safari | Yes | No |
| Android | Chrome | Yes | No |

**Note:** All platforms fall back gracefully to download + mailto when file sharing is unavailable. In zoom mode, Download Package provides a ZIP as an additional option.
