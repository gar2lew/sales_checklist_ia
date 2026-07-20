import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('js/app.js', 'utf8');
const boundary = source.indexOf('  // Builder registry for extensible EOI template support.');
assert.ok(boundary > 0, 'configuration initialization boundary must remain identifiable');

const instrumented = source
  .slice(0, boundary)
  .replace(
    '  let adminSettings = loadAdminSettings();',
    '  let adminSettings = JSON.parse(JSON.stringify(defaultAdminSettings));'
  ) + `
  globalThis.__configurationContracts = {
    appVersion: APP_VERSION,
    adminPin: ADMIN_PIN,
    defaultAdminSettings,
    zoomDefaults,
    config: CONFIG,
    canonical: typeof DEFAULT_APP_CONFIGURATION === 'undefined' ? undefined : DEFAULT_APP_CONFIGURATION,
    cloneDefaults: typeof cloneDefaultAdminSettings === 'function' ? cloneDefaultAdminSettings : undefined
  };
})();`;

const context = { console };
vm.runInNewContext(instrumented, context, { filename: 'app-configuration-prefix.js' });
const actual = JSON.parse(JSON.stringify(context.__configurationContracts));

const expectedAdminSettings = {
  staff: { mode: 'select', options: [
    { id:'garry-lewis', name:'Garry Lewis', email:'Garry@sjssolutionscorp.com.au', office:'Both', role:'Super Admin', active:true },
    { id:'nat-simmich', name:'Natalie Simmich', email:'Natalie@sjssolutionscorp.com.au', office:'Both', role:'Admin', active:true }
  ] },
  branch: { options: ['Perth', 'Brisbane'] },
  solicitor: { mode: 'select', options: ['B.O.S.S Conveyancing'] },
  eoiTemplates: { options: [
    { value: 'standard', label: 'Standard' },
    { value: 'laVidaHomes', label: 'La Vida Homes' }
  ] },
  pdfDefaults: {
    authorityAmount: '$10,000',
    financePercent: '',
    branch: 'Perth',
    compressPhotos: true,
    iaApplySignature1: true,
    iaApplySignature2: true
  },
  laVidaFinanceBrokers: { options: [
    { id: 'cooperSachrHeartOfLending', name: 'COOPER SACHR - HEART OF LENDING', email: 'cooper@heartoflending.com.au', phone: '0404353333' }
  ] },
  laVidaConveyancers: { options: [
    { id: 'hgpConveyancingRodyPapas', name: 'HGP Conveyancing Pty Ltd / Rody Papas', email: 'rody@hgpconveyancing.com.au', phone: '(08) 8231 2884' }
  ] },
  laVidaDefaults: {
    financeBrokerId: 'cooperSachrHeartOfLending',
    conveyancerId: 'hgpConveyancingRodyPapas'
  },
  additionalDocTypes: {
    options: ['Medicare Card', 'Passport', 'Driver Licence', 'Utility Bill', 'Bank Statement', 'Rates Notice', 'Other']
  }
};

const expectedZoomDefaults = {
  builders: ['Metricon','Carlisle Homes','Burbank','Celebration Homes','Jandson','Eichmann','Backyard','Blueprint','Smart Home','Designer Homes'],
  developers: ['ASG','Oliver Hume','RPV Projects','SJD Homes','LandCorp'],
  timeline: ['1-3 months','3-6 months','6-12 months','12+ months','TBC']
};

assert.equal(actual.appVersion, '2.7.0-alpha.1');
assert.equal(actual.adminPin, '1234');
assert.deepEqual(actual.defaultAdminSettings, expectedAdminSettings, 'fresh admin settings shape and exact defaults must not change');
assert.deepEqual(actual.zoomDefaults, expectedZoomDefaults, 'Zoom defaults and ordering must not change');
assert.deepEqual(actual.config.share, {
  to: 'Natalie@sjssolutionscorp.com.au',
  cc: 'Garry@sjssolutionscorp.com.au',
  fallbackStaffName: 'ASG Team',
  nativeShareTimeoutMs: 2500
}, 'share compatibility values must not change');
assert.deepEqual(actual.config.defaults, {
  iaAmount: '$10,000',
  iaForm: 'perth',
  eoiTemplate: 'standard'
}, 'appointment and template defaults must not change');
assert.equal(actual.config.toastDurationMs, 3200);
assert.equal(actual.config.branding.footerPrefix, 'Sales Appointment Capture');
assert.equal(actual.canonical.ui.autosaveDelayMs, 15000, 'autosave timing must remain 15000ms');
assert.deepEqual(actual.canonical.staff.officeAssignments, ['Perth', 'Brisbane', 'Both'], 'staff assignments must remain separate from appointment offices');
assert.deepEqual(actual.canonical.organisation.offices, ['Perth', 'Brisbane'], 'appointment office values must not gain Both');
assert.match(source, /const adminSettingsKey = 'salesAppointmentAdminSettings';/, 'admin settings storage key must remain unchanged');

assert.ok(context.__configurationContracts.canonical, 'DEFAULT_APP_CONFIGURATION must be introduced');
const canonical = context.__configurationContracts.canonical;
assert.ok(Object.isFrozen(canonical), 'canonical configuration must be frozen');
assert.ok(Object.isFrozen(canonical.templates.laVida.financeBrokers.options[0]), 'canonical configuration must be deeply frozen');
assert.ok(Object.isFrozen(canonical.appointments.zoom.builders), 'canonical nested arrays must be frozen');
assert.equal(Reflect.set(canonical.admin, 'pin', 'changed'), false, 'canonical scalar defaults must reject mutation');
assert.throws(
  () => canonical.appointments.zoom.builders.push('Mutation'),
  /object is not extensible/,
  'canonical arrays must reject mutation'
);

const canonicalSnapshot = JSON.stringify(canonical);
context.__configurationContracts.defaultAdminSettings.branch.options.push('Mutation');
context.__configurationContracts.zoomDefaults.builders.push('Mutation');
assert.equal(JSON.stringify(canonical), canonicalSnapshot, 'mutable compatibility projections must not mutate the canonical object');

console.log('PASS authoritative application configuration defaults, immutability, and compatibility isolation');
