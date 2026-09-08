# Waiver & Disclosure Workflow — Research Document

**Date:** 08/09/2026  
**Application:** Sales Appointment Capture v2.7.0-alpha.1  
**Status:** Research Complete — No Authoritative Template Found

---

## 1. Authoritative Template Location

**RESULT: NOT FOUND**

The repository was searched exhaustively for:
- `waiver`, `Waiver`, `disclosure`, `Disclosure`
- PDF/DOCX templates in `templates/`
- Historical waiver-generation code
- Form field maps
- Signature overlays

**No authoritative Waiver & Disclosure source document exists in this codebase.**

The only "disclosure" references found relate to progressive disclosure UI patterns (collapsible sections), not a legal waiver document.

**Action Required:** Product must provide the authoritative Waiver & Disclosure PDF/DOCX template before implementation can proceed. This research document assumes a standard two-client waiver structure based on the existing Client 1 / Client 2 conventions in the application.

---

## 2. Field Inventory (Assumed — Pending Template)

Since no template exists, the following is a **proposed field map** based on:
- Existing Client 1 / Client 2 structure
- IA form field patterns (closest analogous document)
- Standard Australian waiver/disclosure conventions

| Field Name | Page | Type | Required | Client | Source in App | Output Location | Signature | Date | Initials | Checkbox |
|------------|------|------|----------|--------|---------------|-----------------|-----------|------|----------|----------|
| Client 1 Full Name | 1 | Text | Yes | Client 1 | `clientName` | Waiver PDF | — | — | — | — |
| Client 1 Signature | 1 | Canvas | Yes | Client 1 | `signature` | Waiver PDF | ✓ | — | — | — |
| Client 1 Date | 1 | Date | Yes | Client 1 | `date` / waiver-specific | Waiver PDF | — | ✓ | — | — |
| Client 2 Full Name | 1 | Text | No* | Client 2 | `client2Name` | Waiver PDF | — | — | — | — |
| Client 2 Signature | 1 | Canvas | No* | Client 2 | `signature2` | Waiver PDF | ✓ | — | — | — |
| Client 2 Date | 1 | Date | No* | Client 2 | `date` / waiver-specific | Waiver PDF | — | ✓ | — | — |
| Witness Name | 1 | Text | Yes | Shared | Staff / `teamMember` | Waiver PDF | — | — | — | — |
| Witness Signature | 1 | Canvas | Yes | Shared | Staff signature (new) | Waiver PDF | ✓ | — | — | — |
| Witness Date | 1 | Date | Yes | Shared | `date` | Waiver PDF | — | ✓ | — | — |
| Disclosure Acknowledgment | 1 | Checkbox | Yes | Both | New field | Waiver PDF | — | — | — | ✓ |
| Property Address | 1 | Text | Yes | Shared | `propertySaleAddress` | Waiver PDF | — | — | — | — |
| Appointment Date | 1 | Date | Yes | Shared | `date` | Waiver PDF | — | ✓ | — | — |

*Client 2 fields required only if Client 2 name is entered.

**Static text vs user-entered:** The waiver document body (legal text) is static template content. Only the fields above are user-entered.

---

## 3. Signature Map (Assumed)

| Signature | Role | Canvas Source | Applied To |
|-----------|------|---------------|------------|
| Signature 1 | Client 1 | Existing `sig` canvas | Waiver page |
| Signature 2 | Client 2 | Existing `sig2` canvas | Waiver page (if Client 2 present) |
| Witness | Staff | **New canvas required** | Waiver page |

---

## 4. Workflow Comparison

| Aspect | In-Person + Waiver | Zoom + Waiver | Waiver Only |
|--------|-------------------|---------------|-------------|
| Entry | Landing → In-Person → checkbox | Landing → Zoom → checkbox | Landing → Waiver & Disclosure |
| Timeline | 7 steps + conditional Waiver stage | 8 steps + conditional Waiver stage | **Simplified 3-step workflow** |
| Client 1 | Required | Required | Required |
| Client 2 | Optional | Optional | Optional |
| EOI/IA | Optional (existing) | Optional (existing) | **Hidden** |
| ID Photos | Required (existing) | N/A | **Hidden** |
| Signatures | 1–2 (existing) + Witness | 1–2 (existing) + Witness | 1–2 + Witness |
| Output | Combined PDF + ZIP + standalone | Combined booklet + ZIP + standalone | **Single PDF only** |
| Email | Existing + waiver mention | Existing + waiver mention | **Simplified Prepare Email** |
| Offline | Full support | Full support | Full support |

---

## 5. Storage Impact

### Current Draft Shape (IndexedDB via `js/db.js`)

```javascript
{
  schemaVersion: 1,
  draft: {
    // ...existing fields...
    appointmentMode: 'inPerson' | 'zoom',
    // signatures, photos, whiteboard, etc.
  },
  created: 'ISO timestamp',
  lastSaved: 'ISO timestamp',
  expiry: 'ISO timestamp (created + 7 days)'
}
```

### Proposed Extension (Minimal, Backward-Compatible)

```javascript
// Add to draft object:
waiver: {
  included: boolean,              // true when waiver checkbox checked or waiver-only mode
  mode: 'combined' | 'standalone', // distinguishes workflow
  fields: {
    client1Name: string,
    client2Name: string,
    witnessName: string,
    disclosureAcknowledged: boolean,
    propertyAddress: string,
    appointmentDate: string,
    // waiver-specific dates if different from appointment date
    client1Date: string,
    client2Date: string,
    witnessDate: string
  },
  signatures: {
    client1: dataURL | null,
    client2: dataURL | null,
    witness: dataURL | null       // NEW: staff witness signature canvas
  }
}
```

**Migration:** No migration required. New fields default to `undefined`/`null`. Existing drafts load with `waiver: { included: false }` implicitly.

**Schema Version:** Increment to `2` in `js/db.js` to signal new structure. `loadDraft()` handles missing `waiver` gracefully.

---

## 6. Generation Impact

### PDF Pipeline Integration Points

| Integration Point | Change Required |
|-------------------|-----------------|
| `outputPlan()` | Add waiver page(s) when `waiver.included === true` |
| `drawOutputPage()` | Dispatch to new `drawWaiverPage()` renderer |
| `buildIndividualPdfs()` | Add waiver group to ZIP entries |
| `zoomOutputPlan()` | Add waiver group when enabled in Zoom mode |
| Filename generators | New `waiverPdfFileName()`, `individualWaiverFilename()` |

### Output Structure

**Combined PDF (In-Person + Waiver):**
1. EOI (if included)
2. IA (if included)
3. ID Photos
4. **Waiver & Disclosure (NEW — inserted after IA, before photos)**

**Combined PDF (Zoom + Waiver):**
1. Cover
2. First Consultation
3. Client Review
4. EOI (if included)
5. IA (if included)
6. Whiteboard (if any)
7. **Waiver & Disclosure (NEW — at end)**

**ZIP Contents (Combined):**
- All existing individual documents
- `Waiver and Disclosure - {Client Names} - {date}.pdf` (NEW)

**Standalone Waiver Only:**
- Single PDF: `{date} - {Client Names} - Waiver and Disclosure.pdf`
- **No ZIP** (unless supporting files proven necessary)

---

## 7. Email Impact

### Standalone Waiver Email

| Component | Design |
|-----------|--------|
| **To** | `CONFIG.share.to` (Natalie@sjssolutionscorp.com.au) |
| **CC** | Staff email (if configured) or `CONFIG.share.cc` fallback |
| **Subject** | `Waiver & Disclosure - {Client Names} - {Property} - {date}` |
| **Body** | Plain English: "Please find the signed Waiver & Disclosure for {Client Names} regarding {Property} dated {date}. Attach the downloaded PDF and send." |
| **Sign-off** | Staff name (`teamMember`) |
| **Attachment** | Manual — email instructs staff to attach downloaded PDF |

### Combined Appointment Email (with Waiver)

Existing email structure preserved. Add one line:
> "Waiver & Disclosure is included in this package."

---

## 8. Offline Impact

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Save waiver draft offline | ✅ Supported | Extends existing `getDraft()`/`setDraft()` |
| Reopen waiver draft offline | ✅ Supported | `waiver` object restores with draft |
| 7-day expiry | ✅ Supported | Uses existing `expiry` timestamp |
| New Appointment protection | ✅ Supported | Same 3-choice dialog applies |
| Damaged draft handling | ✅ Supported | Same quarantine/recovery logic |
| Connection status | ✅ Supported | Existing `connectionStatus` element |
| Generate PDF after reconnect | ✅ Supported | `buildPdf()` works offline with cached templates |
| Prepare Email offline | ✅ Supported | `mailto:` link constructs offline |

**No second storage system.** Waiver data lives in the same IndexedDB draft.

---

## 9. Privacy Impact

| Data Element | Sensitivity | Handling |
|--------------|-------------|----------|
| Client names | PII | Same as existing client fields |
| Signatures | Biometric/PII | Same as existing signatures (PNG data URLs) |
| Property address | PII | Same as existing property field |
| Witness name/signature | Staff PII | New — stored only in draft, cleared on handover |
| Disclosure checkbox | Low | Boolean flag |

**Confirmations:**
- ✅ 7-day draft expiry applies to waiver data
- ✅ Complete Handover and Clear Draft removes waiver data
- ✅ Logs/diagnostics remain PII-free (no waiver content in console)
- ✅ Corrupt-draft metadata excludes waiver field values

**New HIGH/CRITICAL Risks:** None identified beyond existing signature/photo storage risks.

---

## 10. Regression Risks

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Landing screen mode cards | Medium | Add third card; existing two unchanged |
| In-Person timeline | Low | Conditional stage insertion only when enabled |
| Zoom timeline | Low | Conditional stage insertion only when enabled |
| PDF generation | Medium | New `drawWaiverPage()` isolated from existing renderers |
| ZIP packaging | Low | Additional group appended to existing logic |
| Draft save/load | Low | Optional `waiver` object; defaults handle legacy |
| Email builder | Low | Additive string only |
| Offline readiness | None | Uses existing cached assets; no new templates yet |
| Service worker | None | No new cached assets until template provided |
| Validation | Medium | New `waiverReadiness()` mirrors `eoiReadiness()` pattern |

---

## 11. Open Questions

1. **Template Source:** What is the authoritative Waiver & Disclosure PDF/DOCX? (Blocking)
2. **Witness Signature:** Does staff sign as witness on the waiver? If so, need new signature canvas.
3. **Waiver-Specific Dates:** Can waiver dates differ from appointment date?
4. **Client 2 Requirement:** In Waiver Only mode, is Client 2 truly optional or required in some cases?
5. **Static Legal Text:** Does the waiver have variable clauses (checkboxes for specific disclosures)?
6. **Initials Requirements:** Any page-by-page initials required?
7. **Filename Convention:** Confirm exact format for standalone: `{date} - {Client Names} - Waiver and Disclosure.pdf`
8. **ZIP for Standalone:** Confirmed not needed unless supporting files exist?

---

## 12. Recommended Design Summary

### Landing Screen
- Add third mode card: **Waiver & Disclosure** (icon: 📋)
- Order: In-Person, Zoom, Waiver & Disclosure

### In-Person / Zoom
- Add checkbox: **Include Waiver & Disclosure** (default OFF)
- Location: Appointment Info section, near Include EOI/IA checkboxes
- When checked: reveal Waiver stage in timeline (after IA, before ID Docs)

### Waiver Only Mode
- Simplified 3-section workflow:
  1. **Client Details** (Client 1 required, Client 2 optional)
  2. **Waiver & Disclosure** (fields + signatures + witness)
  3. **Ready** (generate PDF, download, prepare email)
- No EOI, IA, ID Photos, Checklist, Whiteboard

### Timeline/UI Recommendation
**Option 1: Extra timeline stage when selected** — Recommended.
- Clear visual progress
- Consistent with existing conditional stages (EOI, IA)
- Minimal regression risk
- Mobile-friendly (collapsible timeline steps)

### Storage
- Extend IndexedDB draft with `waiver` object
- Schema version 2
- No migration logic needed (defaults handle legacy)

### Validation
- `waiverReadiness()` function mirrors `eoiReadiness()`
- Blocks final generation only (drafts can save incomplete)
- Client 2 fields required only when Client 2 name entered

---

## 13. Next Steps

1. **Product provides authoritative Waiver & Disclosure template**
2. **Map actual template fields** → replace assumed field inventory
3. **Create specification document** (`docs/superpowers/specs/2026-09-08-waiver-disclosure-workflow-design.md`)
4. **Create implementation plan** (`docs/superpowers/plans/2026-09-08-waiver-disclosure-workflow-plan.md`)
5. **Characterization tests** for template PDF field overlay (once template available)