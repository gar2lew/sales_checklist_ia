# Sales Appointment Capture User Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a polished, repeatable, privacy-safe Sales Appointment Capture staff guide in Markdown, DOCX, and A4 PDF formats.

**Architecture:** Markdown is the canonical staff-facing content. A standalone Playwright script captures deterministic screenshots from the current RC with fictional data, and a Python generator converts the Markdown plus screenshots into a branded DOCX before exporting that DOCX to PDF through headless LibreOffice.

**Tech Stack:** Markdown, Node.js with Playwright, Python with python-docx and pypdf, LibreOffice headless, Poppler.

## Global Constraints

- Do not modify runtime application files, application behaviour, service-worker cache, app version, workflows, package generation, or validation.
- Use application version `2.7.0-alpha.1`; keep service-worker cache `v2.7.0-alpha.21` unchanged.
- Use fictional demonstration data only and include no credentials, PINs, real clients, signatures, IDs, or personal email addresses.
- Output A4 portrait PDF and editable DOCX under `docs/user-guides/`.
- Do not push, merge, or deploy.

---

### Task 1: Characterise the reference and verified RC workflow

**Files:**
- Read: `C:/dev/amplify-PIA-calculator/PIA Calculator - User Guide.pdf`
- Read: `index.html`, `js/app.js`, `css/app.css`, `tests/*.test.mjs`, `docs/releases/*.md`, `docs/UAT/MOBILE_WORKSPACE_READINESS.md`

- [ ] Render all 11 reference pages and record cover, heading, table, callout, spacing, header, and footer patterns.
- [ ] Verify visible in-person and Zoom labels, package contents, draft behaviour, dates, downloads, and email handover against runtime and tests.
- [ ] Record any requested wording that differs from runtime and use runtime behaviour as authoritative.

### Task 2: Add failing guide artifact checks

**Files:**
- Create: `tests/user-guide-artifacts.test.mjs`

- [ ] Assert the canonical source contains all 16 numbered sections, exact download guidance, version, and local-storage warning.
- [ ] Assert expected screenshots exist, are non-empty PNGs, and meet minimum dimensions.
- [ ] Assert DOCX and PDF exist, open structurally, contain pages, include the correct title, and contain no TODO/TBD, LAN IP, credentials, or secret patterns.
- [ ] Run `node tests/user-guide-artifacts.test.mjs` and confirm it fails because artifacts do not exist.

### Task 3: Capture deterministic application screenshots

**Files:**
- Create: `tests/user-guide-screenshots.spec.mjs`
- Create: `docs/user-guides/source/screenshots/*.png`

- [ ] Configure only `Test User`, fictional John/Jenny Smith details, and `Test Property` in isolated browser storage.
- [ ] Capture landing, in-person workspace, sale/date fields, Zoom timeline, Zoom whiteboard, draft controls, ID/signature area, Package Ready, and Downloads Started states.
- [ ] Cover 390x844, 844x390, and 1440x900 viewports with focused clipping and no browser chrome.
- [ ] Start a temporary localhost server only when port 8766 is unavailable and stop only that child process.
- [ ] Run the screenshot script and inspect every PNG for readable content and private-data absence.

### Task 4: Author the canonical staff guide

**Files:**
- Create: `docs/user-guides/source/sales-appointment-capture-user-guide.md`

- [ ] Write the cover metadata and 16 numbered sections in plain Australian English.
- [ ] Use actual in-person and Zoom labels, describe exact ZIP contents, and distinguish Combined PDF from individual ZIP PDFs and uploaded ID/photo PDFs.
- [ ] Include field tables, quick-start steps, warning/important/tip callouts, screenshot captions, troubleshooting, best practices, physical-device guidance, and final checklist.
- [ ] State that Safari may suppress a second download and that users must attach both files manually.
- [ ] Scan for placeholders, local RC IPs, credentials, and unsupported claims.

### Task 5: Generate branded DOCX and PDF

**Files:**
- Create: `scripts/generate-sales-appointment-user-guide.py`
- Create: `docs/user-guides/Sales Appointment Capture - User Guide.docx`
- Create: `docs/user-guides/Sales Appointment Capture - User Guide.pdf`

- [ ] Parse headings, paragraphs, ordered/unordered lists, Markdown tables, callouts, screenshot directives, and page breaks from the canonical source.
- [ ] Apply A4 margins, full-page navy cover, ASG logo, gold accents, navy rules, branded tables, headers, footers, and page-number fields.
- [ ] Generate the DOCX with python-docx and export it through headless LibreOffice to preserve visual parity.
- [ ] Confirm both outputs open and the PDF falls within the requested 12-20 page range where readability permits.

### Task 6: Add regeneration instructions and complete visual QA

**Files:**
- Create: `docs/user-guides/README.md`
- Render to: `tmp/user-guide-render/`

- [ ] Document Python, Node, Playwright, server, capture, generation, output, and troubleshooting commands.
- [ ] Run artifact checks, screenshot automation, critical app smoke, syntax checks, and `git diff --check`.
- [ ] Render every final PDF page to PNG and inspect each page for clipping, blank pages, broken tables, malformed characters, image quality, headers, footers, and page numbers.
- [ ] Validate links, privacy, version, cache metadata, app/cache immutability, and final working-tree scope.
- [ ] Commit all guide sources and outputs once with `docs: add sales appointment user guide`.

## Self-review

- Coverage: all requested deliverables, 16 sections, three viewports, privacy rules, and validation gates map to explicit tasks.
- Scope: documentation, automation, tests, and generated artifacts only; no runtime files are touched.
- Interfaces: screenshot paths are consumed by both Markdown directives and the Python generator; DOCX is the source used for PDF export.
- Placeholder scan: no TODO, TBD, or deferred implementation instruction remains.
