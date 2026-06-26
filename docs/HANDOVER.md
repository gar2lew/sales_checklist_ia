# Sales Appointment Capture — Developer Handover

## What the app does

A single-page offline-capable PWA for field staff to capture sales appointment details and generate client-ready PDF packs. Staff fill in client names, property details, pricing, and capture signatures and ID photos — then generate a multi-page PDF combining EOI forms, Irrevocable Authority forms, and photo pages.

**Key workflows:**
1. Fill appointment + client details
2. Optionally include Expression of Interest (Standard or La Vida Homes)
3. Optionally include Irrevocable Authority form (Perth or Brisbane)
4. Attach client ID photos and additional documents
5. Capture client signatures
6. Generate PDF (all client-side, no upload)
7. Download the PDF
8. Share via email (Web Share API or mailto fallback)

## Where the main files are

| File | Purpose |
|------|---------|
| `index.html` | Entry point — HTML structure (~630 lines). References external CSS and JS. |
| `css/app.css` | All application CSS (~480 lines). |
| `js/app.js` | All application JavaScript (~2940 lines). IIFE structure, no build step. |
| `service-worker.js` | PWA offline cache. Caches app shell assets. |
| `manifest.webmanifest` | PWA manifest for installability. |
| `vercel.json` | Vercel deployment config. |
| `icons/` | App icons and ASG company logo. |
| `lavida-template-page-1.jpg` | La Vida Homes EOI template (page 1). |
| `lavida-template-page-2.jpg` | La Vida Homes EOI template (page 2). |
| `docs/` | Developer documentation. |
| `ARCHITECTURE.md` | High-level architecture overview. |

## Current production version

**v1.5.1** (see `const APP_VERSION = '1.5.1'` in `index.html` line ~1091)
**Service worker cache:** `v1.5.1`

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

Do **not** test with `file://` protocol — the service worker and some browser APIs (Web Share) require HTTP.

## Key assets

| Asset | Path | Purpose |
|-------|------|---------|
| ASG logo | `icons/asg_logo.png` | App header and PDF page top-right corner |
| App icon 192 | `icons/icon-192.png` | PWA icon and favicon |
| App icon 512 | `icons/icon-512.png` | PWA splash screen |
| IA form images | Loaded via `iaImageSources` | Background templates for IA pages |
| La Vida template page 1 | `lavida-template-page-1.jpg` | EOI page 1 for La Vida Homes |
| La Vida template page 2 | `lavida-template-page-2.jpg` | EOI page 2 for La Vida Homes |

## Known external dependencies

- **None.** The app has zero external JavaScript dependencies. All functionality is vanilla JS.
- Browser APIs used: `canvas`, `Blob`, `File`, `URL.createObjectURL`, `localStorage`, `navigator.share`, `navigator.canShare`, Service Worker, `Cache API`.

## How staff use it (high-level)

1. Open the URL (desktop, tablet, or phone).
2. Fill in the appointment date, team member name, and client details.
3. Tick "Include EOI form" and/or "Include IA form" as needed.
4. Fill in sale details, pricing, and ownership information.
5. Attach client ID photos by tapping/clicking photo boxes.
6. Capture signatures on the signature canvases.
7. Click "Generate PDF" to produce the final PDF.
8. Click "Download PDF" to save, or "Share PDF" to email.

## What should NOT be changed casually

- **PDF page order** — handled by `outputPlan()` and `drawOutputPage()`. Any reordering changes the IA/EOI/photo sequence staff expect.
- **PDF rendering** — `makePDF()`, `drawIAPage()`, `drawStandardEoiPage()`, `drawLaVidaEoiPage()`. These use precise coordinates mapped to template images.
- **Service worker strategy** — cache-first for assets, network-first for navigation. Changing this can break offline support or cause stale versions.
- **Storage keys** — `salesAppointmentDraft` and `salesAppointmentAdminSettings` in localStorage. Changing these loses all user data.
- **EOI_BUILDERS registry** — the dispatch pattern in `outputPlan()` and `drawOutputPage()`. Adding builders is safe; changing the interface is not.
- **Share email recipients** — hardcoded in `CONFIG.share`. Changing without notifying staff causes email routing failures.
- **IA overlay coordinates** — `whiteOut()` and `drawTemplateLineValue()` positions in `drawIAPage()`. These are calibrated to specific template images.
