// Serves LivingSpeech from a cache so it opens instantly and works offline.
//
// scripts/build.mjs replaces VERSION with a build hash of the app's files and fills
// in ASSETS. Any change to the app therefore changes this file, which is how
// the browser notices there's a new version: it installs this worker in the
// background, which caches the new files and takes over from the old one.

const VERSION = "dev";
const ASSETS = ["./"];

const CACHE = `livingspeech-${VERSION}`;
const DEV = VERSION === "dev";

// Settles once this version's files are cached. Chrome checks whether a new
// install works offline by fetching start_url through the worker with the
// network cut off, and can do so while the worker is still installing, so
// fetches wait for the precache rather than answer from an empty cache.
let ready = Promise.resolve();

self.addEventListener("install", (event) => {
    ready = (async () => {
        const cache = await caches.open(CACHE);
        // "reload" skips the HTTP cache, so we never cache stale copies.
        await cache.addAll(ASSETS.map((url) => new Request(url, {cache: "reload"})));
    })();
    // Take over without waiting for every tab to close.
    event.waitUntil(ready.then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        for (const key of await caches.keys()) {
            if (key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", (event) => {
    const {request} = event;
    if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
    event.respondWith(DEV ? networkFirst(request) : cacheFirst(request));
});

// The ASSETS entry a request is for, or null for anything else. A page the app
// ships (docs/) is served as itself; any other page in scope is the app, as is
// the scope root however it's requested: Chrome fetches start_url directly
// when it checks whether the app installs.
function assetKey(request) {
    const scopePath = new URL(self.registration.scope).pathname;
    let path = new URL(request.url).pathname.slice(scopePath.length);
    if (path.endsWith("/")) path += "index.html";
    if (ASSETS.includes(path)) return path;
    if (request.mode === "navigate" || path === "" || path === "index.html") return "./";
    return null;
}

// The cache holds one copy of each file, so a response's Vary header (the
// server sends Vary: User-Agent) must not stop a request from matching it.
const MATCH = {ignoreSearch: true, ignoreVary: true};

async function cacheFirst(request) {
    await ready;
    const cache = await caches.open(CACHE);
    const key = assetKey(request);
    const cached = await cache.match(key ?? request, MATCH);
    if (cached) return cached;
    // Not cached: the browser evicted it, or it's a file the app doesn't
    // ship. Fetch it, and keep a copy of anything that belongs to this
    // version so a single eviction doesn't leave the app broken offline.
    const response = await fetch(request);
    if (key && response.ok && !response.redirected) await cache.put(key, response.clone());
    return response;
}

// During development, always fetch fresh files, falling back to the cache offline.
async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch (e) {
        const cached = await caches.match(request, MATCH);
        if (cached) return cached;
        throw e;
    }
}
