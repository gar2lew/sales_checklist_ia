# CRM Integration Notes

> These notes are preparatory. No CRM code has been written yet.
> The standalone PWA remains the single source of truth.

## Recommended integration approach: Native React component

**Do NOT use an iframe.** The standalone app is a single-file IIFE with ~30 functions that read from the DOM and global variables. Porting these to TypeScript modules that accept a `formData` object gives us:

- Full type safety
- Direct React state management
- Reuse of CRM auth, Firestore, and UI components
- No `postMessage` bridge complexity

## Why native React module is preferred over iframe

| Concern | iframe approach | Native React approach |
|---------|----------------|----------------------|
| Data pre-fill | Requires `postMessage` bridge | Direct prop passing to React components |
| PDF blob extraction | Requires `postMessage` with Blob serialisation | Direct return value from builder function |
| Auth | Iframe runs in its own context, needs separate auth | Reuses CRM auth context |
| Styling | Iframe is isolated, can't use CRM theme | Native Tailwind/CSS variables |
| Error handling | Cross-origin errors opaque | Standard React error boundaries |
| Bundle size | Duplicate static assets | Shared assets from CRM |
| Maintenance | Two separate codebases | Single codebase |

## Which functions should be ported first

These are the **zero-DOM-dependency** functions from `index.html` that can be extracted as pure TypeScript modules:

### Phase 1: Core PDF pipeline (highest priority)

| Function | Section | Dependencies | Effort |
|----------|---------|-------------|--------|
| `makePDF()` | N | `dataURLToBytes()` | Low |
| `dataURLToBytes()` | N | None | Low |
| `outputPlan()` | N | `EOI_BUILDERS`, checkbox state | Low |
| `drawPageFrame()` | K | `drawSmallPageLogo()`, `drawGeneratedFooter()` | Low |
| `drawSmallPageLogo()` | J | `pageLogoImage` | Low |
| `drawGeneratedFooter()` | K | `generatedFooterText()`, `APP_VERSION` | Low |
| `generatedFooterText()` | K | `APP_VERSION`, `formatDisplayDateTime()` | Low |
| `drawLineValue()` | K | `wrapText()` | Low |
| `wrapText()` | K | None | Low |
| `drawRoundRect()` | K | None | Low |
| `drawImageContain()` | K | None | Low |
| `drawPhotoPage()` | K | `drawPageFrame()`, `drawRoundRect()`, `drawImageContain()` | Medium |
| `formatPrice()` | K | None | Low |
| `drawStandardEoiPage()` | M | Many helpers | High |
| `drawLaVidaEoiPage()` | M | `laVidaFieldRects`, many helpers | High |
| `drawIAPage()` | L | `whiteOut()` (nested), coordinate helpers | High |
| `buildPdf()` | N | All of the above | Medium (orchestration) |

### Phase 2: Validation

| Function | Section | Effort |
|----------|---------|--------|
| `validateBeforePdf()` | B | Medium |
| `requireField()` | B | Low |
| `requireValidDate()` | B | Low |

### Phase 3: Share/email

| Function | Section | Effort |
|----------|---------|--------|
| `buildShareEmailContent()` | O | Low |
| `formatDisplayDate()` | K | Low (may already exist in CRM `lib/dates.ts`) |

## Suggested TypeScript modules

```
src/lib/
  appointmentPack/
    config.ts          — CONFIG object, EOI_BUILDERS registry, constants
    types.ts           — AppointmentPackFormData, PhotoData, etc.
    validation.ts      — validateBeforePdf, requireField, requireValidDate
    pdf/
      primitives.ts    — drawPageFrame, drawLineValue, wrapText, drawRoundRect, drawImageContain
      footer.ts        — generatedFooterText, drawGeneratedFooter
      logo.ts          — drawSmallPageLogo, ensurePageLogo
      standardEoi.ts   — drawStandardEoiPage, drawEoiPage
      laVidaEoi.ts     — drawLaVidaEoiPage, laVidaFieldRects, helpers
      iaPage.ts        — drawIAPage
      photoPage.ts     — drawPhotoPage
      pipeline.ts      — outputPlan, drawOutputPage, makePDF, buildPdf
    share.ts           — buildShareEmailContent
```

## Static assets required

Copy these from the standalone app to the CRM's `public/` directory:

```
public/
  appointment-pack/
    templates/
      lavida-template-page-1.jpg
      lavida-template-page-2.jpg
      ia-perth.jpg         # if extracted from iaImageSources
      ia-brisbane.jpg      # if extracted from iaImageSources
  icons/
    asg_logo.png           # already exists in CRM
```

Add to `firebase.json` rewrites if needed for clean URLs.

## Firestore collection design

**Collection:** `appointmentPacks` (root-level)

```typescript
interface AppointmentPack {
  id: string;
  clientId: string;           // FK to leads collection
  clientNames: string;
  propertySaleAddress: string;
  appointmentDate: string;    // ISO date
  formsIncluded: string;      // "EOI+IA" | "EOI" | "IA" | "PDF"
  eoiTemplate?: string;       // "standard" | "laVidaHomes"
  pdfFileName: string;
  pdfStoragePath: string;     // Firebase Storage path
  pdfDownloadUrl?: string;    // Generated signed URL
  createdBy: string;          // Rep ID
  staffName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: "draft" | "generated" | "shared";
}
```

**Indexes:**
- `clientId` ASC + `createdAt` DESC
- `createdBy` ASC + `createdAt` DESC

## Firebase Storage path design

```
clients/{clientId}/appointment-packs/{packId}/{fileName}
```

Example:
```
clients/abc123/appointment-packs/xyz789/Sales_Appointment_-_01-07-2026_-_John_Smith_-_G_Lewington.pdf
```

**Rules:**
- Read: any authenticated user
- Write: any authenticated user
- Delete: admin only

## Client profile UI concept

Add an **"Appointment Packs"** tab to `ClientProfilePage.tsx`:

```tsx
{ key: "appointment-packs", label: "Appointment Packs", icon: ClipboardCheck }
```

The tab renders a list of existing packs with:
- Date, client names, forms included, template used
- Download button (generates signed URL from Storage)
- Share/email button

A "New Appointment Pack" button opens `AppointmentPackForm` in a full-screen modal, pre-filled from CRM client data.

## Appointment pack metadata schema

Saved alongside the Storage file as Firestore document metadata. Allows querying packs by client, date, or creator without needing to read Storage.

## Share / email workflow inside CRM

1. Staff clicks Share on a pack
2. CRM generates a signed download URL from Firebase Storage
3. Attempts Web Share API with the file (if supported)
4. Falls back to `mailto:` link with To/CC/subject/body + triggers download
5. Updates pack `status` to `"shared"` and `updatedAt`

## Staged rollout plan

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| 1. Foundation | 1-2 weeks | PDF pipeline ported to TypeScript, Firestore schema, storage rules |
| 2. UI Integration | 1 week | AppointmentPackForm, client profile tab, data pre-fill, upload flow |
| 3. Share & Polish | 1 week | Share/email workflow, download, status badges, error states |
| 4. Standalone deprecation decision | Post-launch | Monitor CRM vs standalone usage |

## Risks

| Risk | Mitigation |
|------|-----------|
| PDF output differs between standalone and CRM | Side-by-side comparison tests with identical form data |
| Template images not served correctly | Verify asset paths during build; add to `firebase.json` rewrites |
| Signature canvas broken in React lifecycle | Wrap in `useEffect` with proper cleanup |
| Large PDF blobs cause browser memory issues | Stream upload via `uploadBytesResumable` |
| Staff confusion about two parallel systems | Keep standalone as backup; add in-app guidance |
| Canvas-based text not selectable in PDF | Accepted limitation; document in known limitations |
