# Appointment Package Ready Actions Design

## Scope

Prompt 5 replaces automatic handover side effects with one explicit, reusable package-ready state. It changes presentation and direct handover interaction only. Existing appointment data, validation, PDF/ZIP construction, filenames, email content, storage, and workflow rules remain authoritative.

## State model

- `idle`: no current package; ready panel is hidden and actions are disabled.
- `generating`: generation controls and ready actions are disabled; status is `Generating appointment package…`.
- `ready`: both the combined PDF and ZIP passed existing package validation; show `Appointment Package Ready`, the supporting copy, both filenames, and four enabled actions.
- `stale`: an output-affecting edit invalidates the package; retain a clear stale notice, disable ready actions, and require regeneration.
- A presentation-only change must not alter the document revision or invalidate the package.

Generation prepares both files without downloading, sharing, or opening email. Repeated activation while generating is ignored.

## Ready actions

The actions are real buttons in this exact order:

1. `Share Package`
2. `Save Combined PDF`
3. `Save ZIP`
4. `Prepare Email`

They consume the valid cached package and never regenerate it.

### Sharing

- Share PDF and ZIP when `navigator.canShare` accepts both.
- Otherwise share the PDF alone when supported and announce: `The combined PDF was shared. The ZIP remains available to save separately.`
- When file sharing is unavailable, do not download or open email; announce: `File sharing is not available in this browser. You can save the PDF and ZIP separately.`
- Treat `AbortError` as neutral cancellation and retain ready state.
- Report genuine errors concisely and retain ready state.

### Saving and email

- `Save Combined PDF` downloads only the combined PDF and announces `Combined PDF save started.`
- `Save ZIP` downloads only the ZIP and announces `ZIP save started.`
- `Prepare Email` opens the existing Prompt 3 mailto content only. It does not download, share, or regenerate files.

## UI and accessibility

The ready panel shows both filenames with safe wrapping. Buttons remain at least 44px, stack on narrow screens, and may use a grid on wider screens. Status changes use the existing polite live status. Native button disabled state provides keyboard parity. No focus is moved and no automatic scrolling is introduced.

Legacy output controls retain their IDs and handlers for compatibility but are removed from the visible action hierarchy where superseded. Generate controls are relabelled `Generate Appointment Package`.

## Delivery boundary

- Application version remains `2.7.0-alpha.1`.
- Service-worker cache advances from `v2.7.0-alpha.14` to `v2.7.0-alpha.15`.
- No PDF layout, storage, validation, email wording, recipient, business-rule, deployment, or service-worker strategy changes.
