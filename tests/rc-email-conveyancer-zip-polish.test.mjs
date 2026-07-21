import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const emailFunctions = [
  'formatEmailTime',
  'formatContractIssued',
  'emailNextAppointment',
  'resolveShareCc',
  'buildShareEmailContent'
].map(functionSource).join('\n');

function buildEmail({ mode='inperson', values={}, staffRecord, share={ to:'Natalie@sjssolutionscorp.com.au', cc:'Garry@sjssolutionscorp.com.au' } }) {
  const fields = {
    teamMember:'Blake Duffield', clientName:'Alex / Smith', client2Name:'Jenny: Jones',
    propertySaleAddress:'1 Test Street, Perth WA 6000', date:'2026-07-21',
    eoiNextApptDate:'2026-08-02', eoiNextApptTime:'14:05', crNextAppointmentDate:'2026-08-03',
    ...values
  };
  const FixedDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-07-21T10:39:00+08:00'])); }
  };
  return Function(
    'fieldText', 'formatDisplayDate', 'appointmentMode', 'CONFIG', 'staffRecordForValue',
    'validEmail', 'lastPdfName', 'pdfFileName', 'Date',
    `${emailFunctions}; return buildShareEmailContent();`
  )(
    id => fields[id] || '',
    value => { const [y,m,d] = String(value).split('-'); return y && m && d ? `${d}/${m}/${y}` : value; },
    mode, { share }, () => staffRecord || { active:true, email:'Blake@amplifysolutionsgroup.com.au' },
    value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), '', () => 'appointment.pdf', FixedDate
  );
}

const inPerson = buildEmail({});
assert.equal(inPerson.subject, 'Sales Appointment Documents | Alex / Smith & Jenny: Jones | 21/07/2026');
assert.equal(inPerson.body, `Hi Natalie,

Please find the completed sales appointment documents for the following clients:

Clients:
Alex / Smith & Jenny: Jones

Property:
1 Test Street, Perth WA 6000

Appointment Date:
21/07/2026

Next Appointment:
02/08/2026 2:05 PM

Contract Issued:
21/07/2026 10:39 AM

The appointment PDF and supporting ZIP package have been downloaded to this device.

Please attach both files to this email before sending.

Kind regards,

Blake Duffield`);
assert.equal(inPerson.fallbackBody, inPerson.body, 'prepared fallback uses the exact approved body');

const zoom = buildEmail({ mode:'zoom' });
assert.match(zoom.body, /Next Appointment:\n03\/08\/2026\n/);
assert.doesNotMatch(zoom.body, /03\/08\/2026 2:05 PM/, 'Zoom must not invent the EOI time');

const noNext = buildEmail({ values:{ eoiNextApptDate:'', eoiNextApptTime:'', crNextAppointmentDate:'' } });
assert.doesNotMatch(noNext.body, /Next Appointment:/, 'blank next appointment omits the complete block');
assert.equal(buildEmail({ staffRecord:{ active:true, email:'Natalie@sjssolutionscorp.com.au' } }).cc, '', 'primary recipient is not duplicated in CC');
assert.equal(buildEmail({ staffRecord:{ active:true, email:'blake@example.com' } }).cc, 'blake@example.com');

const filenameFunctions = ['safePart', 'clientNamesForFilename', 'clientNameForFilename', 'zipFileName', 'individualPhotoFilename'].map(functionSource).join('\n');
const fields = { date:'2026-07-21', clientName:'Alex / Smith. ', client2Name:'Jenny:  Jones...' };
const filenameApi = Function('fieldText', '$', 'formatDisplayDate', 'appointmentMode', `${filenameFunctions}; return { safePart, zipFileName, individualPhotoFilename };`)(
  id => fields[id] || '', id => ({ value:fields[id] || '' }), value => value.split('-').reverse().join('/'), 'inperson'
);
assert.equal(filenameApi.safePart('  A/B::  Client...  ', 'Client'), 'A B Client');
assert.equal(filenameApi.zipFileName(), '21-07-2026 - Alex Smith & Jenny Jones - Sales Appointment Documents.zip');
assert.equal(filenameApi.individualPhotoFilename({}, 0), 'Alex Smith - ID Front.pdf');
assert.equal(filenameApi.individualPhotoFilename({}, 3), 'Jenny Jones - ID Back.pdf');
assert.equal(filenameApi.individualPhotoFilename({ client:'Client 2', description:'Rates / Notice.' }, 4), 'Jenny Jones - Rates Notice.pdf');
const exampleZipListing = [
  filenameApi.individualPhotoFilename({}, 0),
  filenameApi.individualPhotoFilename({}, 1),
  filenameApi.individualPhotoFilename({}, 2),
  filenameApi.individualPhotoFilename({}, 3),
  filenameApi.individualPhotoFilename({ client:'Client 2', description:'Rates / Notice.' }, 4)
];

assert.match(source, /<input id="\$\{fieldId\}"[^>]*list="\$\{listId\}"/);
assert.match(source, /<datalist id="\$\{listId\}"/);
assert.match(source, /const APP_VERSION = '2\.7\.0-alpha\.1';/);
console.log(JSON.stringify({ exampleEmail:inPerson, exampleZipName:filenameApi.zipFileName(), exampleZipListing }, null, 2));
console.log('PASS RC email, conveyancer, and ZIP polish contracts');
