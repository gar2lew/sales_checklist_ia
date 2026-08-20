// Offline test fixtures and helpers � fictional data only.
// AUTOMATED ONLY � no real client data, no physical-device claims.

const FICTIONAL_CLIENT = {
  name: "Fictional Test Client",
  email: "fictional.test@example.invalid",
  phone: "0412 345 678",
  address: "1 Fictional Street, Testville WA 6999",
};

const FICTIONAL_STAFF = "Garry Lewis";

const FICTIONAL_APP_TYPE = "zoom";

const FICTIONAL_SALE_DETAILS = {
  crmId: "FICTIONAL-001",
  salePrice: "500000",
  contractDueDate: "2026-12-31",
  contractDueDateTbc: true,
  includeEOI: true,
  includeIA: true,
};

const FICTIONAL_SIGNATURE = "data:image/png;base64,FICTIONAL_SIGNATURE_PLACEHOLDER";

const FICTIONAL_PHOTO = {
  name: "fictional-id.png",
  dataURL: "data:image/png;base64,FICTIONAL_PHOTO_PLACEHOLDER",
  size: 1024,
};

const FICTIONAL_WHITEBOARD_PAGE = {
  pageNumber: 1,
  label: "Page 1",
  strokes: [{ points: [[10, 20], [50, 60], [100, 80]], color: "#000000", width: 2 }],
  savedAt: "2026-07-24T12:00:00.000Z",
  dataURL: "data:image/png;base64,FICTIONAL_WB_PAGE_PLACEHOLDER",
};

/**
 * Build a complete fictional offline appointment draft.
 * @param {object} [overrides] � properties to override in the returned draft
 * @returns {object} a deterministic draft suitable for offline-capability tests
 */
export function buildFictionalOfflineDraft(overrides = {}) {
  return {
    appointmentMode: FICTIONAL_APP_TYPE,
    staffName: FICTIONAL_STAFF,
    clientName: FICTIONAL_CLIENT.name,
    clientEmail: FICTIONAL_CLIENT.email,
    clientPhone: FICTIONAL_CLIENT.phone,
    propertySaleAddress: FICTIONAL_CLIENT.address,
    client2Name: "Fictional Client 2",
    client2Email: "fictional.client2@example.invalid",
    client2Phone: "0499 999 999",
    ...FICTIONAL_SALE_DETAILS,
    firstConsultNotes: "Fictional offline appointment notes.",
    signature: FICTIONAL_SIGNATURE,
    photos: [FICTIONAL_PHOTO],
    whiteboardPages: [FICTIONAL_WHITEBOARD_PAGE],
    wbSavedPages: [{ pageNumber: 1, label: "Page 1", dataURL: FICTIONAL_WHITEBOARD_PAGE.dataURL }],
    lastSaved: new Date().toISOString(),
    ...overrides,
  };
}

export { FICTIONAL_CLIENT, FICTIONAL_STAFF, FICTIONAL_APP_TYPE };

/**
 * Assert that every client-facing string in a draft or fixture contains
 * only approved synthetic values.
 * @param {object} draft � the draft to validate
 */
export function assertFictionalStrings(draft) {
  const fields = [
    draft.clientName, draft.clientEmail, draft.clientPhone,
    draft.propertySaleAddress, draft.client2Name, draft.client2Email,
    draft.client2Phone, draft.firstConsultNotes,
  ];
  for (const value of fields) {
    if (typeof value === "string" && value !== "") {
      // Accept fictional markers, test domain, or synthetic AUS phone format (04xx xxx xxx)
      const ok = value.includes("Fictional") || value.includes("Test") || value.includes(".invalid")
        || /^04\d{8}$/.test(value) || /^04\d{2}\s\d{3}\s\d{3}$/.test(value);
      if (!ok) {
        throw new Error(`Draft field must contain only fictional values, got: "${value}"`);
      }
    }
  }
}

/**
 * Validates draft structure meets the v2.7.0-alpha.1 shape.
 * @param {object} draft � the draft to validate
 */
export function assertDraftShape(draft) {
  const required = [
    "appointmentMode", "staffName", "clientName", "clientEmail",
    "includeEOI", "includeIA", "contractDueDateTbc",
    "signature", "photos", "whiteboardPages", "wbSavedPages",
  ];
  for (const key of required) {
    if (!(key in draft)) throw new Error(`Draft missing required key: ${key}`);
  }
  if (draft.appointmentMode !== "zoom" && draft.appointmentMode !== "inPerson") {
    throw new Error(`Unexpected appointment mode: ${draft.appointmentMode}`);
  }
  if (!Array.isArray(draft.photos)) throw new Error("Draft photos must be an array");
  if (!Array.isArray(draft.whiteboardPages)) throw new Error("Draft whiteboardPages must be an array");
  if (!Array.isArray(draft.wbSavedPages)) throw new Error("Draft wbSavedPages must be an array");
}
