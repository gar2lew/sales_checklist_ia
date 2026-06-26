# Settings System

## Overview

The app has an admin settings system for configuring dropdown options, PDF defaults, La Vida contacts, and company details. Settings are stored in `localStorage` and protected by a PIN.

## PIN behaviour

- **PIN:** `"1234"` (defined as `ADMIN_PIN`)
- **Session key:** `"salesAppointmentAdminUnlocked"` stored in `sessionStorage`
- **Flow:** Admin overlay is rendered with `settingsLocked` class → PIN panel shown → staff enter PIN → `unlockSettings()` verifies against `ADMIN_PIN` → `sessionStorage` set to `"true"` → settings panels become visible → lock persists per browser session
- **No permanent unlock** — closing the browser clears `sessionStorage` and re-locks
- **No rate limiting** — unlimited PIN attempts in current implementation

## localStorage keys

| Key | Purpose | Type |
|-----|---------|------|
| `salesAppointmentDraft` | Saved form draft | JSON string |
| `salesAppointmentAdminSettings` | Admin settings configuration | JSON string |
| `salesAppointmentAdminUnlocked` | Admin session unlock flag | String `"true"` (sessionStorage) |

## Settings export/import

- **Export:** `exportSettings()` — reads `adminSettings` from `localStorage`, serialises as JSON, triggers download as `sales-appointment-settings-v{version}.json`
- **Import:** `importSettingsFile(file)` — reads JSON file, validates shape (checks for `staff`, `branch`, `solicitor`, `eoiTemplates`, `pdfDefaults`, `laVidaDefaults`), normalises via `normalizeAdminSettings()`, saves to `localStorage`, re-renders all controls
- **Shape validation:** Imports that don't match the expected settings shape are rejected with a toast message

## Staff members

- **Config key:** `adminSettings.staff`
- **Mode:** `"text"` (free-text input) or `"select"` (dropdown)
- **Options:** Array of option strings for dropdown mode
- **Controls:** Mode toggle (`staffMode` select), add/remove option buttons
- **Effect:** When in `"select"` mode, the Team Member field and EOI Staff Member field become dropdowns with the configured options

## Branch locations

- **Config key:** `adminSettings.branch`
- **Options:** Array of option strings (e.g. `"Perth"`, `"Brisbane"`)
- **Controls:** Add/remove option buttons
- **Effect:** Populates the Branch dropdown on the EOI section

## Solicitors / conveyancers

- **Config key:** `adminSettings.solicitor`
- **Mode:** `"text"` (free-text) or `"select"` (dropdown)
- **Options:** Array of option strings
- **Controls:** Mode toggle, add/remove option buttons
- **Effect:** When in `"select"` mode, the Solicitor field on the IA section becomes a dropdown

## EOI templates

- **Config key:** `adminSettings.eoiTemplates`
- **Options:** Array of `{ value, label }` objects
- **Defaults:**
  - `{ value: 'standard', label: 'Standard' }`
  - `{ value: 'laVidaHomes', label: 'La Vida Homes' }`
- **Controls:** Add/remove option buttons with value and label inputs
- **Effect:** Populates the EOI Template dropdown. The `value` must match an entry in `EOI_BUILDERS`.

## La Vida broker / conveyancer options

- **Config keys:** `adminSettings.laVidaFinanceBrokers` and `adminSettings.laVidaConveyancers`
- **Structure:** Each has an `options` array of `{ id, name, email, phone }` objects
- **Defaults:**
  - Finance broker: Cooper Sachr (cooper@heartoflending.com.au, 0404353333)
  - Conveyancer: HGP Conveyancing / Rody Papas (rody@hgpconveyancing.com.au, (08) 8231 2884)
- **Controls:** Contact option rows with Name, Email, Phone inputs and Remove buttons
- **Effect:** Populates the Finance Broker and Conveyancer dropdowns on the La Vida EOI section. "Other / Manual" option allows free-text entry.

## PDF defaults

- **Config key:** `adminSettings.pdfDefaults`
- **Fields:**
  - `authorityAmount: "$10,000"` — default IA authority amount
  - `financePercent: ""` — default finance percentage
  - `branch: "Perth"` — default branch for EOI
  - `compressPhotos: true` — whether photo compression is on by default
  - `iaApplySignature1: true` — apply signature 1 to IA by default
  - `iaApplySignature2: true` — apply signature 2 to IA by default
- **Applied via:** `applyPdfDefaults(force)` — called on page load and when settings change. If `force` is false, only applies defaults when fields are empty.

## Company details

- **Section:** `settingsTab-company` panel
- **Current state:** Displays "Company details are built into the current PDF templates." — no configurable fields.
- **Future:** Could expose configurable company name, ABN, address for PDF footers.

## Migration / backwards compatibility

- **`normalizeAdminSettings(saved)`** handles legacy settings formats:
  - Accepts `branches.options` as alias for `branch.options`
  - Accepts `eoiTemplate.options` as alias for `eoiTemplates.options`
  - Normalises missing modes to `"text"`
  - Deduplicates options via `dedupeTextOptions()`
  - Migrates legacy contact formats (flat name/email/phone) to structured `{ id, name, email, phone }` objects
- **`migrateLaVidaDraftSelections(data)`** handles old drafts that have flat La Vida contact fields but no dropdown selections — maps manual entries to contact IDs where possible.

## Settings UI structure

The settings overlay (`#settingsOverlay`) has these tab panels:

| Tab | Panel ID | Contents |
|-----|----------|----------|
| Dropdowns | `settingsTab-dropdowns` | Staff, Branches, Solicitors, EOI Templates |
| PDF Defaults | `settingsTab-pdf` | Authority Amount, Finance %, Branch, Compress Photos, Signatures |
| La Vida | `settingsTab-lavida` | Finance Brokers, Settlement / Conveyancers |
| Company | `settingsTab-company` | Company Details (display only) |

Tabs are hidden when `settingsLocked` class is active on the card.
