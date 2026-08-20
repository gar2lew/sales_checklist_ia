# Sales Appointment Capture — Developer Handover

## What the app does

A single-page offline-capable PWA for field staff to capture sales appointment details and generate client-ready PDF packs. Staff fill in client names, property details, pricing, and capture signatures and ID photos — then generate a multi-page PDF combining EOI forms, Irrevocable Authority forms, and photo pages.

**Two appointment modes:**

**In-person (original workflow):**
1. Fill appointment + client details
2. Optionally include Expression of Interest (Standard or La Vida Homes)
3. Optionally include Irrevocable Authority form (Perth or Brisbane)
4. Attach client ID photos and additional documents
5. Capture client signatures
6. Generate PDF (all client-side, no upload)
7. Download the PDF
8. Share via email (Web Share API or mailto fallback)

**Zoom / Online (v2.0+):**
1. Landing screen — select appointment type and staff member
2. Fill shared Section 1 (appointment + client details)
3. Complete First Consultation form (goals, financial snapshot, notes)
4. Complete Client Review / Assessment (strategy, recommendations, timeline)
5. Select Appointment Outputs (Standard EOI, La Vida EOI, IA)
6. Generate compiled booklet with cover page, consultation pages, and optional forms
7. Download compiled PDF or Package (ZIP with individual documents)
8. Share via email

## Where the main files are

| File | Purpose |
|------|---------|
| `index.html` | Entry point — HTML structure (~670 lines). References external CSS and JS. |
| `css/app.css` | All application CSS (~540 lines). |
| `js/app.js` | All application JavaScript (~3650 lines). IIFE structure, no build step. |
| `service-worker.js` | PWA offline cache. Caches app shell assets. |
| `manifest.webmanifest` | PWA manifest for installability. |
| `vercel.json` | Vercel deployment config. |
| `icons/` | App icons, ASG company logo, landing screen image. |
| `icons/landing.png` | Landing screen hero image. |
| `lavida-template-page-1.jpg` | La Vida Homes EOI template (page 1). |
| `lavida-template-page-2.jpg` | La Vida Homes EOI template (page 2). |
| `docs/` | Developer documentation. |

## Current production version

**v2.2.1-alpha.1** (see `const APP_VERSION` in `js/app.js` line 9)
**Service worker cache:** `v2.2.1-alpha.1`

## Deployment flow

1. Push to `main` branch on GitHub (`gar2lew/sales_checklist_ia`)
2. Vercel auto-deploys from `main`
3. Static file hosting, no build step
4. Service worker cache version must be bumped with each deploy to force clients to refresh

## Local testing flow

```bash
# Serve locally (Python or npx)
npx http-server -p 8765 -c-1

# Open browser at http://127.0.0.1:8765
# Test: fill form, generate PDF, download, share
```

Do **not** test with `file://` protocol — the service worker, some browser APIs (Web Share), and localStorage require HTTP. Use an HTTP server for testing.

## Key assets

| Asset | Path | Purpose |
|-------|------|---------|
| ASG logo | `icons/asg_logo.png` | App header and PDF page top-right corner |
| Landing image | `icons/landing.png` | Landing screen hero image |
| App icon 192 | `icons/icon-192.png` | PWA icon and favicon |
| App icon 512 | `icons/icon-512.png` | PWA splash screen |
| IA form images | Loaded via `iaImageSources` | Background templates for IA pages |
| La Vida template page 1 | `lavida-template-page-1.jpg` | EOI page 1 for La Vida Homes |
| La Vida template page 2 | `lavida-template-page-2.jpg` | EOI page 2 for La Vida Homes |

## Known external dependencies

- **None.** The app has zero external JavaScript dependencies. All functionality is vanilla JS.
- Browser APIs used: `canvas`, `Blob`, `File`, `URL.createObjectURL`, `localStorage`, `navigator.share`, `navigator.canShare`, Service Worker, `Cache API`.

## How staff use it (high-level)

### In-person mode
1. Open the URL → landing screen appears.
2. Select "In-person Appointment", enter your name, click Continue.
3. Fill in the appointment date, team member name, and client details.
4. Tick "Include EOI form" and/or "Include IA form" as needed.
5. Fill in sale details, pricing, and ownership information.
6. Attach client ID photos by tapping/clicking photo boxes.
7. Capture signatures on the signature canvases.
8. Click "Generate PDF" to produce the final PDF.
9. Click "Download PDF" to save, or "Share PDF" to email.
10. Click "New Appointment" to clear and start over.

### Zoom mode
1. Open the URL → landing screen appears.
2. Select "Zoom / Online Appointment", enter your name, click Continue.
3. Complete Section 1 (appointment + client details).
4. Complete Section 2 (First Consultation — goals, financial snapshot, notes).
5. Complete Section 3 (Client Review — strategy, builders, professionals, timeline).
6. Select output documents in Section 4 (Appointment Outputs).
7. Click "Generate PDF" to produce the compiled booklet.
8. Click "Download PDF" for the compiled booklet, or "Download Package" for the ZIP.
9. Click "Change Type" to switch modes (data stays in memory).
10. Click "New Appointment" to clear and return to landing.

## What should NOT be changed casually

- **PDF page order** — handled by `outputPlan()` and `drawOutputPage()`. Any reordering changes the IA/EOI/photo sequence staff expect. For zoom mode, page order is handled by `zoomOutputPlan()`.
- **PDF rendering** — `makePDF()`, `drawIAPage()`, `drawStandardEoiPage()`, `drawLaVidaEoiPage()`, `drawZoomCover()`, `drawZoomFirstConsult()`, `drawZoomClientReview()`. These use precise coordinates mapped to template images.
- **Service worker strategy** — cache-first for assets, network-first for navigation. Changing this can break offline support or cause stale versions.
- **Storage keys** — `salesAppointmentDraft` and `salesAppointmentAdminSettings` in localStorage. Changing these loses all user data.
- **EOI_BUILDERS registry** — the dispatch pattern in `outputPlan()` and `drawOutputPage()`. Adding builders is safe; changing the interface is not.
- **Share email recipients** — hardcoded in `CONFIG.share`. Changing without notifying staff causes email routing failures.
- **IA overlay coordinates** — `whiteOut()` and `drawTemplateLineValue()` positions in `drawIAPage()`. These are calibrated to specific template images.
- **Landing screen selector** — `appointmentMode` state variable controls which workflow is active. Changing this affects the entire user flow.
- **ZoomDefaults** — `zoomDefaults.builders`, `zoomDefaults.developers`, `zoomDefaults.timeline` are internal arrays. They should migrate to Admin Settings in a future release.
