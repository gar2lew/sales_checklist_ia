# Waiver & Disclosure Template Characterisation Report

**Date:** 08/09/2026  
**Application:** Sales Appointment Capture v2.7.0-alpha.1  
**Template:** `templates/ASG-Disclosure-Waiver-2026.pdf`  
**SHA-256:** `1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB`

---

## 1. Document Properties

| Property | Value |
|----------|-------|
| **File path** | `templates/ASG-Disclosure-Waiver-2026.pdf` |
| **SHA-256** | `1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB` |
| **Page count** | 6 |
| **Page dimensions** | 595.32 × 841.92 points (A4, 210 × 297 mm) |
| **Rotation** | 0° (all pages) |
| **PDF version** | 1.7 |
| **Author** | Garry Lewis |
| **Creator** | Microsoft® Word for Microsoft 365 |
| **Producer** | Microsoft® Word for Microsoft 365 |
| **Creation date** | D:20260902131556+08'00' |
| **Modification date** | D:20260903155633+08'00' |

---

## 2. Form Field Analysis

| Check | Result |
|-------|--------|
| AcroForm present | **No** |
| XFA present | **No** |
| Embedded signature fields | **No** |
| Form widgets | **None** |
| Fill-in method | Underscore lines (static text) |

**Conclusion:** The PDF is a static/flattened document created from Word. All "fields" are visual underscore lines in the text content, not interactive PDF form fields.

---

## 3. Page-by-Page Content Summary

### Pages 1–5: Legal Wording (Clauses 1–17)
- Page 1: Title, definitions (clauses 1.1–1.16), Client Company Pack description
- Page 2: Definitions continued (1.16), Client Warranties (clause 2.1–2.9)
- Page 3: No Liability (clauses 3–8), No Warranty (clauses 9–10)
- Page 4: Indemnity (clauses 11–12), No Liability for Affiliates (13–14), Payment/Commission (15–16)
- Page 5: Interpretation (clauses 17.1–17.9)

### Page 6: Acknowledgement & Signing Block (Clause 18)

**Extracted text (page 6):**
```
ASG | Waiver and Disclosure | Updated draft 02/09/2026 6
ACKNOWLEDGEMENT OF THIS WAIVER AND DISCLOSURE
18 I, the Client, acknowledge receipt of this Disclosure and Waiver, confirm that I have read and understood it, and agree
to be bound by it, subject to clause 17.9. I understand that it applies to all Appointments, whether in person, via Zoom
or through any other online or remote communication method, and to the Client Company Pack and associated
communications.
CLIENT’S NAME: ___________________________________________________
CLIENT’S SIGNATURE: _______________________________________________
DATE: _____ / _____ / 20____
```

---

## 4. Verified Field Coordinates (Page 6)

**Coordinate system:** PDF standard — origin (0,0) at bottom-left, X right, Y up. Units: points (1/72 inch).

| Logical Field | Label Text | Label X | Value X | Y (baseline) | Value Width | Font Size | Font |
|---------------|------------|---------|---------|--------------|-------------|-----------|------|
| `client1Name` | CLIENT'S NAME | 54 | 59 | 599.71 | ~301 | 9.48pt | g_d0_f1 |
| `client1Signature` | CLIENT'S SIGNATURE | 54 | 59 | 537.55 | ~307 | 9.48pt | g_d0_f1 |
| `client1Date` | DATE | 54 | 54 | 475.51 | ~116 | 9.48pt | g_d0_f1 |

**Notes:**
- The underscore lines are part of the text content (e.g., `"CLIENT'S NAME: ___________________________________________________"`)
- Value X positions indicate where the fill-in portion begins (after the label + colon + space)
- Y positions are baselines; text renders above this line
- Value widths are approximate from text measurement

---

## 5. Signature Area Analysis

| Aspect | Detail |
|--------|--------|
| **Signature line** | Underscore line at y=537.55, starting x=59, width ~307pts |
| **Aspect ratio** | Line is horizontal; height determined by font (9.48pt) |
| **Available vertical space** | ~445pts from Date (y=475) to footer (y=30) |
| **Client 2 block capacity** | One full block (~125pts height) fits comfortably; two would be tight |

---

## 6. Client 1 Mapping

| Application Field | Template Field | Mapping |
|-------------------|----------------|---------|
| `clientName` / `waiverClient1Name` | CLIENT'S NAME | Direct pre-fill |
| `sig` canvas | CLIENT'S SIGNATURE | Scale to ~307pt width |
| `date` / `waiverClient1Date` | DATE | Format DD/MM/YYYY |

---

## 7. Client 2 Design Options

### Option A: Second Block on Page 6 (Recommended)

```
CLIENT 1 NAME: ___________________________________________________
CLIENT 1 SIGNATURE: _______________________________________________
DATE: _____ / _____ / 20____

CLIENT 2 NAME: ___________________________________________________
CLIENT 2 SIGNATURE: _______________________________________________
DATE: _____ / _____ / 20____
```

**Placement:** Below Client 1 Date (y=475), starting at y≈410  
**Vertical space used:** ~125pts per block (Name→Signature→Date with gaps)  
**Remaining to footer:** ~380pts — ample

**Pros:**
- Single page output
- Both clients visible when printed
- Minimal implementation change
- Consistent with clause 17.5 (joint and several liability)
- Legal text unchanged

**Cons:**
- Clause 18 uses singular "I, the Client" — may need legal review

---

### Option B: Continuation Page (Page 7)

- Generate page 7 with Client 2 block only
- Would need to repeat clause 18 or reference page 6

**Pros:** More space, cleaner separation  
**Cons:** Two-page output, merge complexity, legal text duplication

---

### Option C: Two Separate Documents

- Generate two PDFs: one per client
- Each gets full 6-page document

**Pros:** Cleanest legal separation  
**Cons:** Dual generation, naming complexity, ZIP packaging changes, combined PDF has two waiver sections

---

**Recommendation:** **Option A** — lowest technical risk, preserves legal text integrity, single-page output. Legal review of clause 18 wording with two clients recommended before implementation.

---

## 8. Date Field Decision Required

The template shows: `DATE: _____ / _____ / 20____` (DD/MM/YYYY format)

**Product decisions needed:**

1. **Auto-fill vs manual:** Pre-fill from appointment `date` field, or require manual entry as signing date?
2. **Shared vs separate:** One date for both clients, or separate dates per client?
3. **Format enforcement:** Validate DD/MM/YYYY on entry?

**Current app convention:** Appointment `date` field uses DD/MM/YYYY with auto-format. IA form uses `iaDate` (can override). EOI uses `eoiDate` (can override).

**Recommendation:** Follow IA/EOI pattern — default to appointment `date`, allow override via `waiverClient1Date`/`waiverClient2Date` fields.

---

## 9. Legal Text Preservation Statement

**No modifications to legal wording (clauses 1–18) are planned or required for implementation.**

The implementation will:
- Render the template PDF page 6 as a background image
- Overlay text at verified coordinates for the three fill-in fields per client
- Draw signature images from existing canvas elements
- Preserve all legal text exactly as authored

**Clause 17.5** ("If a party comprises two or more persons, the covenants... bind them jointly and each severally") supports multiple clients on one document.

**Clause 18** ("I, the Client, acknowledge...") uses singular — legal review recommended for two-client scenario.

---

## 10. Test Evidence

### Characterisation Tests (to be created in Phase 1)

| Test | Expected Result |
|------|-----------------|
| Template file exists | ✅ `templates/ASG-Disclosure-Waiver-2026.pdf` |
| SHA-256 matches | ✅ `1B2B4F5DFCD8DCDDC2E6A6062B0545BF4932C41A1B1EDEF93C5B5EB8EA3970AB` |
| Page count = 6 | ✅ |
| Page dimensions = 595.32 × 841.92 | ✅ |
| AcroForm absent | ✅ |
| Page 6 contains "ACKNOWLEDGEMENT OF THIS WAIVER AND DISCLOSURE" | ✅ |
| Page 6 contains "CLIENT'S NAME" | ✅ |
| Page 6 contains "CLIENT'S SIGNATURE" | ✅ |
| Page 6 contains "DATE:" | ✅ |
| No "WITNESS" field on any page | ✅ |
| No "PROPERTY" field on any page | ✅ |
| No "ACKNOWLEDGE" checkbox | ✅ |
| Signature area has non-zero dimensions | ✅ (line width ~307pts) |
| Coordinate map loads without error | ✅ (verified via pdfjs-dist) |

---

## 11. Integration with Existing Architecture

### PDF Rendering Reuse
- **IA form:** Uses `drawIAPage()` — overlays text on template image via `whiteOut()` + `drawTemplateLineValue()`
- **La Vida EOI:** Uses `drawLaVidaEoiPage()` — overlays on template image via `drawLaVidaField()`
- **Standard EOI:** Uses `drawStandardEoiPage()` — programmatic layout with `drawPageFrame()` + `drawLineValue()`

**Recommended approach for Waiver:** Follow IA/La Vida pattern — load template page 6 as image, overlay fields at calibrated coordinates. Reuse `ensureWaiverImage()` loader, `drawWaiverPage()` renderer.

### Signature Rendering Reuse
- Existing `sig` (900×150) and `sig2` canvases
- IA form draws signatures via `ctx.drawImage(sig, x, y, w, h)` mapped from template coordinates
- Waiver will use same approach: map signature line coordinates, scale canvas to fit

### Date Formatting Reuse
- Existing `formatDisplayDate()` → DD/MM/YYYY
- Existing `formatISODate()` for parsing
- Waiver date fields follow same convention

### Filename Sanitisation Reuse
- Existing `safePart()` and `pdfFileName()` helpers
- Waiver filenames follow same sanitisation rules

---

## 12. Service Worker Caching

**Required addition to `APP_SHELL` in `service-worker.js`:**
```javascript
'templates/ASG-Disclosure-Waiver-2026.pdf'
```

**Cache version:** Bump from `v2.7.0-alpha.21` to next version when template added.

---

## 13. Summary

| Item | Status |
|------|--------|
| Template located | ✅ |
| SHA-256 recorded | ✅ |
| Page count verified | ✅ (6) |
| Page dimensions verified | ✅ (A4) |
| AcroForm status | ✅ (None) |
| Verified field count | ✅ (3 per client) |
| Verified signature count | ✅ (1 per client, reusing existing canvases) |
| Verified date fields | ✅ (1 per client, DD/MM/YYYY) |
| Page-6 coordinates mapped | ✅ |
| Client 1 mapping defined | ✅ |
| Client 2 options evaluated | ✅ (Option A recommended) |
| Legal wording changes required | ❌ (None — Option A preserves text) |
| Storage impact | Minimal (4 fields + 2 signatures) |
| Schema version bump | Required (v2) |
| Migration required | No (defaults handle legacy) |
| Offline impact | Template cached, same draft system |
| Standalone workflow | 3-stage, single PDF, no ZIP |
| Combined workflow | Conditional stage, single waiver page in Combined PDF + ZIP |
| PDF output order | In-Person: after IA; Zoom: at end |
| ZIP behaviour | +1 standalone waiver PDF, no duplicate Combined |
| Email behaviour | Standalone: manual attach; Combined: +1 line |
| Unresolved product decisions | 3 (date behavior, Client 2 labels, legal review) |
| Characterisation tests defined | ✅ (11 tests) |

---

## 14. Deliverable Paths

- **Research:** `docs/waiver-disclosure/WAIVER_DISCLOSURE_RESEARCH.md`
- **Specification:** `docs/superpowers/specs/2026-09-08-waiver-disclosure-workflow-design.md`
- **Plan:** `docs/superpowers/plans/2026-09-08-waiver-disclosure-workflow-plan.md`
- **Characterisation:** `docs/waiver-disclosure/WAIVER_TEMPLATE_CHARACTERISATION.md` (this file)

---

## 15. Commit Hashes

_To be filled after commits_

---

## 16. Working Tree Status

_To be filled after commits_

---

## 17. GO/NO-GO for Runtime Implementation

**Status: NO-GO** — Design review required. Product decisions on date behavior, Client 2 labels, and legal review of clause 18 must be resolved before implementation begins.

**READY FOR VERIFIED WAIVER DESIGN REVIEW**