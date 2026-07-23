import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import JSZip from 'jszip';

const root=resolve(import.meta.dirname,'..');
const sourcePath=resolve(root,'docs/user-guides/source/SALES_APPOINTMENT_CAPTURE_USER_GUIDE.md');
const docxPath=resolve(root,'docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.docx');
const pdfPath=resolve(root,'docs/user-guides/ASG_Sales_Appointment_Capture_User_Guide.pdf');
const screenshotDir=resolve(root,'docs/user-guides/screenshots');
const screenshotMetadataPath=resolve(root,'docs/user-guides/screenshots.json');
const screenshots=[
  '01-appointment-type-selection.png','02-in-person-workspace.png','03-sale-details-mobile.png',
  '04-zoom-workspace.png','05-zoom-whiteboard.png','06-draft-controls.png',
  '07-id-signatures.png','08-package-ready.png','09-downloads-started.png'
];

for(const path of [sourcePath,docxPath,pdfPath,screenshotMetadataPath]) assert.equal(existsSync(path),true,`missing ${path}`);
const source=readFileSync(sourcePath,'utf8');
const generatedMetadata={
  'Application version':'2.7.0-alpha.1',
  'Guide version':'1.0.0',
  'Generated':'22 July 2026',
  'Git branch':'fix/staff-dropdown-seeding-v2',
  'Source commit':'9db1800ce947f634520bb391826ad44ded8a6b82'
};
for(let section=1;section<=16;section++) assert.match(source,new RegExp(`^## ${section}\\. `,'m'),`section ${section} missing`);
assert.match(source,/Application version:\*\* 2\.7\.0-alpha\.1/i);
for(const [label,value] of Object.entries(generatedMetadata)){
  assert.ok(source.includes(`**${label}:** ${value}`),`source metadata missing ${label}`);
}
assert.match(source,/Downloads started/);
assert.match(source,/Please tap Prepare Email and attach the Combined PDF and Document ZIP from your Downloads\./);
assert.match(source,/A draft is device-local\. Clearing browser data, removing the PWA or using another device may make that draft unavailable\./);
assert.doesNotMatch(source,/\b(?:TODO|TBD)\b/i);
assert.doesNotMatch(source,/https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.)/i);
assert.doesNotMatch(source,/\b(?:PIN|password|secret)\s*[:=]\s*\S+/i);

function pngDimensions(buffer){
  assert.equal(buffer.subarray(1,4).toString(),'PNG');
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
const screenshotMetadata=JSON.parse(readFileSync(screenshotMetadataPath,'utf8'));
assert.equal(screenshotMetadata.schemaVersion,1);
assert.deepEqual(screenshotMetadata.screenshots.map(({filename})=>filename),screenshots);
for(const [index,name] of screenshots.entries()){
  const path=resolve(screenshotDir,name);
  assert.equal(existsSync(path),true,`missing screenshot ${name}`);
  assert.ok(statSync(path).size>20_000,`${name} is unexpectedly small`);
  const bytes=readFileSync(path);
  const {width,height}=pngDimensions(bytes);
  assert.ok(width>=350 && height>=100,`${name} dimensions are too small: ${width}x${height}`);
  assert.equal(screenshotMetadata.screenshots[index].hash,createHash('sha256').update(bytes).digest('hex'),`${name} metadata hash differs`);
  assert.match(screenshotMetadata.screenshots[index].lastGenerated,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
}

const docxBuffer=readFileSync(docxPath);
assert.ok(docxBuffer.length>100_000,'DOCX is unexpectedly small');
const docx=await JSZip.loadAsync(docxBuffer);
const documentXml=await docx.file('word/document.xml').async('string');
assert.match(documentXml,/Sales Appointment Capture/);
assert.match(documentXml,/A practical guide to completing, reviewing and handing over in-person and Zoom sales appointments/);
for(const [label,value] of Object.entries(generatedMetadata)){
  assert.ok(documentXml.includes(label),`DOCX metadata label missing ${label}`);
  assert.ok(documentXml.includes(value),`DOCX metadata value missing ${label}`);
}
assert.equal(Object.keys(docx.files).filter(name=>/^word\/media\/[^/]+$/.test(name)).length,10);
assert.doesNotMatch(documentXml,/\b(?:TODO|TBD)\b/i);

const pdf=readFileSync(pdfPath);
assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
assert.ok(pdf.length>200_000,'PDF is unexpectedly small');
const pdfText=pdf.toString('latin1');
const pages=[...pdfText.matchAll(/\/Type\s*\/Page\b/g)].length;
assert.ok(pages>=12 && pages<=20,`expected 12-20 PDF pages, found ${pages}`);

console.log(`PASS user guide source, ${screenshots.length} screenshots, DOCX, PDF, privacy, and version contracts (${pages} pages)`);
