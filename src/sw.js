// Serves LivingSpeech from a cache so it opens instantly and works offline.
//
// scripts/build.mjs replaces VERSION with a hash of the app's files and fills
// in ASSETS. Any change to the app therefore changes this file, which is how
// the browser notices there's a new version: it installs this worker in the
// background, which caches the new files and takes over from the old one.

const VERSION = "dev";
const ASSETS = ["./"];

const CACHE = `livingspeech-${VERSION}`;
const DEV = VERSION === "dev";

self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // "reload" skips the HTTP cache, so we never cache stale copies.
        await cache.addAll(ASSETS.map((url) => new Request(url, {cache: "reload"})));
        await self.skipWaiting(); // take over without waiting for every tab to close
    })());
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

async function cacheFirst(request) {
    const cache = await caches.open(CACHE);
    // Any page in scope is the app itself.
    const key = request.mode === "navigate" ? "./" : request;
    return (await cache.match(key, {ignoreSearch: true})) ?? fetch(request);
}

// During development, always fetch fresh files, falling back to the cache offline.
async function networkFirst(request) {
    try {
        return await fetch(request);
    } catch (e) {
        const cached = await caches.match(request, {ignoreSearch: true});
        if (cached) return cached;
        throw e;
    }
}
