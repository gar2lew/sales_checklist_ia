import { randomUUID } from 'node:crypto';
import {
  mkdir,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname } from 'node:path';

const VALID_STATUSES = new Set(['PASS', 'WARN', 'FAIL', 'BLOCKED']);

function assertInput(input) {
  if (!VALID_STATUSES.has(input?.status)) throw new Error('Reporting input has an invalid status.');
  if (!/^[0-9a-f]{40}$/i.test(input.source?.commit ?? '')) {
    throw new Error('Reporting input requires a full Source commit.');
  }
}

function stableEvidence(value) {
  if (!value || Object.keys(value).length === 0) return 'none';
  return Object.keys(value).sort().map((key) => `${key}=${JSON.stringify(value[key])}`).join(', ');
}

function line(label, value) {
  return `- ${label}: ${value}`;
}

export function renderDocumentationReport(input) {
  assertInput(input);
  const output = [
    '# Documentation Automation Report',
    '',
    '## Documentation Automation Result',
    '',
    line('Overall status', `**${input.status}**`),
    line('Summary', input.summary),
    line('Human visual review required', input.humanReviewRequired ? 'Yes' : 'No'),
    '',
    '## Source',
    '',
    line('Application version', input.source.applicationVersion),
    line('Guide version', input.source.guideVersion),
    line('Generated', input.source.generatedDisplay),
    line('Git branch', input.source.branch),
    line('Source commit', input.source.commit),
    '',
    '## Environment and Tooling',
    '',
    line('Node', input.tooling.node),
    line('Python command', input.tooling.python),
    line('LibreOffice', input.tooling.libreOffice),
    line('Poppler pdfinfo', input.tooling.pdfinfo),
    line('Poppler renderer', input.tooling.renderer),
    line('Platform', input.tooling.platform),
    '',
    '## Screenshot Pipeline',
    '',
    '| Screenshot | Classification | SHA-256 | Last generated | Validation |',
    '|---|---|---|---|---|',
    ...input.screenshots.map((item) => (
      `| ${item.filename} | ${item.classification} | \`${item.hash}\` | ${item.lastGenerated} | ${item.validation} |`
    )),
    '',
    '## Document Generation',
    '',
    '| Artifact | Canonical path | Result | Bytes | SHA-256 | Generation | Pages | Metadata |',
    '|---|---|---|---:|---|---|---:|---|',
    ...input.documents.map((item) => (
      `| ${item.type} | ${item.path} | ${item.result} | ${item.size} | \`${item.hash}\` | ${item.generation} | ${item.pages ?? 'n/a'} | ${item.metadata} |`
    )),
    '',
    '- Observed determinism contract: DOCX may be byte-identical across unchanged runs.',
    '- LibreOffice PDF bytes may vary despite equivalent validated content.',
    '',
    '## Validation',
    '',
    '| Stage | Status | Code | Message | Remediation | Evidence |',
    '|---|---|---|---|---|---|',
    ...[...input.validation]
      .sort((left, right) => left.stage.localeCompare(right.stage) || left.code.localeCompare(right.code))
      .map((item) => (
        `| ${item.stage} | ${item.status} | ${item.code} | ${item.message} | ${item.remediation} | ${stableEvidence(item.evidence)} |`
      )),
    '',
    '## Cleanup and Safety',
    '',
    line('Temporary directories', input.safety.temporaryDirectories),
    line('Remaining documentation server processes', input.safety.serverProcesses),
    line('Remaining LibreOffice processes', input.safety.libreOfficeProcesses),
    line('Remaining Poppler processes', input.safety.popplerProcesses),
    line('Occupied documentation ports', input.safety.occupiedPorts),
    line('Write boundary', input.safety.writeBoundary),
    line('Runtime integrity', input.safety.runtimeIntegrity),
    '',
    '## Human Review',
    '',
    'Automated heuristics detect obvious corruption only; human visual review remains required for changed screenshots and changed document layouts.',
    '',
    input.manualReview,
    '',
    '## Final Decision',
    '',
    `**${input.status}** — ${input.summary}`,
  ];
  return `${output.join('\n')}\n`;
}

function changelogEntry(input) {
  return [
    `## ${input.source.guideVersion} — ${input.source.generatedDisplay}`,
    '',
    line('Application version', input.source.applicationVersion),
    line('Git branch', input.source.branch),
    line('Source commit', input.source.commit),
    line('Screenshot changes', input.screenshots.map(({ filename, classification }) => `${filename}: ${classification}`).join('; ')),
    line('Guide changes', input.guideChanges),
    line('Validation result', input.status),
    line('Human review', input.humanReviewRequired ? 'Required' : 'Not required'),
  ].join('\n');
}

export function renderDocumentationChangelog(input, current = '') {
  assertInput(input);
  if (current && !current.startsWith('# Documentation Changelog\n')) {
    throw new Error('Malformed changelog: expected Documentation Changelog heading.');
  }
  const entry = changelogEntry(input);
  const key = `- Source commit: ${input.source.commit}`;
  const screenshotKey = line(
    'Screenshot changes',
    input.screenshots.map(({ filename, classification }) => `${filename}: ${classification}`).join('; '),
  );
  const sections = current
    ? current.trimEnd().split(/\n(?=## )/).slice(1)
    : [];
  const retained = sections.filter((section) => (
    !section.includes(key)
    || !section.startsWith(`## ${input.source.guideVersion} — `)
    || !section.includes(screenshotKey)
  ));
  const result = ['# Documentation Changelog', '', entry, ...retained].join('\n');
  return `${result.trimEnd()}\n`;
}

async function readExisting(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (cause) {
    if (cause.code === 'ENOENT') return '';
    throw cause;
  }
}

async function atomicWrite(path, content, replace = rename) {
  const current = await readExisting(path);
  if (current === content) return 'UNCHANGED';
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, content, 'utf8');
    await replace(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
  return 'UPDATED';
}

export async function writeDocumentationReports(options) {
  const currentChangelog = await readExisting(options.changelogPath);
  const report = renderDocumentationReport(options.input);
  const changelog = renderDocumentationChangelog(options.input, currentChangelog);
  const reportResult = await atomicWrite(options.reportPath, report, options.replace);
  const changelogResult = await atomicWrite(options.changelogPath, changelog, options.replace);
  return Object.freeze({ report: reportResult, changelog: changelogResult });
}
