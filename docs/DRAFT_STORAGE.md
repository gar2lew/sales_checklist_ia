# Draft Storage

## Draft storage model

Drafts are saved to `localStorage` under the key `salesAppointmentDraft`. They are serialised as JSON. Only one draft exists at a time — saving overwrites the previous draft.

**Functions:**
- `saveDraft()` — calls `getDraft()` to collect form state, then `JSON.stringify()` and `localStorage.setItem()`
- `loadDraft()` — reads from `localStorage`, `JSON.parse()`, then passes to `setDraft()` which populates all DOM fields
- `getDraft()` — collects all form field values, signatures, and photo data into a plain object

## What data gets saved

| Data | How | Format |
|------|-----|--------|
| All text/select/checkbox fields | Read from DOM via `getDraft()` | Key-value pairs matching field IDs |
| EOI ownership | `eoiOwnership()` helper | `"sole"`, `"joint"`, or `"common"` |
| Signature 1 | `sig.toDataURL('image/png')` | Base64 PNG data URL |
| Signature 2 | `sig2.toDataURL('image/png')` | Base64 PNG data URL (only if captured) |
| Photos (client ID + additional) | Array of `{ label, dataURL, rotation, name, client, description, isAdditional }` | Array with base64 JPEG data URLs |
| Additional docs count | `additionalDocsCount` field | Number |
| Next appointment | `formatNextAppointment()` | Formatted string like `"01/07/2026 10:00 AM"` |
| EOI ID attached flag | `eoiIdAttached` | Set to `""` (empty) |

## What does NOT get saved

- **Generated PDF blob** — `lastPdfBlob` is NOT persisted. Must regenerate after loading a draft.
- **Preview state** — `previewPageIndex` resets to 0 on draft load.
- **Template images** — IA and La Vida template images are loaded fresh from the server/service worker on each use.
- **Admin settings** — stored separately under `salesAppointmentAdminSettings`.
- **Service worker cache** — handled by the service worker independently.

## Photo / additional document storage

- **Standard photos (indices 0-3):** Client 1 ID Front, Client 1 ID Back, Client 2 ID Front, Client 2 ID Back. Labels are predefined.
- **Additional documents (indices 4+):** Stored with `isAdditional: true`, custom `label`, `client` name, and `description`.
- **Data format:** Each photo stores its `dataURL` (base64 JPEG), `rotation` (degrees), and `name` (original filename).
- **Restore:** `setDraft()` recreates `photos` array, loads images from data URLs via `loadImage()`, and calls `renderPhotoBox(i)` for each.
- **Additional doc count:** If `additionalDocsCount` is in the draft, it extends the `photos` array beyond index 3.

## Signature storage

- **Canvas source:** `sig` is 900×150px; `sig2` same dimensions
- **Export format:** `canvas.toDataURL('image/png')` → base64 PNG
- **Restore:** `setDraft()` calls `clearSig()` / `clearSig2()`, then loads the image from data URL and draws it onto the canvas with `sctx.drawImage(im, 0, 0, sig.width, sig.height)`
- **Legacy compatibility:** Drafts may have `signature2` or `eoiSignature2` — both are checked during load (`data.signature2 || data.eoiSignature2`)

## Date compatibility

- **Storage format:** Dates are stored as display strings (DD/MM/YYYY) in the draft JSON.
- **Restore logic:**
  - `eoiNextApptDate` — converted to ISO format via `formatISODate()` (this field uses `<input type="date">`)
  - `date`, `iaDate`, `eoiDate` — restored as DD/MM/YYYY display format via `formatDisplayDate()`
  - If `eoiNextApptDate` is missing but `eoiNextAppointment` string contains a date, the date is extracted and set

## Old draft compatibility

`setDraft()` handles several legacy draft formats:

1. **Missing `includeIA`** — if `includeIA` is undefined but `iaTemplate` or `iaForm` has a value, `includeIA` is set to `true`
2. **Old `iaTemplate` field** — if present but `iaForm` is missing, `iaForm` is set from `iaTemplate`
3. **Missing `includeEOI`** — if present as a string, coerced to boolean
4. **Missing `eoiTemplate`** — defaults to `"standard"`
5. **Old `eoiSignature2`** — checked alongside `signature2`
6. **Corrupt JSON** — `loadDraft()` wraps `JSON.parse()` in try/catch and shows "Draft could not be loaded." toast
7. **Missing `additionalDocsCount`** — defaults to 0 if not present
8. **Old `iaProperty` → `eoiSaleAddress`** — if `eoiSaleAddress` is undefined but `iaProperty` has a value, it's copied

## localStorage size limitations

- **Typical browser limit:** ~5-10 MB per origin
- **Draft size:** Varies significantly based on attached photos. Each photo as a data URL is ~1-3 MB for a typical smartphone photo.
- **Risk:** Drafts with 4+ full-resolution photos can exceed localStorage quota.
- **Mitigation:** `saveDraft()` wraps in try/catch. If quota is exceeded, user sees: "Draft could not be saved. Photos may be too large for browser storage."
- **No automatic compression** of photos in drafts. Photos are stored at original resolution as data URLs.

## Recovery behaviour

- **Corrupt JSON:** Caught in `loadDraft()` try/catch. Shows error toast. Form state remains unchanged.
- **Quota exceeded:** Caught in `saveDraft()` try/catch. Shows error toast. Previous draft (if any) is NOT overwritten — `setItem` fails before replacing.
- **Missing fields in old draft:** Defaulted to empty strings or `false`. Form renders with partial data.
- **Photo load failure:** Individual photo `loadImage()` failures don't block draft loading. Failed photos are set to `{ img: null }` and shown as empty photo boxes.
- **No backup mechanism** — only one draft slot. Saving overwrites irreversibly.
