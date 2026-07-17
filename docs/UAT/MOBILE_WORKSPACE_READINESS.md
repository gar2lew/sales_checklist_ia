# Mobile Workspace Readiness

## Scope

This checklist covers the ASG workspace upgrade on `polish/minimum-commercial-set` and its integration branch. It separates browser automation from checks that require physical mobile or tablet hardware.

## Status legend

- **Verified automatically** — covered by the repository browser regression suite and responsive screenshot review.
- **Requires manual device verification** — cannot be approved from desktop emulation alone.
- **Blocked** — the required device or platform capability was unavailable in this environment.

## Automated readiness evidence

| Check | Status | Evidence |
|---|---|---|
| Workspace at 1920×1080, 1366×768, 768×1024, and 390×844 | Verified automatically | `tests/ux-polish-presentation.test.mjs` and `screenshots/ux-polish/` |
| No horizontal page overflow at tested responsive sizes | Verified automatically | Browser assertions at 1920, 768, and 390 CSS pixels |
| Sticky-footer buttons meet a 44px minimum target | Verified automatically | Computed-size assertions at desktop, tablet, and mobile sizes |
| Fixed-footer content clearance at captured viewports | Verified automatically | Responsive screenshots and bottom content inset assertions/styles |
| Landing keyboard dropdown, click-outside close, and Start Appointment | Verified automatically | Focused presentation regression suite |
| Draft saved/loaded/dirty and PDF ready/invalidated presentation | Verified automatically | Focused presentation regression suite |
| PDF preview refresh and navigation controls | Verified automatically | Existing PDF visual smoke and focused workspace regression checks |
| Download PDF, Download Package, and email/download share fallback | Verified automatically | Download-event and fallback assertions in the focused regression suite |
| Native operating-system share sheet | Blocked | Headless Chromium cannot invoke or validate iOS/Android native share UI |
| Physical software-keyboard and safe-area behavior | Blocked | No physical iPhone, Android phone, or iPad was connected to this environment |

## iPhone Safari

| Manual check | Status | Acceptance criteria |
|---|---|---|
| Portrait and landscape layout | Requires manual device verification | No horizontal overflow, clipped status text, or unreachable action |
| Software keyboard open on first, middle, and final fields | Requires manual device verification | Focused field remains visible; page scroll does not jump behind the header or footer |
| Bottom safe-area inset | Requires manual device verification | Footer clears the home indicator and every action remains tappable |
| Sticky footer while scrolling long sections | Requires manual device verification | Footer remains stable and does not cover the active field, photo control, or signature canvas |
| Native share sheet | Requires manual device verification | Share opens the iOS sheet with the generated PDF; cancellation leaves the workspace usable |
| Field focus and scrolling | Requires manual device verification | Previous/Next keyboard navigation and direct taps reveal the whole focused control |
| Section expansion/collapse | Requires manual device verification | Existing optional EOI/IA detail toggles retain state and do not move focus unexpectedly |
| PDF preview navigation | Requires manual device verification | Previous/Next changes pages once per tap without layout shift |

## Android Chrome

| Manual check | Status | Acceptance criteria |
|---|---|---|
| Portrait and landscape layout | Requires manual device verification | No horizontal overflow, clipped status text, or unreachable action |
| Software keyboard open with resize/pan behavior | Requires manual device verification | Active controls remain visible above the keyboard and sticky footer |
| Gesture-navigation bottom inset | Requires manual device verification | Footer actions clear the gesture area and remain at least 44px high |
| Sticky footer during long-form scrolling | Requires manual device verification | No content obstruction or footer flicker |
| Native share sheet | Requires manual device verification | Android share targets receive the generated PDF correctly; cancellation is non-destructive |
| Field focus and scrolling | Requires manual device verification | Address, email, date, and text areas scroll into a stable visible position |
| Section expansion/collapse | Requires manual device verification | Existing optional EOI/IA details expand and collapse without losing entered values |
| PDF preview navigation | Requires manual device verification | Page count and rendered preview remain synchronised |

## iPad or tablet browser

| Manual check | Status | Acceptance criteria |
|---|---|---|
| Portrait and landscape layout | Requires manual device verification | Two-column and single-column transitions remain readable with no overlap |
| On-screen and hardware keyboard | Requires manual device verification | Focus order remains logical and focused controls are not hidden |
| Safe-area inset and sticky footer | Requires manual device verification | Footer clears device insets and does not obscure the final card or signature controls |
| Split-screen or reduced-width browser | Requires manual device verification | Workspace reflows without horizontal overflow or inaccessible toolbar actions |
| Native share sheet | Requires manual device verification | Generated PDF appears in the platform share sheet and the app recovers after cancel/share |
| Section expansion/collapse | Requires manual device verification | Optional document sections retain values and visual state |
| PDF preview navigation | Requires manual device verification | Touch targets work reliably and the preview remains legible |

## Manual approval record

Record device model, operating-system version, browser version, orientation, result, and reviewer for every physical-device run. Release approval remains pending until the iPhone Safari, Android Chrome, and tablet sections have been completed or an explicit risk acceptance is recorded.
