# Authoritative Application Configuration Design

**Status:** Approved architecture for implementation

## Objective

Consolidate organisation-specific, configurable, migratable, or replaceable application defaults into one in-file `DEFAULT_APP_CONFIGURATION` object. Preserve runtime behaviour, initialization order, localStorage keys, persisted settings shapes, UI, PDF output, sharing behaviour, and production data.

## Scope Boundary

`DEFAULT_APP_CONFIGURATION` contains:

- admin defaults;
- staff defaults;
- solicitor and conveyancer defaults;
- share recipients;
- appointment and business-level PDF defaults;
- EOI, La Vida, additional-document, builder, developer, and timeline defaults;
- configurable UI timing;
- organisation-specific labels and office values.

Technical constants remain outside the canonical object, including storage keys, DOM IDs, field maps, schema and cache versions, service-worker details, MIME types, asset paths, PDF dimensions and coordinates, overlay mappings, rendering mechanics, internal event names, and browser capability constants.

## Canonical Shape

```javascript
const DEFAULT_APP_CONFIGURATION = deepFreeze({
  admin: {
    pin: '1234'
  },
  organisation: {
    offices: ['Perth', 'Brisbane']
  },
  staff: {
    options: []
  },
  solicitors: {
    mode: 'select',
    options: ['B.O.S.S Conveyancing']
  },
  share: {
    to: 'Natalie@sjssolutionscorp.com.au',
    fallbackCc: 'Garry@sjssolutionscorp.com.au'
  },
  appointments: {
    defaults: {
      branch: 'Perth',
      financePercent: ''
    },
    zoom: {
      builders: [],
      developers: [],
      timeline: []
    }
  },
  pdf: {
    defaults: {
      authorityAmount: '$10,000',
      compressPhotos: true,
      applySignature1: true,
      applySignature2: true
    }
  },
  templates: {
    eoi: [],
    additionalDocuments: [],
    laVida: {
      financeBrokers: [],
      conveyancers: [],
      defaults: {}
    }
  },
  ui: {
    autosaveDelayMs: 15000,
    nativeShareTimeoutMs: 2500
  }
});
```

The implementation will populate each array and value with the exact existing production defaults and ordering. Production staff options remain empty.

## Immutability and Compatibility Views

The canonical object is deeply frozen after construction. Compatibility objects must not expose mutable references into it.

- `defaultAdminSettings` is a cloned projection matching the current persisted settings shape exactly.
- `zoomDefaults` is a cloned projection matching its current `{builders, developers, timeline}` shape.
- `CONFIG.share` is a frozen projection with the existing `{to, cc, nativeShareTimeoutMs}` fields; `cc` derives from canonical `fallbackCc`.
- Existing technical members of `CONFIG`, including storage and PDF-rendering mechanics, remain technical constants and do not source values from the canonical application configuration.
- Existing clone and normalization functions continue to return independently mutable settings objects.

## Initialization Order

The order remains:

1. Technical primitives and helper needed to construct/freeze configuration.
2. `DEFAULT_APP_CONFIGURATION` creation and freeze.
3. Compatibility projections (`defaultAdminSettings`, `zoomDefaults`, share compatibility view).
4. `loadAdminSettings()` and existing normalization.
5. Remaining technical `CONFIG` composition and runtime initialization.

No consumer will read configuration before its existing dependency is available. `adminSettings` continues to initialize at the same point relative to rendering and event binding.

## Persistence and Migration

- Keep `salesAppointmentAdminSettings` and every other storage key unchanged.
- Keep exported/imported settings and stored admin settings shapes unchanged.
- Do not store `DEFAULT_APP_CONFIGURATION` directly.
- Do not add a schema migration.
- Existing staff string/object normalization and draft compatibility remain unchanged.
- Settings changes continue to mutate only the cloned runtime `adminSettings` object.

## Characterization Tests

Before moving production values, add tests that capture current effective defaults for:

- admin PIN and settings projection;
- empty staff configuration and select mode;
- solicitor mode and ordered options;
- fixed share recipient, fallback CC, and native-share timeout;
- branch and appointment defaults;
- Zoom builders, developers, and timeline ordering;
- business-level PDF defaults;
- EOI, additional-document, finance-broker, conveyancer, and La Vida defaults;
- autosave timing;
- current persisted settings shape.

After refactoring, the same tests must pass without altered expected values. Existing PDF visual smoke, share-recipient tests, service-worker tests, premium landing/workspace tests, responsive/accessibility tests, and Phase 5 workflow tests remain authoritative.

## Verification and Release Boundary

Verification must confirm:

- JavaScript syntax and diff hygiene;
- no IDs removed or duplicated;
- no changed localStorage keys or stored object shapes;
- no UI, workflow, validation, PDF, sharing, or initialization-order change;
- production staff seed remains empty;
- application version remains `2.7.0-alpha.1`;
- service-worker cache changes only if tracked runtime assets require the repository contract to advance it;
- all focused and authoritative suites pass.

The work ends with a local focused commit on `fix/staff-dropdown-seeding-v2`. It must not be pushed, merged, deployed, or used to resume physical-device RC without separate approval.
