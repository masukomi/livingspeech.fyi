// Keeps the installed app current. The service worker serves the app from its
// cache so it opens instantly and works offline; on each launch (and each time
// it's brought back to the foreground) we ask the server whether sw.js has
// changed. A new version installs in the background and takes over at once.

// Re-checks when the app returns to the foreground no more often than this.
const RECHECK_MS = 60_000;

let registration = null;
let lastCheck = 0;

/**
 * Register the service worker and check for a newer version.
 * @param {() => void} onUpdated runs when a new version has taken over and
 *   the page should reload to use it.
 */
export async function initUpdates(onUpdated) {
    if (!("serviceWorker" in navigator)) return;

    // With no controller this is the first visit; the worker taking control
    // then is the install, not an update.
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (hadController) onUpdated();
        hadController = true;
    });

    try {
        // updateViaCache: "none" makes update checks bypass the HTTP cache.
        registration = await navigator.serviceWorker.register("sw.js", {updateViaCache: "none"});
    } catch (e) {
        console.warn("Service worker registration failed:", e);
        return;
    }
    void check();

    // An installed iOS web app usually resumes rather than relaunching.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && Date.now() - lastCheck > RECHECK_MS) void check();
    });
}

async function check() {
    if (!registration) return;
    lastCheck = Date.now();
    try {
        await registration.update();
    } catch {
        // offline; the cached version keeps working
    }
}

/**
 * Check now, for the "Check for updates" button.
 * @returns {Promise<string>} a message for the user
 */
export async function checkNow() {
    if (!registration) return "Updates aren't available in this browser.";
    if (!navigator.onLine) return "You're offline. Try again when you're connected.";
    await check();
    if (registration.installing || registration.waiting) return "Updating…";
    return "You have the latest version.";
}
