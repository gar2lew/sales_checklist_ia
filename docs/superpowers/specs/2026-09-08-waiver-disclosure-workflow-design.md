# Waiver & Disclosure Workflow — Design Specification

**Date:** 08/09/2026  
**Application:** Sales Appointment Capture v2.7.0-alpha.1  
**Status:** Design Complete — Awaiting Authoritative Template  
**Depends On:** `docs/waiver-disclosure/WAIVER_DISCLOSURE_RESEARCH.md`

---

## 1. Product Behaviour Summary

Three appointment/document types on landing screen:

1. **In-Person Appointment** — existing workflow + optional Waiver
2. **Zoom Appointment** — existing workflow + optional Waiver
3. **Waiver & Disclosure** — standalone waiver-only workflow

### In-Person & Zoom: Optional Waiver Checkbox

- **Label:** "Include Waiver & Disclosure"
- **Default:** OFF
- **Location:** Appointment Info section, alongside "Include EOI form" / "Include IA form"
- **When OFF:** Waiver completely hidden, no validation, no output, no email impact
- **When ON:** Waiver stage revealed, fields required, signatures required, included in outputs

### Waiver & Disclosure Only

- Client 1 **required**, Client 2 **optional**
- No EOI, IA, ID Photos, Checklist, Whiteboard, Strategy/Professional sections
- Simplified 3-stage workflow: Client Details → Waiver & Disclosure → Ready
- Single PDF output, simple Prepare Email, no ZIP
- Same staff selection, device-local save, 7-day expiry, New Appointment protection

---

## 2. Landing Screen Design

### Mode Cards (3 options)

```html
<div class="mode-cards">
  <button type="button" class="mode-card active" data-mode="inPerson">
    <span class="mode-card-icon" aria-hidden="true">👤</span>
    <span class="mode-card-title">In-Person Appointment</span>
  </button>
  <button type="button" class="mode-card" data-mode="zoom">
    <span class="mode-card-icon" aria-hidden="true">🖥</span>
    <span class="mode-card-title">Zoom Appointment</span>
  </button>
  <button type="button" class="mode-card" data-mode="waiverOnly">
    <span class="mode-card-icon" aria-hidden="true">📋</span>
    <span class="mode-card-title">Waiver & Disclosure</span>
  </button>
</div>
```

### Hint Text (dynamic per selection)

| Mode | Hint |
|------|------|
| In-Person | "Face-to-face appointment with optional Waiver & Disclosure" |
| Zoom | "Online appointment with optional Waiver & Disclosure" |
| Waiver Only | "Standalone Waiver & Disclosure — no appointment forms" |

### Continue Button Text

| Mode | Button Text |
|------|-------------|
| In-Person | "Start Appointment" |
| Zoom | "Start Zoom Appointment" |
| Waiver Only | "Start Waiver & Disclosure" |

### Recent Draft Card

Shows draft type: "In-Person Appointment", "Zoom Appointment", or "Waiver & Disclosure"

---

## 3. In-Person + Waiver Workflow

### Entry Point
Landing → Select "In-Person Appointment" → Enter staff → Continue

### Visible Sections (Timeline Steps)

1. **Client Details** (always)
2. **EOI** (conditional — `includeEOI`)
3. **IA** (conditional — `includeIA`)
4. **Waiver & Disclosure** (NEW — conditional — `waiver.included`)
5. **ID Docs** (always)
6. **Signatures** (always)
7. **Checklist** (always)
8. **Ready** (always)

### Waiver Checkbox

```html
<div class="toggleRow in-person-only" style="margin-top:20px">
  <label style="font-weight:600; display:flex; align-items:center; gap:8px">
    <input type="checkbox" id="includeWaiver">
    Include Waiver & Disclosure
  </label>
</div>
```

- Default: unchecked
- When checked: `waiver.included = true`, timeline inserts Waiver stage at position 4
- When unchecked: `waiver.included = false`, waiver data preserved but ignored

### Waiver Stage Fields (Conditional Section)

**Section ID:** `waiverDetailsCard` (in-person-only)

| Field | ID | Required | Notes |
|-------|-----|----------|-------|
| Client 1 Name | `waiverClient1Name` | Yes | Pre-filled from `clientName` |
| Client 1 Signature | `waiverSignature1` | Yes | Uses existing `sig` canvas |
| Client 1 Date | `waiverClient1Date` | Yes | Defaults to appointment `date` |
| Client 2 Name | `waiverClient2Name` | Conditional | Pre-filled from `client2Name`, required if Client 2 exists |
| Client 2 Signature | `waiverSignature2` | Conditional | Uses existing `sig2` canvas |
| Client 2 Date | `waiverClient2Date` | Conditional | Defaults to appointment `date` |
| Witness Name | `waiverWitnessName` | Yes | Pre-filled from `teamMember` |
| Witness Signature | `waiverWitnessSignature` | Yes | **NEW canvas** |
| Witness Date | `waiverWitnessDate` | Yes | Defaults to appointment `date` |
| Disclosure Acknowledgment | `waiverDisclosureAck` | Yes | Checkbox |
| Property Address | `waiverPropertyAddress` | Yes | Pre-filled from `propertySaleAddress` |

### Validation Rules (In-Person + Waiver)

| Condition | Behaviour |
|-----------|-----------|
| `includeWaiver` unchecked | Waiver completely ignored — no validation, no output |
| `includeWaiver` checked + Client 2 name empty | Client 1 + Witness required; Client 2 fields hidden/optional |
| `includeWaiver` checked + Client 2 name present | Client 1 + Client 2 + Witness all required |
| Missing signature | Blocks final generation; draft saves allowed |
| Draft save | All waiver state preserved (fields, signatures, checkbox) |
| Draft reopen | Waiver state fully restored |

### Save/Offline Behaviour

- `getDraft()` includes `waiver: { included, fields, signatures }`
- `setDraft()` restores all waiver state
- 7-day expiry applies
- New Appointment dialog protects waiver drafts
- Corrupt draft handling unchanged

### Generation Behaviour

**Combined PDF Order:**
1. EOI (if included)
2. IA (if included)
3. **Waiver & Disclosure** (NEW)
4. ID Photos

**ZIP Contents:**
- All existing individual documents
- `Waiver and Disclosure - {Client Names} - {date}.pdf`

**Filename (Combined PDF):** Unchanged — `Sales Appointment - {date} - {clients} - {staff}.pdf`

**Filename (Standalone Waiver in ZIP):** `Waiver and Disclosure - {Client Names} - {date}.pdf`

---

## 4. Zoom + Waiver Workflow

### Entry Point
Landing → Select "Zoom Appointment" → Enter staff → Continue

### Visible Sections (Timeline Steps)

1. **Client Details** (always)
2. **Discovery** (always)
3. **Financial** (always)
4. **Professional** (always)
5. **Strategy** (always)
6. **Workspace** (always)
7. **Outputs** (always — includes waiver checkbox)
8. **Waiver & Disclosure** (NEW — conditional — `waiver.included`)
9. **Ready** (always)

### Waiver Checkbox

**Location:** Zoom Outputs section (`zoomOutputsSection`)

```html
<div class="toggleRow zoom-checkboxes">
  <label class="zoom-check-label"><input type="checkbox" id="zoomIncludeStandardEOI"> Include Standard EOI</label>
  <label class="zoom-check-label"><input type="checkbox" id="zoomIncludeLaVidaEOI"> Include La Vida EOI</label>
  <label class="zoom-check-label"><input type="checkbox" id="zoomIncludeIA"> Include IA</label>
  <label class="zoom-check-label"><input type="checkbox" id="zoomIncludeWaiver"> Include Waiver & Disclosure</label>
</div>
```

- Default: unchecked
- When checked: adds Waiver stage before Ready

### Waiver Stage Fields

Same field set as In-Person, but section ID: `zoomWaiverDetailsCard` (zoom-only)

### Validation Rules (Zoom + Waiver)

Identical to In-Person + Waiver, using Zoom validation pipeline.

### Generation Behaviour

**Combined Booklet Order:**
1. Cover
2. First Consultation (6 pages)
3. Client Review (4 pages)
4. Standard EOI (if selected)
5. La Vida EOI (if selected)
6. IA (if selected)
7. Whiteboard (if any)
8. **Waiver & Disclosure** (NEW)

**ZIP Contents:**
- All existing individual Zoom documents
- `Waiver and Disclosure - {Client Names} - {date}.pdf`

**Combined PDF Filename:** Unchanged — `Sales Appointment - Zoom - {clients} - {staff} - {date}.pdf`

---

## 5. Waiver & Disclosure Only Workflow

### Entry Point
Landing → Select "Waiver & Disclosure" → Enter staff → Continue

### Simplified Timeline (3 Steps)

1. **Client Details** — Client 1 (required), Client 2 (optional), Property Address, Date, Staff
2. **Waiver & Disclosure** — All waiver fields + signatures + witness
3. **Ready** — Generate PDF, Download PDF, Prepare Email

### HTML Sections (waiver-only class)

```html
<!-- Section 1: Client Details -->
<section class="card waiver-only" id="waiverClientDetailsSection">
  <!-- Client 1, Client 2, Property, Date, Staff -->
</section>

<!-- Section 2: Waiver & Disclosure -->
<section class="card waiver-only" id="waiverDetailsCard">
  <!-- All waiver fields, signatures, witness -->
</section>

<!-- Section 3: Ready -->
<section class="card waiver-only" id="waiverReadySection">
  <!-- Generate, Download, Prepare Email -->
</section>
```

### Hidden in Waiver-Only Mode

- EOI / IA checkboxes
- ID Photos section
- Signatures section (replaced by waiver signatures)
- Checklist
- Whiteboard
- Zoom-specific sections (Discovery, Financial, Professional, Strategy, Workspace, Outputs)

### Validation Rules (Waiver Only)

| Field | Required |
|-------|----------|
| Client 1 Name | Yes |
| Client 1 Signature | Yes |
| Client 1 Date | Yes |
| Witness Name | Yes |
| Witness Signature | Yes |
| Witness Date | Yes |
| Disclosure Acknowledgment | Yes |
| Property Address | Yes |
| Appointment Date | Yes |
| Staff Name | Yes |
| Client 2 Name | No (but if entered → Client 2 Signature + Date required) |

### Output

**Single PDF:** `{date} - {Client Names} - Waiver and Disclosure.pdf`

**No ZIP** generated.

**Prepare Email:**
- To: `CONFIG.share.to`
- CC: Staff email or fallback
- Subject: `Waiver & Disclosure - {Client Names} - {Property} - {date}`
- Body: Plain English instructing staff to attach downloaded PDF
- No ZIP attachment reference

### Save/Offline

Identical to combined modes — uses same IndexedDB draft with `waiver.mode = 'standalone'`.

---

## 6. Data Model

### Draft Extension (IndexedDB)

```javascript
// In getDraft():
data.waiver = {
  included: isChecked('includeWaiver') || isChecked('zoomIncludeWaiver') || appointmentMode === 'waiverOnly',
  mode: appointmentMode === 'waiverOnly' ? 'standalone' : 'combined',
  fields: {
    client1Name: fieldText('waiverClient1Name') || fieldText('clientName'),
    client2Name: fieldText('waiverClient2Name') || fieldText('client2Name'),
    witnessName: fieldText('waiverWitnessName') || fieldText('teamMember'),
    disclosureAcknowledged: isChecked('waiverDisclosureAck'),
    propertyAddress: fieldText('waiverPropertyAddress') || fieldText('propertySaleAddress'),
    appointmentDate: fieldText('waiverAppointmentDate') || fieldText('date'),
    client1Date: fieldText('waiverClient1Date') || fieldText('date'),
    client2Date: fieldText('waiverClient2Date') || fieldText('date'),
    witnessDate: fieldText('waiverWitnessDate') || fieldText('date')
  },
  signatures: {
    client1: hasSignature ? sig.toDataURL('image/png') : null,
    client2: hasSignature2 ? sig2.toDataURL('image/png') : null,
    witness: hasWaiverWitnessSignature ? waiverWitnessSig.toDataURL('image/png') : null
  }
};
```

### Fields Array Addition

Add to `fields` array in `js/app.js`:
```javascript
const fields = [
  // ...existing...
  'includeWaiver', 'zoomIncludeWaiver',
  'waiverClient1Name', 'waiverClient2Name', 'waiverWitnessName',
  'waiverDisclosureAck', 'waiverPropertyAddress', 'waiverAppointmentDate',
  'waiverClient1Date', 'waiverClient2Date', 'waiverWitnessDate'
];
```

### New Signature Canvas

```html
<canvas id="waiverWitnessSignature" width="900" height="150"></canvas>
<button id="clearWaiverWitnessSignature" class="btn small">Clear</button>
```

---

## 7. PDF Generation

### New Renderer: `drawWaiverPage(pageNumber, totalPages, scale)`

- Uses template image (when provided) or programmatic layout
- Overlays all waiver fields at calibrated coordinates
- Draws three signatures (Client 1, Client 2, Witness)
- Includes generated footer

### Output Plan Integration

```javascript
// In outputPlan() for in-person:
if (waiverIncluded) {
  waiverPageCount = 1; // or 2 if template requires
  totalPages += waiverPageCount;
  groups.push({ id: 'waiver', pageOffset: offset, pageCount: waiverPageCount, getFilename: individualWaiverFilename });
  offset += waiverPageCount;
}

// In zoomOutputPlan():
if (zoomIncludeWaiver) {
  waiverPageCount = 1;
  pages.push({ id: 'waiver' });
  groups.push({ id: 'waiver', pageOffset: offset, pageCount: waiverPageCount, getFilename: zoomWaiverFilename });
  offset += waiverPageCount;
}
```

### Filename Generators

```javascript
function individualWaiverFilename() {
  const clientNames = clientNamesForFilename();
  const dateVal = $('date') ? $('date').value : '';
  const date = dateVal ? formatDisplayDate(dateVal).replace(/\//g, '-') : 'DD-MM-YYYY';
  return `Waiver and Disclosure - ${clientNames} - ${date}.pdf`;
}

function waiverOnlyPdfFileName() {
  const clientNames = clientNamesForFilename();
  const dateVal = $('date') ? $('date').value : '';
  const date = dateVal ? formatDisplayDate(dateVal).replace(/\//g, '-') : 'DD-MM-YYYY';
  return `${date} - ${clientNames} - Waiver and Disclosure.pdf`;
}
```

---

## 8. Email Handover

### Standalone Waiver Email (`buildWaiverOnlyEmailContent()`)

```javascript
function buildWaiverOnlyEmailContent() {
  const staffName = fieldText('teamMember') || 'ASG Team';
  const client1 = fieldText('clientName') || '';
  const client2 = fieldText('client2Name') || '';
  const clientNames = client2 ? `${client1} & ${client2}` : client1 || 'Client';
  const property = fieldText('propertySaleAddress') || 'Property';
  const date = formatDisplayDate(fieldText('date')) || 'DD/MM/YYYY';

  const subject = `Waiver & Disclosure - ${clientNames} - ${property} - ${date}`;
  const body = `Hi Natalie,

Please find the signed Waiver & Disclosure for ${clientNames} regarding ${property} dated ${date}.

Please attach the downloaded PDF to this email and send.

Kind regards,

${staffName}`;

  return { subject, body, to: CONFIG.share.to, cc: resolveShareCc(staffName) };
}
```

### Combined Appointment Email

Modify `buildShareEmailContent()` to append:
```javascript
if (waiverIncluded) {
  body += '\n\nWaiver & Disclosure is included in this package.';
}
```

---

## 9. Validation Architecture

### New Readiness Function

```javascript
function waiverReadiness() {
  if (!waiverIncluded) return { included: false, ready: true, items: [] };

  const items = [];
  const hasClient2 = fieldText('client2Name') || fieldText('waiverClient2Name');

  // Client 1
  if (!fieldText('waiverClient1Name') && !fieldText('clientName'))
    items.push({ id: 'waiverClient1Name', message: 'Enter Client 1 name for Waiver.' });
  if (!hasSignature)
    items.push({ id: 'waiverSignature1', message: 'Capture Client 1 signature for Waiver.' });
  if (!fieldText('waiverClient1Date') && !fieldText('date'))
    items.push({ id: 'waiverClient1Date', message: 'Enter Client 1 date for Waiver.' });

  // Client 2 (conditional)
  if (hasClient2) {
    if (!fieldText('waiverClient2Name') && !fieldText('client2Name'))
      items.push({ id: 'waiverClient2Name', message: 'Enter Client 2 name for Waiver.' });
    if (!hasSignature2)
      items.push({ id: 'waiverSignature2', message: 'Capture Client 2 signature for Waiver.' });
    if (!fieldText('waiverClient2Date') && !fieldText('date'))
      items.push({ id: 'waiverClient2Date', message: 'Enter Client 2 date for Waiver.' });
  }

  // Witness (always required)
  if (!fieldText('waiverWitnessName') && !fieldText('teamMember'))
    items.push({ id: 'waiverWitnessName', message: 'Enter witness name for Waiver.' });
  if (!hasWaiverWitnessSignature)
    items.push({ id: 'waiverWitnessSignature', message: 'Capture witness signature for Waiver.' });
  if (!fieldText('waiverWitnessDate') && !fieldText('date'))
    items.push({ id: 'waiverWitnessDate', message: 'Enter witness date for Waiver.' });

  // Disclosure acknowledgment
  if (!isChecked('waiverDisclosureAck'))
    items.push({ id: 'waiverDisclosureAck', message: 'Acknowledge the Waiver & Disclosure.' });

  // Property
  if (!fieldText('waiverPropertyAddress') && !fieldText('propertySaleAddress'))
    items.push({ id: 'waiverPropertyAddress', message: 'Enter property address for Waiver.' });

  return { included: true, ready: items.length === 0, items };
}
```

### Integration with `validateBeforePdf()`

```javascript
// In validateBeforePdf():
if (plan.waiverIncluded) {
  waiverReadiness().items.forEach(item => {
    if (!errors.some(e => e.id === item.id)) errors.push(item);
  });
}
```

### Integration with `structuredReadinessCheck()`

Same pattern — adds waiver items to validation list.

---

## 10. UI/UX Details

### Timeline Integration (Option 1 — Recommended)

**In-Person Timeline** (when waiver included):
```
1. Client Details → 2. EOI → 3. IA → 4. Waiver & Disclosure → 5. ID Docs → 6. Signatures → 7. Checklist → 8. Ready
```

**Zoom Timeline** (when waiver included):
```
1. Client Details → 2. Discovery → 3. Financial → 4. Professional → 5. Strategy → 6. Workspace → 7. Outputs → 8. Waiver & Disclosure → 9. Ready
```

**Waiver-Only Timeline:**
```
1. Client Details → 2. Waiver & Disclosure → 3. Ready
```

### CSS Classes

```css
/* New section visibility */
.waiver-only { display: none; }
.in-person-only.waiver-included .waiver-only { display: block; }
.zoom-only.waiver-included .waiver-only { display: block; }

/* Waiver-only mode */
.app.waiver-only .in-person-only { display: none; }
.app.waiver-only .zoom-only { display: none; }
.app.waiver-only .waiver-only { display: block; }
```

### Timeline Step for Waiver

```html
<li class="timeline-step">
  <button type="button" class="tl-step-btn" data-tl-target="waiverDetailsCard" data-tl-label="Waiver">
    <span class="tl-circle">4</span><span class="tl-label">Waiver</span>
  </button>
</li>
```

---

## 11. Reset/Clear Behaviour

| Action | Waiver Data Handling |
|--------|---------------------|
| **Reset Form** | Clears all waiver fields, signatures, checkbox |
| **Complete Handover** | Deletes waiver data with draft |
| **New Appointment (keep draft)** | Preserves waiver data in saved draft |
| **New Appointment (delete draft)** | Deletes waiver data |
| **Load Draft** | Restores waiver state fully |
| **Switch Mode (In-Person ↔ Zoom)** | Preserves waiver data if both support it; clears if switching to/from Waiver Only |

---

## 12. Accessibility

- All new fields: proper `<label>` associations
- Checkbox: `aria-describedby` for hint text
- Signature canvases: `aria-label` describing purpose
- Timeline: `aria-current="step"` on active waiver step
- Validation: `aria-invalid`, `role="alert"` error messages
- Focus management: scroll to first missing waiver field on validation failure

---

## 13. Acceptance Criteria

### Landing Screen
- [ ] Three mode cards render in correct order
- [ ] Third card shows "Waiver & Disclosure" with 📋 icon
- [ ] Hint text updates per selection
- [ ] Continue button text updates per selection
- [ ] Recent draft card shows correct type for waiver drafts

### In-Person + Waiver
- [ ] Checkbox appears in Appointment Info section
- [ ] Default OFF — no waiver UI visible
- [ ] When checked: Waiver stage appears in timeline at position 4
- [ ] Waiver fields pre-fill from appointment data
- [ ] Validation blocks generation when waiver enabled but incomplete
- [ ] Draft save/restore preserves waiver state
- [ ] Combined PDF includes waiver after IA
- [ ] ZIP includes standalone waiver PDF
- [ ] Email mentions waiver inclusion

### Zoom + Waiver
- [ ] Checkbox appears in Outputs section
- [ ] Default OFF — no waiver UI visible
- [ ] When checked: Waiver stage appears before Ready
- [ ] All behaviours match In-Person + Waiver

### Waiver Only
- [ ] Landing mode card works
- [ ] Only 3 timeline steps visible
- [ ] Client 1 required, Client 2 optional
- [ ] No EOI/IA/Photos/Checklist/Whiteboard visible
- [ ] Single PDF generated with correct filename
- [ ] No ZIP generated
- [ ] Prepare Email works with waiver-specific template
- [ ] Offline save/load works
- [ ] 7-day expiry enforced

### Regression
- [ ] Existing In-Person workflow unchanged when waiver unchecked
- [ ] Existing Zoom workflow unchanged when waiver unchecked
- [ ] Existing package generation unchanged
- [ ] Offline functionality unchanged
- [ ] Service worker cache unchanged (until template added)

---

## 14. Dependencies

**Blocking:** Authoritative Waiver & Disclosure PDF template must be provided to:
1. Calibrate overlay coordinates for `drawWaiverPage()`
2. Confirm exact field inventory
3. Confirm page count (1 or 2 pages)
4. Add template to `APP_SHELL` for offline caching

**Non-Blocking:** All other implementation can proceed with assumed field map.