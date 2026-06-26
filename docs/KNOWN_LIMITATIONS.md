# Known Limitations

## Current limitations

### PDF output limitations

- **Text is not selectable.** All PDF pages are rendered as JPEG images embedded in a PDF container. There is no text layer, so users cannot search, copy, or select text in the generated PDF.
- **No embedded fonts.** All text uses system fonts (Arial) rendered to canvas. The PDF contains no font data.
- **Colour fidelity.** JPEG compression at quality 0.78 (compressed) or 0.92 (full) introduces some colour loss. This is acceptable for screen viewing and printing but may not match the original template exactly.
- **Fixed page size.** All pages are A4 (595.28 × 841.89 points). No support for US Letter or other page sizes.
- **IA coordinate calibration.** Overlay text positions on IA forms are calibrated to specific template images. If templates change, coordinates must be manually re-measured and updated in the code.
- **La Vida field coordinates.** All `laVidaFieldRects` entries are hardcoded. Template PDF changes require coordinate recalibration.
- **Line truncation.** Overlay fields with long text may be truncated with "..." if text exceeds available width or max lines. No automatic line-wrapping beyond configured `maxLines`.

### Browser limitations

- **Web Share API requires HTTPS.** On HTTP or `file://` origins, `navigator.share()` either fails with `AbortError: Share failed` or hangs indefinitely. The app has a 2500ms timeout fallback.
- **Desktop Firefox** does not implement `navigator.share()`. Falls back to download + mailto.
- **Desktop Safari** implements `navigator.share()` but not `navigator.canShare()`. Falls back to download + mailto.
- **mailto: cannot attach files.** The `mailto:` protocol has no mechanism for file attachments. The fallback path tells users to attach the downloaded PDF manually.
- **`window.open()` popup blocker.** Browsers block `window.open()` called asynchronously (after `await`). The app opens the mailto link synchronously before the async share attempt to work around this.
- **`URL.createObjectURL()` memory.** Created blob URLs are revoked after 1000ms in `downloadBlob()`. Long-lived blob URLs could accumulate if not cleaned up.

### localStorage limitations

- **Quota: ~5-10 MB per origin.** Drafts with multiple full-resolution photos can exceed this. `saveDraft()` wraps in try/catch and shows an error toast on quota exceeded.
- **Single draft slot.** Only one draft is stored at a time. Saving overwrites the previous draft irreversibly. No draft history or versioning.
- **No cross-device sync.** Drafts are stored in `localStorage` on the device. No cloud backup or multi-device sync.
- **Settings are device-local.** Admin settings changes on one device do not propagate to other devices. Each device must be configured separately (or import settings JSON).
- **Session-only admin unlock.** The admin PIN unlock persists only for the browser session. Closing the browser re-locks settings.

### Template limitations

- **La Vida template is a static JPEG.** The original La Vida PDF was rasterised to JPEG. Any changes to the La Vida template require re-rasterising and replacing the image files.
- **IA template images must be pre-rasterised.** The app expects pre-rendered image files for IA forms. It cannot render native PDF templates.
- **No dynamic template fetching.** Template images are loaded from hardcoded paths. Adding templates requires updating the source code.

### UI/UX limitations

- **No undo.** Most actions (clear signature, remove photo, reset form) have confirmation dialogs, but there is no multi-step undo.
- **Signature quality.** The signature canvas is 900×150px. Very fine pen strokes may appear pixelated in the generated PDF.
- **No zoom on photo pages.** Photos are fitted to the PDF page. Large photos may lose detail when scaled down.
- **No dark mode.** The app has a fixed light theme.
- **No multi-language support.** All UI text and email templates are hardcoded in English.
- **No print-optimised layout.** The web UI is designed for form entry, not for printing. Use the generated PDF for printing.

### Edge cases

- **Very long client names** (e.g. "Alexandra Elizabeth Montgomery-Jones") may exceed the filename segment limit (80 chars in `safePart()`) or the name merge threshold (40 chars). The filename is truncated or uses only the first client name.
- **Long property addresses** in overlay fields may be truncated. The IA property field is restricted to 1 line with aggressive font shrinking (minSize 7.2).
- **Extremely large photos** (e.g. 50 MP smartphone photos) may cause `canvas.toDataURL()` to fail or the browser to run out of memory. No pre-scaling is applied to uploaded photos.
- **Many additional documents.** Each additional document adds a page. Very large PDFs (50+ pages) may be slow to generate and large to download.
- **Offline service worker caching.** The service worker caches app assets. Template image updates require a cache version bump to propagate to clients.
