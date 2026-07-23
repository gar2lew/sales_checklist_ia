import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import {
  renderDocumentationReport,
  renderDocumentationChangelog,
  writeDocumentationReports,
} from '../scripts/docs/reports.mjs';

const hash = 'a'.repeat(64);
const sourceCommit = '9db1800ce947f634520bb391826ad44ded8a6b82';
const screenshots = Array.from({ length: 9 }, (_, index) => ({
  filename: `${String(index + 1).padStart(2, '0')}-capture.png`,
  classification: index === 0 ? 'UPDATED' : 'UNCHANGED',
  hash,
  lastGenerated: '2026-07-22T02:00:00.000Z',
  validation: 'PASS',
}));

function fixture(status = 'WARN') {
  return {
    status,
    summary: status === 'WARN' ? 'Validated with one advisory warning.' : `${status} result.`,
    humanReviewRequired: true,
    source: {
      applicationVersion: '2.7.0-alpha.1',
      guideVersion: '1.0.0',
      generatedAt: '2026-07-22T10:00:00+08:00',
      generatedDisplay: '22 July 2026, 10:00 AM AWST',
      branch: 'fix/staff-dropdown-seeding-v2',
      commit: sourceCommit,
    },
    tooling: {
      node: '22.23.1',
      python: 'python',
      libreOffice: 'soffice.com 25.2',
      pdfinfo: 'pdfinfo.exe 25.06.0',
      renderer: 'pdftoppm.exe 25.06.0',
      platform: 'win32 x64',
    },
    screenshots,
    documents: [
      { type: 'DOCX', path: 'docs/user-guides/guide.docx', result: 'UNCHANGED', size: 100, hash, generation: 'PASS', metadata: 'PASS' },
      { type: 'PDF', path: 'docs/user-guides/guide.pdf', result: 'UPDATED', size: 200, hash, generation: 'PASS', metadata: 'PASS', pages: 17, semanticValidation: 'PASS' },
    ],
    validation: [
      { stage: 'docx', status: 'PASS', code: 'DOCX_VALID', message: 'DOCX valid.', remediation: 'No action required.', evidence: { mediaCount: 10 } },
      { stage: 'visual', status: 'WARN', code: 'VISUAL_EDGE', message: 'Intentional full-bleed navy cover reaches the page edge.', remediation: 'Review the cover manually.', evidence: { page: 1 } },
    ],
    safety: {
      temporaryDirectories: 'removed',
      serverProcesses: 0,
      libreOfficeProcesses: 0,
      popplerProcesses: 0,
      occupiedPorts: 0,
      writeBoundary: 'PASS',
      runtimeIntegrity: 'PASS',
    },
    manualReview: 'Pages 1, 8 and 17 were inspected; no clipping or legibility issue was found.',
    guideChanges: 'Report and changelog evidence refreshed.',
  };
}

test('report renders stable PASS/WARN/FAIL/BLOCKED facts without false visual approval', () => {
  for (const status of ['PASS', 'WARN', 'FAIL', 'BLOCKED']) {
    const input = fixture(status);
    const report = renderDocumentationReport(input);
    assert.match(report, new RegExp(`- Overall status: \\*\\*${status}\\*\\*`));
    assert.match(report, /Source commit/);
    assert.match(report, /17/);
    assert.match(report, /VISUAL_EDGE/);
    assert.match(report, /human visual review remains required/i);
    assert.doesNotMatch(report, /visually approved/i);
    assert.doesNotMatch(report, /\.tmp\/docs-user-guide|SECRET|PATH=/i);
    assert.equal(report.endsWith('\n'), true);
    assert.equal(report.endsWith('\n\n'), false);
    assert.equal(renderDocumentationReport(input), report);
  }
});

test('report preserves manifest and deterministic finding order and accurate document semantics', () => {
  const report = renderDocumentationReport(fixture());
  assert.ok(report.indexOf('01-capture.png') < report.indexOf('09-capture.png'));
  assert.ok(report.indexOf('DOCX_VALID') < report.indexOf('VISUAL_EDGE'));
  assert.match(report, /PDF bytes may vary despite equivalent validated content/);
  assert.match(report, /DOCX may be byte-identical/);
  assert.match(report, /UPDATED/);
  assert.match(report, new RegExp(hash));
});

test('changelog creates, prepends, preserves history, records WARN, and replaces duplicates', () => {
  const input = fixture();
  const first = renderDocumentationChangelog(input, '');
  assert.match(first, /^# Documentation Changelog/m);
  assert.match(first, /Validation result: WARN/);
  const prior = `${first}\n## 0.9.0 — 1 July 2026\n\n- Source commit: old\n`;
  const updated = renderDocumentationChangelog({ ...input, source: { ...input.source, commit: 'b'.repeat(40) } }, prior);
  assert.ok(updated.indexOf('b'.repeat(40)) < updated.indexOf(sourceCommit));
  assert.match(updated, /Source commit: old/);
  assert.equal(renderDocumentationChangelog(input, first), first);
  assert.equal(
    renderDocumentationChangelog(input, first.replaceAll('\n', '\r\n')),
    first,
  );
  const changedClassification = fixture();
  changedClassification.screenshots = changedClassification.screenshots.map((item, index) => ({
    ...item,
    classification: index === 0 ? 'NEW' : item.classification,
  }));
  const sameSourceChangedOutput = renderDocumentationChangelog(changedClassification, first);
  assert.equal((sameSourceChangedOutput.match(new RegExp(sourceCommit, 'g')) ?? []).length, 2);
  assert.throws(() => renderDocumentationChangelog(input, 'malformed'), /malformed changelog/i);
});

test('atomic report writes preserve identical mtimes and originals on replacement failure', async (t) => {
  const root = await mkdtemp(resolve(tmpdir(), 'docs-reporting-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const reportPath = resolve(root, 'documentation-report.md');
  const changelogPath = resolve(root, 'changelog.md');
  const input = fixture();
  const first = await writeDocumentationReports({ input, reportPath, changelogPath });
  assert.equal(first.report, 'UPDATED');
  assert.equal(first.changelog, 'UPDATED');
  const reportMtime = (await stat(reportPath)).mtimeMs;
  const changelogMtime = (await stat(changelogPath)).mtimeMs;
  const second = await writeDocumentationReports({ input, reportPath, changelogPath });
  assert.deepEqual(second, { report: 'UNCHANGED', changelog: 'UNCHANGED' });
  assert.equal((await stat(reportPath)).mtimeMs, reportMtime);
  assert.equal((await stat(changelogPath)).mtimeMs, changelogMtime);

  const original = await readFile(reportPath, 'utf8');
  await assert.rejects(writeDocumentationReports({
    input: { ...input, summary: 'changed' },
    reportPath,
    changelogPath,
    replace: async () => { throw new Error('replacement failed'); },
  }), /replacement failed/);
  assert.equal(await readFile(reportPath, 'utf8'), original);
});
