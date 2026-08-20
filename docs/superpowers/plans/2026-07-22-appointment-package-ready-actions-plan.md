# Appointment Package Ready Actions Implementation Plan

1. Characterize the existing package builder, invalidation hooks, email builder, download helper, action IDs, and responsive patterns.
2. Add a focused test that fails until the exact ready content, action order, no-auto-side-effect generation, cached-package actions, share fallbacks, stale handling, accessibility, responsive styling, and cache version are present.
3. Add the ready panel and retain legacy IDs as hidden compatibility controls. Relabel both generation controls without changing their IDs.
4. Add narrow presentation/interaction helpers around the existing package cache: render state, lock generation, retrieve only a valid cached package, share capability selection, independent saves, and prepared-email launch.
5. Connect existing output invalidation to stale presentation without changing revision ownership. Keep generation validation and package construction authoritative.
6. Add responsive panel/action styling using existing tokens, 44px minimum targets, filename wrapping, and no overflow.
7. Advance only the service-worker cache version to `v2.7.0-alpha.15`.
8. Run syntax, diff, focused Prompt 5, service-worker, PDF/IA, accessibility/presentation, landing/workspace, and authoritative Phase 5 suites. Inspect the final diff for scope and commit once.

## Self-review

- The plan creates no new data state or storage shape; ready state is derived from the existing in-memory package and document revision.
- Each ready action consumes the existing package and cannot silently regenerate.
- The email builder is reused unchanged, so Prompt 3 wording and recipients remain intact.
- Both artifacts remain mandatory before ready state.
- Legacy IDs remain in the DOM, limiting compatibility risk while eliminating contradictory visible actions.
- Plain HTTP correctly follows the unavailable-share branch while independent save and email actions remain usable.
