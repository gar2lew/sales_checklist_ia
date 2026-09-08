# Waiver & Disclosure Workflow — Research Document

**Date:** 08/09/2026  
**Application:** Sales Appointment Capture v2.7.0-alpha.1  
**Status:** Research Complete — Authoritative Template Verified

---

## 1. Authoritative Template Location

**FOUND:** `templates/ASG-Disclosure-Waiver-2026.pdf`

**SHA-256:** `1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB`

**Verified Properties:**
- **Page count:** 6 pages
- **Page dimensions:** 595.32 × 841.92 points (A4)
- **Rotation:** 0° (all pages)
- **AcroForm:** **No** — static/flattened PDF (created from Microsoft Word)
- **XFA:** No
- **Signatures:** No embedded signature fields
- **Form widgets:** None — uses underscore lines for fill-in fields
- **Text extraction:** Works — all legal text extractable
- **Embedded fonts:** Yes (subset fonts from Word)

---

## 2. Verified Field Inventory

The **actual completion fields visible in the source document** (page 6 only):

| Logical Name | Source Label | Page | X (pts) | Y (pts) | Width (pts) | Height (pts) | Type | Client | Required | Value Source | Validation |
|--------------|--------------|------|---------|---------|-------------|--------------|------|--------|----------|--------------|------------|
| `client1Name` | CLIENT'S NAME | 6 | 59 | 599.71 | ~301 | 9.48 | Text | Client 1 | Yes | `clientName` | Non-empty |
| `client1Signature` | CLIENT'S SIGNATURE | 6 | 59 | 537.55 | ~307 | 9.48 | Signature | Client 1 | Yes | `signature` canvas | Non-empty canvas |
| `client1Date` | DATE | 6 | 54 | 475.51 | ~116 | 9.48 | Date | Client 1 | Yes | `date` / waiver-specific | DD/MM/YYYY format |

**Fields NOT present in the PDF (remove all prior assumptions):**
- ❌ Witness name / Witness signature / Witness date
- ❌ Property address field
- ❌ Appointment date field (separate from signing date)
- ❌ Disclosure acknowledgement checkbox
- ❌ Client 2 fields (PDF has only ONE signing block)
- ❌ Initials fields
- ❌ Any other invented fields

**Static text vs user-entered:** Pages 1–5 contain only legal wording (clauses 1–17). Page 6 contains clause 18 (acknowledgement) plus the three fill-in lines above. All legal text is static template content.

---

## 3. Verified Signature Map

| Signature ID | Role | Page | X (pts) | Y (pts) | Width (pts) | Height (pts) | Source Canvas | Required |
|--------------|------|------|---------|---------|-------------|--------------|---------------|----------|
| `client1Signature` | Client 1 | 6 | 59 | 537.55 | ~307 | ~18* | Existing `sig` (900×150) | Yes |

*Signature line height estimated from font size; actual rendered signature scales to fit the underscore line.

**No witness signature field exists in the template.**

---

## 4. Client 2 Signing Design Options

The source PDF contains **one** acknowledgement/signature block. Client 2 is optional in the application. Three options evaluated:

### Option A: Second block on page 6 (Recommended)
- **Placement:** Below Client 1 block, above footer
- **Page:** 6 (same page)
- **Labels:** "CLIENT 1 NAME", "CLIENT 1 SIGNATURE", "CLIENT 1 DATE" / "CLIENT 2 NAME", "CLIENT 2 SIGNATURE", "CLIENT 2 DATE"
- **Space available:** ~445 pts from Date (y=475) to footer (y=30) — sufficient for one more ~125pt block
- **Legal text:** Unchanged — clause 18 says "I, the Client" (singular), but clause 17.5 addresses multiple clients: "If a party comprises two or more persons, the covenants... bind them jointly and each severally"
- **Visual clarity:** Both clients visible on same page when printed
- **Implementation risk:** Low — same page, same coordinate system
- **Combined PDF:** Single waiver page with both blocks

### Option B: Continuation page (page 7)
- **Placement:** New page 7 with Client 2 block
- **Legal text:** Would need to repeat clause 18 or reference page 6
- **Visual clarity:** Client 2 on separate page
- **Implementation risk:** Medium — new page generation, merge logic
- **Combined PDF:** Two waiver pages

### Option C: Two separate waiver documents
- **Placement:** Two PDFs, one per client
- **Legal text:** Each client signs their own copy
- **Visual clarity:** Separate documents
- **Implementation risk:** High — dual generation, naming, ZIP packaging
- **Combined PDF:** Two separate waiver PDFs in ZIP

**Recommendation: Option A** — lowest risk, preserves legal text integrity, single-page output, consistent with clause 17.5 (joint and several liability).

---

## 5. Workflow Comparison (Verified)

| Aspect | In-Person + Waiver | Zoom + Waiver | Waiver Only |
|--------|-------------------|---------------|-------------|
| Entry | Landing → In-Person → checkbox | Landing → Zoom → checkbox | Landing → Waiver & Disclosure |
| Timeline | 7 steps + conditional Waiver stage | 8 steps + conditional Waiver stage | **Simplified 3-step workflow** |
| Client 1 | Required | Required | Required |
| Client 2 | Optional | Optional | Optional |
| EOI/IA | Optional (existing) | Optional (existing) | **Hidden** |
| ID Photos | Required (existing) | N/A | **Hidden** |
| Signatures | Client 1 (+ Client 2 if present) | Client 1 (+ Client 2 if present) | Client 1 (+ Client 2 if present) |
| Output | Combined PDF + ZIP + standalone | Combined booklet + ZIP + standalone | **Single PDF only** |
| Email | Existing + waiver mention | Existing + waiver mention | **Simplified Prepare Email** |
| Offline | Full support | Full support | Full support |

---

## 6. Storage Impact

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
    client1Name: string,          // from clientName
    client2Name: string,          // from client2Name (optional)
    client1Date: string,          // signing date (DD/MM/YYYY)
    client2Date: string           // signing date (optional, when Client 2 present)
  },
  signatures: {
    client1: dataURL | null,      // existing `sig` canvas
    client2: dataURL | null       // existing `sig2` canvas (when Client 2 present)
  }
}
```

**Fields removed from prior assumption:** witnessName, witnessSignature, witnessDate, disclosureAcknowledged, propertyAddress, appointmentDate.

**Migration:** No migration required. New fields default to `undefined`/`null`. Existing drafts load with `waiver: { included: false }` implicitly.

**Schema Version:** Increment to `2` in `js/db.js` to signal new structure. `loadDraft()` handles missing `waiver` gracefully.

---

## 7. Generation Impact

### PDF Pipeline Integration Points

| Integration Point | Change Required |
|-------------------|-----------------|
| `outputPlan()` | Add waiver page when `waiver.included === true` |
| `drawOutputPage()` | Dispatch to new `drawWaiverPage()` renderer |
| `buildIndividualPdfs()` | Add waiver group to ZIP entries |
| `zoomOutputPlan()` | Add waiver group when enabled in Zoom mode |
| Filename generators | New `waiverPdfFileName()`, `individualWaiverFilename()` |

### Output Structure

**Combined PDF (In-Person + Waiver):**
1. EOI (if included)
2. IA (if included)
3. ID Photos
4. **Waiver & Disclosure** (page 6 template with 1 or 2 client blocks)

**Combined PDF (Zoom + Waiver):**
1. Cover
2. First Consultation
3. Client Review
4. EOI (if included)
5. IA (if included)
6. Whiteboard (if any)
7. **Waiver & Disclosure** (page 6 template with 1 or 2 client blocks)

**ZIP Contents (Combined):**
- All existing individual documents
- `Waiver and Disclosure - {Client Names} - {date}.pdf` (standalone waiver with both clients)

**Standalone Waiver Only:**
- Single PDF: `{date} - {Client Names} - Waiver and Disclosure.pdf`
- **No ZIP** (no supporting files required)

---

## 8. Email Impact

### Standalone Waiver Email

| Component | Design |
|-----------|--------|
| **To** | `CONFIG.share.to` (Natalie@sjssolutionscorp.com.au) |
| **CC** | Staff email (if configured) or `CONFIG.share.cc` fallback |
| **Subject** | `Waiver & Disclosure | {Client Names} | {date}` |
| **Body** | Plain English (see Email Design section) |
| **Sign-off** | Staff name (`teamMember`) |
| **Attachment** | Manual — email instructs staff to attach downloaded PDF |

### Combined Appointment Email (with Waiver)

Existing email structure preserved. Add one line:
> "Waiver & Disclosure: Included"

---

## 9. Offline Impact

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

**Template caching:** Add `ASG-Disclosure-Waiver-2026.pdf` to `APP_SHELL` in `service-worker.js` for offline generation.

**No second storage system.** Waiver data lives in the same IndexedDB draft.

---

## 10. Privacy Impact

| Data Element | Sensitivity | Handling |
|--------------|-------------|----------|
| Client names | PII | Same as existing client fields |
| Signatures | Biometric/PII | Same as existing signatures (PNG data URLs) |
| Signing dates | Low | Same as existing date fields |

**Confirmations:**
- ✅ 7-day draft expiry applies to waiver data
- ✅ Complete Handover and Clear Draft removes waiver data
- ✅ Logs/diagnostics remain PII-free (no waiver content in console)
- ✅ Corrupt-draft metadata excludes waiver field values

**New HIGH/CRITICAL Risks:** None identified beyond existing signature/photo storage risks.

---

## 11. Regression Risks

| Area | Risk Level | Mitigation |
|------|------------|------------|
| Landing screen mode cards | Medium | Add third card; existing two unchanged |
| In-Person timeline | Low | Conditional stage insertion only when enabled |
| Zoom timeline | Low | Conditional stage insertion only when enabled |
| PDF generation | Medium | New `drawWaiverPage()` isolated from existing renderers |
| ZIP packaging | Low | Additional group appended to existing logic |
| Draft save/load | Low | Optional `waiver` object; defaults handle legacy |
| Email builder | Low | Additive string only |
| Offline readiness | None | Uses existing cached assets; template added to APP_SHELL |
| Service worker | Low | Cache version bump for new template |
| Validation | Medium | New `waiverReadiness()` mirrors `eoiReadiness()` pattern |

---

## 12. Unresolved Product Decisions

1. **Date field:** The PDF shows "DATE: _____ / _____ / 20____" (DD/MM/YYYY). Should this be:
   - Auto-filled from appointment `date`?
   - Manually entered as signing date (may differ from appointment date)?
   - One shared date for both clients, or separate dates per client?
   - **Status:** Requires product decision

2. **Client 2 labels:** When Client 2 is present, should page 6 labels become:
   - "CLIENT 1 NAME" / "CLIENT 2 NAME" etc.?
   - Or keep "CLIENT'S NAME" and add a second block with "CLIENT 2 NAME"?
   - **Status:** Requires product decision (Option A recommended)

3. **Clause 18 wording:** "I, the Client, acknowledge..." — singular. With two clients, does this need legal review?
   - Clause 17.5 covers joint/several liability for multiple persons
   - **Status:** Legal review recommended before implementation

---

## 13. Next Steps

1. ✅ **Product provided authoritative Waiver & Disclosure template**
2. ✅ **Map actual template fields** → verified field inventory complete
3. ✅ **Update specification document** (`docs/superpowers/specs/2026-09-08-waiver-disclosure-workflow-design.md`)
4. ✅ **Update implementation plan** (`docs/superpowers/plans/2026-09-08-waiver-disclosure-workflow-plan.md`)
5. **Characterization tests** for template PDF field overlay (see plan Phase 1)
6. **Design review** with verified facts
7. **Runtime implementation** after approval