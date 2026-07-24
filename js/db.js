/* IndexedDB wrapper for Sales Appointment Capture drafts.
   Schema version 1: form state, signatures, ID images, whiteboard, metadata, retention timestamps.
   AUTOMATED ONLY. No real client data. */

(function(){
'use strict';

const DB_NAME = 'sales-appointment-capture';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_KEY = 'active';
const LEGACY_KEY = 'salesAppointmentDraft';
const RETENTION_DAYS = 7;

var _db = null;

function openDB(){
  if(_db) return Promise.resolve(_db);
  return new Promise(function(resolve, reject){
    var request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = function(event){
      var db = event.target.result;
      if(!db.objectStoreNames.contains(STORE_NAME)){
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = function(event){
      _db = event.target.result;
      resolve(_db);
    };
    request.onerror = function(event){
      reject(event.target.error);
    };
  });
}

function tx(mode){
  return openDB().then(function(db){
    return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
  });
}

/* Save draft with schema version, timestamps and atomic replacement */
function saveDraft(draftData){
  return tx('readwrite').then(function(store){
    return new Promise(function(resolve, reject){
      var existing = draftData;
      if(typeof existing === 'object'){
        var now = new Date().toISOString();
        var saved = {
          schemaVersion: DB_VERSION,
          draft: existing,
          created: existing._created || now,
          lastSaved: now,
          expiry: existing._created ? existing._expiry : new Date(Date.now() + RETENTION_DAYS * 86400000).toISOString()
        };
        var putReq = store.put(saved, DRAFT_KEY);
        putReq.onsuccess = function(){ resolve({ok:true, reason:'saved'}); };
        putReq.onerror = function(){ reject(putReq.error); };
      } else {
        reject(new Error('Invalid draft data'));
      }
    });
  }).catch(function(err){
    if(err && err.name === 'QuotaExceededError'){
      return {ok:false, reason:'quota'};
    }
    return {ok:false, reason:'unavailable'};
  });
}

/* Load draft. Returns {status:'valid',draft} or {status:'corrupt',meta} or {status:'missing'} */
function loadDraft(){
  return tx('readonly').then(function(store){
    return new Promise(function(resolve){
      var getReq = store.get(DRAFT_KEY);
      getReq.onsuccess = function(){
        var result = getReq.result;
        if(!result){
          resolve({status:'missing'});
          return;
        }
        try {
          if(!result.draft || typeof result.draft !== 'object'){
            resolve({status:'corrupt', meta:{schemaVersion:result.schemaVersion||'unknown', reason:'Invalid draft shape'}});
            return;
          }
          // Check expiry
          if(result.expiry && new Date(result.expiry) < new Date()){
            resolve({status:'expired', draft:result.draft, meta:{expiry:result.expiry}});
            return;
          }
          resolve({status:'valid', draft:result.draft, meta:{created:result.created, lastSaved:result.lastSaved, expiry:result.expiry}});
        } catch(e){
          resolve({status:'corrupt', meta:{schemaVersion:result.schemaVersion||'unknown', reason:e.message}});
        }
      };
      getReq.onerror = function(){
        resolve({status:'corrupt', meta:{reason:getReq.error?getReq.error.message:'Unknown error'}});
      };
    });
  }).catch(function(){
    return {status:'missing'};
  });
}

/* Delete draft with confirmation */
function deleteDraft(confirmed){
  if(!confirmed) return Promise.resolve({ok:false, reason:'not confirmed'});
  return tx('readwrite').then(function(store){
    return new Promise(function(resolve){
      var delReq = store.delete(DRAFT_KEY);
      delReq.onsuccess = function(){ resolve({ok:true, reason:'deleted'}); };
      delReq.onerror = function(){ resolve({ok:false, reason:'delete failed'}); };
    });
  }).catch(function(){
    return {ok:false, reason:'unavailable'};
  });
}

/* Remove expired drafts */
function removeExpiredDrafts(){
  return loadDraft().then(function(result){
    if(result.status === 'expired'){
      return deleteDraft(true);
    }
    return {ok:true, reason:'not expired'};
  });
}

/* One-time migration from legacy localStorage */
function migrateFromLegacy(){
  try {
    var legacy = localStorage.getItem(LEGACY_KEY);
    if(!legacy) return Promise.resolve({migrated:false, reason:'no legacy draft'});

    var parsed = JSON.parse(legacy);
    if(!parsed || typeof parsed !== 'object') return Promise.resolve({migrated:false, reason:'invalid legacy draft'});

    return loadDraft().then(function(existing){
      if(existing.status === 'valid'){
        return {migrated:false, reason:'existing IndexedDB draft present, not overwriting'};
      }
      // Perform migration
      parsed._created = parsed.draftSavedAt || new Date().toISOString();
      parsed._expiry = new Date(Date.now() + RETENTION_DAYS * 86400000).toISOString();
      return saveDraft(parsed).then(function(saveResult){
        if(saveResult.ok){
          localStorage.removeItem(LEGACY_KEY);
          return {migrated:true, reason:'legacy draft migrated to IndexedDB'};
        }
        return {migrated:false, reason:'save failed during migration', details:saveResult.reason};
      });
    });
  } catch(e){
    return Promise.resolve({migrated:false, reason:'migration error: ' + e.message});
  }
}

/* Quota estimation — returns approximate used bytes and available estimate */
function estimateQuota(){
  if(navigator.storage && navigator.storage.estimate){
    return navigator.storage.estimate().then(function(est){
      return {usage:est.usage||0, quota:est.quota||0, percentUsed:est.quota?Math.round(est.usage/est.quota*100):0};
    }).catch(function(){ return null; });
  }
  return Promise.resolve(null);
}

window._db = {
  open: openDB,
  saveDraft: saveDraft,
  loadDraft: loadDraft,
  deleteDraft: deleteDraft,
  migrateFromLegacy: migrateFromLegacy,
  removeExpiredDrafts: removeExpiredDrafts,
  estimateQuota: estimateQuota,
  RETENTION_DAYS: RETENTION_DAYS,
  DRAFT_KEY: DRAFT_KEY,
  LEGACY_KEY: LEGACY_KEY
};

})();
