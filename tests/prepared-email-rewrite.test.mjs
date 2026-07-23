import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for(let index=bodyStart; index<source.length; index+=1){
    if(source[index] === '{') depth += 1;
    if(source[index] === '}') depth -= 1;
    if(depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const emailFunctionNames = ['formatEmailTime','emailNextAppointment','resolveShareCc','buildShareEmailContent'];
if(source.includes('function formatContractIssued(')) emailFunctionNames.splice(1, 0, 'formatContractIssued');
const emailFunctions = emailFunctionNames.map(functionSource).join('\n');

function buildEmail({
  mode='inperson',
  values={},
  due={valid:true,value:'15/08/2026'},
  staffRecord={active:true,email:'Blake@amplifysolutionsgroup.com.au'},
  share={to:'Natalie@sjssolutionscorp.com.au',cc:'Garry@sjssolutionscorp.com.au'}
}={}) {
  const fields = {
    teamMember:'Blake Duffield', clientName:'John Smith', client2Name:'Jenny Smith',
    propertySaleAddress:'Test Unit, Footscray VIC', date:'2026-07-21',
    eoiNextApptDate:'2026-08-02', eoiNextApptTime:'14:05', crNextAppointmentDate:'2026-08-03',
    ...values
  };
  const FixedDate = class extends Date {
    constructor(...args){ super(...(args.length ? args : ['2026-07-21T10:39:00+08:00'])); }
  };
  return Function(
    'fieldText','formatDisplayDate','appointmentMode','CONFIG','staffRecordForValue','validEmail',
    'lastPdfName','pdfFileName','resolveContractDueDate','Date',
    `${emailFunctions}; return buildShareEmailContent();`
  )(
    id => fields[id] || '',
    value => { const [y,m,d] = String(value).split('-'); return y && m && d ? `${d}/${m}/${y}` : value; },
    mode, {share}, () => staffRecord, value => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    '', () => 'appointment.pdf', () => due, FixedDate
  );
}

const inPerson = buildEmail();
assert.equal(inPerson.subject, 'Sales Appointment Documents | John Smith & Jenny Smith | 21/07/2026');
assert.equal(inPerson.body, `Hi Natalie,

Please find the completed sales appointment documents for the following appointment.

Clients:
John Smith & Jenny Smith

Property:
Test Unit, Footscray VIC

Appointment Date:
21/07/2026

Contract Due Date:
15/08/2026

Next Appointment:
02/08/2026 2:05 PM

Kind regards,

Blake Duffield`);
assert.equal(inPerson.fallbackBody, inPerson.body);
assert.equal(inPerson.to, 'Natalie@sjssolutionscorp.com.au');
assert.equal(inPerson.cc, 'Blake@amplifysolutionsgroup.com.au');

const zoomTbc = buildEmail({ mode:'zoom', due:{valid:true,value:'To Be Confirmed'} });
assert.match(zoomTbc.body, /Contract Due Date:\nTo Be Confirmed\n\nNext Appointment:\n03\/08\/2026\n/);
assert.doesNotMatch(zoomTbc.body, /03\/08\/2026\s+\d/, 'Zoom must not invent a time');

const noNext = buildEmail({ values:{eoiNextApptDate:'',eoiNextApptTime:'',crNextAppointmentDate:''} });
assert.equal(noNext.body, `Hi Natalie,

Please find the completed sales appointment documents for the following appointment.

Clients:
John Smith & Jenny Smith

Property:
Test Unit, Footscray VIC

Appointment Date:
21/07/2026

Contract Due Date:
15/08/2026

Kind regards,

Blake Duffield`);
assert.doesNotMatch(noNext.body, /Next Appointment:|N\/A|Not Set/);

assert.equal(buildEmail({ due:{valid:false,value:''} }), null, 'invalid due date cannot produce an email or inferred TBC');
assert.equal(buildEmail({ staffRecord:{active:true,email:'Natalie@sjssolutionscorp.com.au'} }).cc, '', 'primary recipient is not duplicated in CC');
assert.equal(buildEmail({ staffRecord:{active:true,email:''} }).cc, 'Garry@sjssolutionscorp.com.au', 'fallback CC remains intact');

for(const body of [inPerson.body, zoomTbc.body, noNext.body]){
  assert.doesNotMatch(body, /Contract Issued:/);
  assert.doesNotMatch(body, /21\/07\/2026 10:39 AM/, 'email-generation timestamp is absent');
  assert.doesNotMatch(body, /downloaded|Downloads folder|Files app|ZIP package|attach both|attach the|browser|mailto/i);
  assert.doesNotMatch(body, /<[^>]+>|^[-*]\s/m, 'body remains plain text without markup or bullets');
}

const mime = {'.css':'text/css','.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg+xml':'image/svg+xml'};
const server = createServer((request,response)=>{
  const pathname = new URL(request.url,'http://127.0.0.1').pathname;
  const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = resolve(root, normalize(relative));
  if(!file.startsWith(root)) return response.writeHead(403).end();
  try{ response.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream'}).end(readFileSync(file)); }
  catch{ response.writeHead(404).end(); }
});
await new Promise(resolveListen => server.listen(0,'127.0.0.1',resolveListen));
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
  window.__nativeShareCalls=[];
  Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
  Object.defineProperty(navigator,'share',{configurable:true,value:data=>{window.__nativeShareCalls.push(data); return Promise.resolve();}});
});
const page = await context.newPage();

try{
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
  await page.selectOption('#landingStaff','Garry Lewis');
  await page.click('#landingContinue');
  page.once('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>document.querySelector('#loadTestData').click());
  await page.uncheck('#contractDueDateTbc');
  await page.fill('#contractDueDate','');
  await page.click('#generateTop');
  await page.locator('#contractDueDateField .fieldError').waitFor({timeout:10000});
  assert.match(await page.textContent('#contractDueDateField .fieldError'), /Select a Contract Due Date or choose To Be Confirmed/);
  assert.equal(await page.evaluate(()=>window.__nativeShareCalls.length),0,'invalid due date prevents native share');
  assert.equal(await page.locator('#shareEmailFallback').evaluate(el=>el.classList.contains('hidden')),true,'invalid due date prevents mailto fallback');
  assert.equal(await page.getAttribute('#openPreparedEmail','href'),'#','invalid due date does not prepare a mailto body');

  assert.equal(await page.locator('#contractDueDate').count(),1);
  assert.equal(await page.locator('#contractDueDateTbc').count(),1);
  assert.deepEqual(await page.evaluate(()=>window._testState.resolveContractDueDate()),{valid:false,value:''});
  assert.deepEqual(await page.locator('#iaSolicitorOption option').allTextContents(),['B.O.S.S Conveyancing','Natalie to Confirm','Other']);
  assert.match(source,/const APP_VERSION = '2\.7\.0-alpha\.1';/);
assert.match(swSource,/const CACHE_VERSION = 'v2\.7\.0-alpha\.21';/);

  console.log(JSON.stringify({
    subject:inPerson.subject,
    inPersonBody:inPerson.body,
    zoomTbcBody:zoomTbc.body,
    noNextBody:noNext.body,
    invalidDueDateBlocked:true,
    recipient:inPerson.to,
    cc:inPerson.cc
  },null,2));
  console.log('PASS prepared email rewrite content, due-date, recipient, next-appointment, and validation contracts');
} finally {
  await context.close();
  await browser.close();
  await new Promise(resolveClose=>server.close(resolveClose));
}
