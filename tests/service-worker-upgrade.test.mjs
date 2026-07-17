import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile("service-worker.js", "utf8");
assert.match(source, /const CACHE_VERSION = 'v2\.7\.0-alpha\.2';/, "reconciled cache must advance from v2.7.0-alpha.1 to v2.7.0-alpha.2");

const listeners = new Map();
const openedCaches = [];
const deletedCaches = [];
const cachedAssets = [];
const putEntries = [];
let skipWaitingCalls = 0;
let claimCalls = 0;
let fetchMode = "online";

const cachedIndex = { source: "cache-index" };
const cachedAsset = { source: "cache-asset" };
const networkResponse = {
  status: 200,
  source: "network",
  clone() { return { ...this, source: "network-clone" }; },
};
const cache = {
  async addAll(assets) { cachedAssets.push(...assets); },
  async put(key, value) { putEntries.push([key, value]); },
};

const context = {
  self: {
    addEventListener(type, listener) { listeners.set(type, listener); },
    async skipWaiting() { skipWaitingCalls += 1; },
    clients: { async claim() { claimCalls += 1; } },
  },
  caches: {
    async open(name) { openedCaches.push(name); return cache; },
    async keys() { return ["sales-capture-v2.7.0-alpha.1", "sales-capture-v2.6.0", "sales-capture-v2.7.0-alpha.2", "unrelated-cache"]; },
    async delete(name) { deletedCaches.push(name); return true; },
    async match(request) {
      if (request === "/index.html") return cachedIndex;
      if (request?.url?.endsWith("/css/app.css")) return cachedAsset;
      return undefined;
    },
  },
  async fetch() {
    if (fetchMode === "offline") throw new Error("offline");
    return networkResponse;
  },
  Promise,
  console,
};

vm.runInNewContext(source, context, { filename: "service-worker.js" });
assert.deepEqual([...listeners.keys()].sort(), ["activate", "fetch", "install"]);

let lifecyclePromise;
listeners.get("install")({ waitUntil(promise) { lifecyclePromise = promise; } });
await lifecyclePromise;
assert.equal(openedCaches[0], "sales-capture-v2.7.0-alpha.2", "fresh install must populate the new cache");
assert.equal(skipWaitingCalls, 1, "fresh install must retain immediate worker activation");
assert.deepEqual(cachedAssets, [
  "/", "/index.html", "/manifest.webmanifest", "/css/app.css", "/js/app.js",
  "/lavida-template-page-1.jpg", "/lavida-template-page-2.jpg",
  "/icons/icon-192.png", "/icons/icon-512.png", "/icons/asg_logo.png", "/icons/landing.png",
  "/templates/rendered/first-consult-brisbane-page-1.jpg", "/templates/rendered/first-consult-brisbane-page-2.jpg",
  "/templates/rendered/first-consult-brisbane-page-3.jpg", "/templates/rendered/first-consult-brisbane-page-4.jpg",
  "/templates/rendered/first-consult-brisbane-page-5.jpg", "/templates/rendered/first-consult-brisbane-page-6.jpg",
  "/templates/rendered/first-consult-perth-page-1.jpg", "/templates/rendered/first-consult-perth-page-2.jpg",
  "/templates/rendered/first-consult-perth-page-3.jpg", "/templates/rendered/first-consult-perth-page-4.jpg",
  "/templates/rendered/first-consult-perth-page-5.jpg", "/templates/rendered/first-consult-perth-page-6.jpg",
  "/templates/rendered/client-review-page-1.jpg", "/templates/rendered/client-review-page-2.jpg",
  "/templates/rendered/client-review-page-3.jpg", "/templates/rendered/client-review-page-4.jpg",
], "fresh install must preserve the existing application shell and order");

listeners.get("activate")({ waitUntil(promise) { lifecyclePromise = promise; } });
await lifecyclePromise;
assert.deepEqual(deletedCaches, ["sales-capture-v2.7.0-alpha.1", "sales-capture-v2.6.0"], "upgrade must delete previous application caches without touching unrelated caches");
assert.equal(claimCalls, 1, "upgrade must retain immediate client claiming");

async function dispatchFetch(request) {
  let responsePromise;
  listeners.get("fetch")({ request, respondWith(promise) { responsePromise = promise; } });
  return responsePromise ? responsePromise : undefined;
}

fetchMode = "online";
assert.equal((await dispatchFetch({ method: "GET", mode: "navigate", url: "https://test.local/" })).source, "network");
await new Promise((resolve) => setTimeout(resolve, 0));
assert.ok(putEntries.some(([key]) => key === "/index.html"), "online navigation must still refresh the cached HTML");

fetchMode = "offline";
assert.equal(await dispatchFetch({ method: "GET", mode: "navigate", url: "https://test.local/" }), cachedIndex, "offline navigation must retain the cached HTML fallback");
assert.equal(await dispatchFetch({ method: "GET", mode: "same-origin", url: "https://test.local/css/app.css" }), cachedAsset, "offline assets must remain cache-first");
assert.equal(await dispatchFetch({ method: "POST", mode: "same-origin", url: "https://test.local/save" }), undefined, "non-GET requests must remain unmanaged");

console.log("PASS service-worker fresh install, upgrade cleanup, and offline strategy");
