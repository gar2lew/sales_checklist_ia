# Sales Appointment Capture — User Guide

**Version 1.6.2**

---

## 1. Overview

Sales Appointment Capture is an offline-capable Progressive Web App (PWA) for capturing client appointments in the field. It runs entirely on your device — no data is uploaded to any server.

**What it does:**

- Capture client details, property addresses, and contact information
- Complete Expression of Interest (EOI) and/or Irrevocable Authority (IA) forms
- Take photos of client ID documents with your device camera
- Capture client signatures directly on screen
- Generate a compiled PDF of the entire appointment, plus a ZIP of separated documents for filing
- Share the PDF and ZIP via email or your device's share sheet

**Key fact:** Everything stays on your device. PDFs are built in your browser. No cloud uploads, no server storage.

---

## 2. Getting Started

### Installing the App

You only need to do this once per device:

1. Open the app URL in your browser while connected to the internet.
2. Wait for the page to load fully.
3. **iPhone / iPad:** Tap Safari's Share button → **Add to Home Screen**.
4. **Android:** Tap Chrome's menu → **Add to Home screen** / **Install app**.
5. Open the home-screen app once before leaving the office to confirm it loads.

After the first online visit, the app works fully offline — fill forms, attach photos, capture signatures, and generate PDFs without internet.

### Interface Tour

The app has three main areas:

- **Header bar:** App name, Save Draft, Load Draft, Load Test Data, Settings (gear icon), and version number.
- **Main content (left):** The appointment form, divided into 6 numbered sections. Section 1 is always visible; Sections 2 (EOI) and 3 (IA) appear when you tick their checkboxes. The **Appointment Summary Card** at the top shows your progress at a glance.
- **Preview panel (right):** A live PDF preview that updates when you click **Refresh Preview** or **Generate PDF**. Shows page count and navigation buttons.
- **Footer action bar:** Generate PDF, Download PDF, Download Package, Share PDF, Save Draft, and New Appointment buttons. A live filename preview shows what the output will be named.

---

## 3. Step-by-Step Appointment Flow

### Section 1 — Appointment & Client Information

| Field | What to enter |
|-------|---------------|
| **Date** | Appointment date (auto-filled to today). Format: DD/MM/YYYY. |
| **Team Member** | Your name. Free-text or select from a dropdown (configured in Settings). |
| **Residential Address** | Client's current residential address. |
| **Property Sale Address** | Address of the property being sold. |
| **Client 1 Name** | Primary client's full name (required). |
| **Client 1 Phone** | Primary client's contact number. |
| **Client 1 Email** | Primary client's email address. |
| **Client 2 Name** | Second client's full name (optional). |
| **Client 2 Phone** | Second client's contact number. |
| **Client 2 Email** | Second client's email address. |

**Checkboxes:**
- **Include Expression of Interest** — Tick to add EOI forms to the appointment.
- **Include Irrevocable Authority** — Tick to add an IA form to the appointment.

When either checkbox is ticked, the corresponding section appears below with its fields.

---

### Section 2 — Expression of Interest (EOI)

Visible when **Include Expression of Interest** is ticked.

**Template:** Choose **Standard** or **La Vida Homes** (the La Vida option reveals extra branded fields).

**EOI Detail Overrides:** Tick **Show overrides** to manually edit the client name, mobile, email, address, sale address, date, and staff member shown on the EOI form. When unticked, values are copied from Section 1 automatically.

**Ownership:**
- **Sole Owner** — One client owns the property.
- **Joint Tenants 50/50** — Both clients own equally.
- **Tenants in Common** — Enter custom percentage shares.

**Sale Details:**
| Field | Notes |
|-------|-------|
| Sale Type | Land, House, or House and Land. |
| Land Price | Automatically formatted with `$` and commas. |
| House Price | Automatically formatted with `$` and commas. |
| H/L Total | Auto-calculated: Land + House. |
| Finance % | Dropdown: 10% through 90%. |
| Next Appointment Date | Date picker. |
| Next Appointment Time | Dropdown: 8:00 AM – 6:00 PM in 30-minute steps. |

**La Vida Homes** (visible when template = "La Vida Homes"):
- Select a Finance Broker and Conveyancer from configured dropdowns, or choose "Other" to enter details manually.

**Completion:**
- **Branch Location** — Brisbane or Perth (configurable in Settings).
- **Comments** — Any extra notes.

---

### Section 3 — Irrevocable Authority (IA)

Visible when **Include Irrevocable Authority** is ticked.

**Form:** Choose **Perth IA Form** or **Brisbane IA Form**.

**IA Overrides:** Tick **Show overrides** to manually edit client names, address, property, and date on the IA form. When unticked, values are copied from Section 1.

You can also click **Copy EOI details to IA** to pull values from the EOI section in one click.

**Always-visible fields:**
| Field | Notes |
|-------|-------|
| Authority Amount | Defaults to `$10,000` (configurable in Settings). |
| Solicitor / Conveyancer | Free-text or dropdown (configured in Settings). |

**Signature application:** Tick **Apply Sig 1** and/or **Apply Sig 2** to stamp the captured signatures onto the IA form.

---

### Section 4 — Client ID Documents

Four standard photo slots:

1. **Client 1 ID Front**
2. **Client 1 ID Back**
3. **Client 2 ID Front**
4. **Client 2 ID Back**

**How to take a photo:** Tap the relevant photo box. On mobile, your camera opens. On desktop, a file picker opens. Accepted formats: any image (JPEG, PNG, etc.).

Each photo slot has:
- **Rotate** (↻) — Rotates the image 90° clockwise. Rotation is preserved in the PDF.
- **Remove** (✕) — Removes the photo (asks for confirmation).

**Additional Documents:** Use the dropdown to add up to 6 extra document slots (Medicare Card, Passport, Driver Licence, Utility Bill, Bank Statement, Rates Notice, or Other). Each slot lets you assign the document to Client 1 or Client 2, choose the document type, and add a description for "Other" types.

**Compression:** The **Compress for smaller PDF** checkbox (ticked by default) reduces photo quality to keep PDFs smaller. Untick if you need maximum photo clarity.

---

### Section 5 — Signatures & Notes

**Signature 1:** Draw here using a finger (mobile) or mouse (desktop). Label shows Client 1's name.

**Signature 2:** Optional second signature. Label shows Client 2's name.

Each signature canvas has a **Clear** button and a status badge showing **Required**, **Optional**, or **Captured**.

**Notes:** Free-text area for appointment notes, exceptions, or next steps.

---

### Section 6 — Pre-departure Checklist

Before leaving the appointment, confirm:

1. Reservation Form is fully completed and signed by the client
2. Email addresses have been verified and double-checked
3. IA form details are completed and the correct Perth/Brisbane template is selected, if required
4. Clear photos of all client ID documents have been taken

---

## 4. Auto-Fill & Smart Features

### Date Auto-Population
The appointment date is set to today automatically when the app opens. It formats as DD/MM/YYYY.

### Copy EOI to IA
The **Copy EOI details to IA** button (in Section 3) copies client names, address, property address, and date from the EOI section into the IA override fields. This saves re-typing when both forms are needed.

### Price Auto-Calculation
In the EOI section, the **H/L Total** field updates automatically as you type Land Price and House Price. Both price fields auto-format with `$` and commas when you move to the next field.

### Live Filename Preview
The footer bar shows a live preview of the output PDF filename: `Sales Appointment - {date} - {client names} - {staff name}.pdf`. It updates as you type.

### Summary Card Click-to-Scroll
Click any item in the Appointment Summary Card to jump directly to that field in the form.

### Progress Indicators
The summary card shows colour-coded indicators:
- **Grey circle** — field is empty
- **Green tick** — field is complete
- **Orange badge** — items still remaining
- **Green badge** — "Ready for PDF"

---

## 5. Working with Photos

### Taking Photos
1. Tap the photo box you want to fill.
2. Your device camera opens (mobile) or a file picker appears (desktop).
3. Take the photo or select the file.
4. The photo appears as a thumbnail preview in the box.

### Rotating Photos
If a photo is sideways or upside-down, tap the **Rotate** (↻) button. Each tap rotates 90° clockwise. Rotation is applied in the PDF.

### Removing Photos
Tap the **✕** button. A confirmation dialog appears to prevent accidental removal.

### Additional Documents
Need more than 4 photos? Select a number (1–6) from the **Additional Documents** dropdown at the bottom of Section 4. New photo slots appear. Choose the client, document type, and an optional description.

### Photo Compression
The **Compress for smaller PDF** checkbox controls photo quality in the output:
- **Ticked (default):** 2× render scale, 78% JPEG quality. Smaller files, good for email.
- **Unticked:** 3× render scale, 92% JPEG quality. Larger files, maximum detail.

---

## 6. Sharing & Sending

### Step 1: Generate the PDF
Click **Generate PDF** in the header or footer bar. The app validates all required fields, builds the PDF, and shows a preview in the right panel. Use **Prev** / **Next** to flip through pages. The status bar shows the file size.

### Step 2: Choose your output method

| Button | What it does |
|--------|-------------|
| **Download PDF** | Downloads the compiled PDF to your device. |
| **Download Package** | Downloads the compiled PDF **plus** a ZIP containing individual separated PDFs — one for the EOI, one for the IA, and one per photo. |
| **Share PDF** | Opens your device's share sheet (if supported) or falls back to downloading the files and opening a pre-filled email. |

### Sharing via Email

When you tap **Share PDF**:

1. If your device supports file sharing, both the compiled PDF and the ZIP of separated documents are attached to the share sheet. You can send them via Mail, Messages, AirDrop, or any other app.
2. If file sharing is not supported (e.g., Firefox on desktop, or HTTP connections), the app downloads both files and opens a pre-filled email draft addressed to the configured recipients with the subject and body already filled in. **Attach the downloaded files manually before sending.**

The email is pre-addressed to the team's processing inbox. The subject and body include the client names, property address, date, and staff member name.

### Web Share Compatibility

| Platform | Browser | File sharing works? |
|----------|---------|-------------------|
| iPhone / iPad | Safari | Yes |
| Android | Chrome | Yes |
| Windows Desktop | Chrome / Edge (HTTPS) | Yes |
| Windows Desktop | Firefox | No (falls back to email) |
| Mac Desktop | Safari | No (falls back to email) |
| Mac Desktop | Chrome (HTTPS) | Yes |

---

## 7. Drafts & Reset

### Saving a Draft
At any point, click **Save Draft** (header or footer). All form fields, photos, and signatures are saved to your device's browser storage. A confirmation toast appears.

> **Note:** Only one draft exists at a time. Saving overwrites the previous draft.

### Loading a Draft
Click **Load Draft** (header). The form restores to its last saved state. If no draft exists, a message appears: "No saved draft found on this device."

> **Important:** Drafts are stored on the specific device and browser you used. A draft saved on your phone is not available on your laptop.

### Load Test Data
Click **Load Test Data** (header, beaker icon) to populate the form with sample data for testing or demonstration. A confirmation dialog appears first.

### Starting a New Appointment
Click **New Appointment** (footer, bin icon) to clear all fields, photos, and signatures. A confirmation dialog appears. The date resets to today.

---

## 8. Settings

Tap the **gear icon** (⚙) in the header to open Settings.

### Unlocking Settings
Enter the admin PIN and tap **Unlock**. The unlock state lasts until you close the browser tab.

### Settings Tabs

**Dropdowns:**
- **Staff Members** — Switch between free-text input and a preset dropdown. Add or remove staff names.
- **Branch Locations** — Add or remove branch options (default: Perth, Brisbane).
- **Solicitors / Conveyancers** — Switch between free-text and dropdown. Add or remove names.
- **EOI Templates** — Add or remove template options (default: Standard, La Vida Homes).
- **Additional Document Types** — Customise the document type dropdown (default: Medicare Card, Passport, Driver Licence, Utility Bill, Bank Statement, Rates Notice, Other).

**PDF Defaults:**
- Default authority amount (e.g. `$10,000`)
- Default finance percentage
- Default branch location
- Compress photos by default (on/off)
- Apply Signature 1 / Signature 2 to IA by default (on/off)

**La Vida:**
- Add, edit, or remove Finance Broker contacts (name, email, phone).
- Add, edit, or remove Settlement / Conveyancer contacts.

**Company:**
- Display-only — company details are built into the PDF templates.

### Import / Export Settings
Use **Export Settings** to download your configuration as a JSON file. Use **Import Settings** to load a configuration from another device. This is useful for setting up multiple staff devices with the same dropdowns and defaults.

---

## 9. Tips & Troubleshooting

### Offline Use
- The app works fully offline after the first online visit. You do not need internet to fill forms, take photos, capture signatures, or generate PDFs.
- PDFs are built entirely on your device. Large photo sets may take a few seconds.

### Photo Storage
- Photos are stored as part of your draft in browser local storage, which has a limit of roughly 5–10 MB per website.
- If you take many high-resolution photos, a draft save may fail with a storage warning. Reduce the number of photos or enable compression.

### Getting Updates
- When a new version of the app is released, open it once while online. The new version caches automatically.
- The version number is displayed in the header and at the bottom of every generated PDF page.

### PDF Not Generating?
- Check that required fields are filled: Client 1 Name, Team Member, and Date.
- Check that at least one form (EOI or IA) is ticked to include.
- Any field with a red border and error message needs attention.

### Photos Not Appearing in PDF?
- Ensure photos are attached (thumbnail visible in the photo slot).
- Check that the photo was not accidentally removed (the slot should show a thumbnail, not "Tap to attach").

### Draft Won't Load?
- Drafts are device- and browser-specific. A draft saved in Safari won't appear in Chrome.
- Clearing your browser data removes the draft. Export important settings before clearing.
