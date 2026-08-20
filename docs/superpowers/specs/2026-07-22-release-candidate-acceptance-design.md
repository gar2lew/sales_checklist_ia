# Release Candidate Acceptance Design

## Purpose and acceptance boundary

This pass audits the complete in-person and Zoom appointment lifecycle from landing selection through draft restoration, document capture, complete package generation, deliberate handover actions, stale invalidation, regeneration, and reset. It may fix only reproduced Critical or Important defects and low-risk Minor polish. It must not add product capabilities, change business rules, storage shapes, PDF layouts, recipient policy, approved wording, navigation architecture, dependencies, or production deployment configuration.

Release evidence must distinguish deterministic automation from physical-device-only validation. Application version remains `2.7.0-alpha.1`; the service-worker cache advances from `v2.7.0-alpha.15` to `v2.7.0-alpha.16` without changing cache strategy or asset ordering.

## Severity and fix policy

- **Critical:** data loss or incorrect output; stale artifacts can be handed over; missing/malformed required documents; wrong recipient; crash; false generation success; sensitive-data exposure; supported mobile workflow unusable. Must be fixed.
- **Important:** unreliable primary action; blocking accessibility/keyboard issue; viewport obstruction; offline breakage; duplicate generation; wrong file action; misleading status; major overlap. Must be fixed unless explicitly documented as non-blocking with evidence.
- **Minor:** non-blocking spacing, visual, wording, or maintainability issue. Fix only when demonstrably safe and directly in scope.

Each runtime fix follows reproduce/RED/minimal-fix/GREEN/affected-regression. Manual-only visual findings require deterministic recorded observations rather than artificial tests.

## Acceptance criteria and evidence

### Workflow and data

- Both appointment modes complete landing, staff/client details, EOI/IA where applicable, Contract Due Date/TBC, conveyancer, signatures/uploads, draft save/load, package generation, actions, stale edit, regeneration, and reset.
- Approved seven-person staff seed and metadata remain exact; no production test staff is introduced.
- Contract Due Date is blank-draftable but blocks final generation; date/TBC are exclusive; resolver returns `DD/MM/YYYY` or `To Be Confirmed`; drafts restore legacy blank state safely.
- Conveyancer order is B.O.S.S, Natalie, Other; custom mode remains accessible and draft/PDF-safe without automatic focus.
- Prepared email retains exact Prompt 3 structure, Natalie recipient, selected-staff/fallback CC rules, mode-specific optional next appointment, and no Contract Issued/download/attachment claims.

### Package and document outputs

- A ready package contains non-empty signature-valid PDF and ZIP artifacts, Files, individual PDFs, one timestamp, filenames, and the current revision. Partial, zero-byte, duplicate-name, incomplete, stale, and raced results are rejected; concurrent callers coalesce; valid results reuse cache.
- In-person and Zoom combined PDFs have correct data, document order, overlays, signatures, legible content, and no unexpected pages. ZIP entries are readable, safe, unique case-insensitively, mode-appropriate, and omit the combined PDF under current approved behavior.
- Filename templates and sanitisation remain unchanged and verified.

### Ready actions and staleness

- Visible/keyboard order is Share Package, Save Combined PDF, Save ZIP, Prepare Email. Controls are native buttons, at least 44px, disabled while generating/stale, and re-enabled only after complete successful regeneration.
- Generate causes no download/share/mailto. Each deliberate action consumes the valid cached package only. Share follows both/PDF-only/unavailable hierarchy; cancellation is neutral; genuine failure is recoverable. Save actions each save one correct artifact. Prepare Email only opens current mailto.
- Every output-affecting input invalidates handover; presentation-only controls do not. Reset releases package references and clears ready presentation.
- Superseded controls remain non-visible, non-focusable, and absent from the accessibility tree. Compatibility code is retained only where current consumers/tests require it.

### UI, accessibility, and performance

- No horizontal overflow, clipping, sticky overlap, unsafe footer obstruction, or competing legacy controls at desktop widths 1024/1280/1440/1920 and mobile sizes 320x568, 375x667, 390x844, 393x852, 414x896 plus one landscape and representative Android viewport.
- Package filenames wrap; narrow actions stack; focus is visible; tab order is logical; Enter/Space work natively; disabled/error/ready/stale states are textual, live-announced, and not colour-only; hidden inputs/actions are not focusable; 200% zoom preserves critical content; reduced-motion behavior remains.
- Valid package reuse avoids PDF/ZIP rerendering; stale regeneration occurs once; object URLs are revoked; generated Blobs never enter localStorage; reset clears large artifact references; no duplicate action listeners or service-worker registrations are introduced.

### Offline, LAN, and RC server

- Fresh install and upgrade from `.15` populate `.16`, delete only old application caches, retain unrelated caches, load offline, and preserve tracked asset/offline strategy.
- After online priming, offline form use, package generation, PDF/ZIP saving, and mailto construction work; Share remains capability-dependent.
- Final verified worktree is served by `python -m http.server 8766 --bind 0.0.0.0`. Localhost and current LAN IPv4 must return HTTP 200 where the environment permits. The process remains running. LAN/secure-context limitations are reported honestly.

## Final decision rules

**GO for physical-device RC** requires no unresolved Critical or Important automated/desktop defects, every suite green, Phase 5 at 61/61, service-worker upgrade/offline success, locally verified complete package/actions, verified RC server, clean tree, and a ready physical checklist.

**NO-GO for physical-device RC** applies for stale/incorrect/malformed output, bypassed validation, wrong artifacts, crash, inaccessible required mobile controls, broken service-worker update, unverified server, or dirty tree.

Production remains **NO-GO** until the iPhone/iPad physical checklist—including native keyboard, Share Sheet, Files, installed-PWA and real cache upgrade—is completed and reviewed.

