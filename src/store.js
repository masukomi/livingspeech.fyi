// Persists settings and recent phrases in localStorage.
// Every access is guarded: storage can be unavailable (private browsing,
// blocked site data), and the app still works without it.

export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const RECENT_MAX = 50;

const KEYS = {
    settings: "livingspeech.settings",
    recent: "livingspeech.recent",
};

function readJSON(key, fallback) {
    try {
        const raw = globalThis.localStorage?.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJSON(key, value) {
    try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
        // storage full or blocked; nothing more we can do
    }
}

// --- settings ---

/**
 * @typedef {object} Settings
 * @property {string} voiceURI  the chosen voice's voiceURI; empty means the system default
 * @property {number} textSize  the UI text size as a percentage of the browser default; 0 means 100
 * @property {string} pronunciations  one "word -> replacement" per line (see pronounce.js)
 * @property {"light"|"dark"|"system"} theme  the color scheme; "system" follows the device
 * @property {string[]} quickButtons  labels of the quick buttons above the recent list; blank hides one
 */

export const DEFAULT_QUICK_BUTTONS = ["No", "Maybe", "Don't know", "Yes"];

/** @returns {Settings} */
export function loadSettings() {
    return {
        voiceURI: "", textSize: 0, pronunciations: "", theme: "system", quickButtons: DEFAULT_QUICK_BUTTONS,
        ...readJSON(KEYS.settings, {}),
    };
}

/** @param {Partial<Settings>} changes */
export function saveSettings(changes) {
    writeJSON(KEYS.settings, {...loadSettings(), ...changes});
}

// --- recent phrases ---

/**
 * Phrases spoken within the last 24 hours, newest first.
 * @returns {{text: string, at: number}[]}
 */
export function listRecent(now = Date.now()) {
    const entries = readJSON(KEYS.recent, []);
    const kept = prune(entries, now);
    if (kept.length !== entries.length) writeJSON(KEYS.recent, kept);
    return kept;
}

/** Record text, moving an existing identical entry to the top. */
export function addRecent(text, now = Date.now()) {
    text = text.trim();
    if (!text) return;
    const others = readJSON(KEYS.recent, []).filter((e) => e.text !== text);
    writeJSON(KEYS.recent, prune([{text, at: now}, ...others], now));
}

/** Forget every recent phrase. */
export function clearRecent() {
    try {
        globalThis.localStorage?.removeItem(KEYS.recent);
    } catch {
        // storage blocked; there's nothing saved to remove
    }
}

// Drop expired entries and cap the list.
function prune(entries, now) {
    const cutoff = now - RECENT_WINDOW_MS;
    return entries.filter((e) => e.at > cutoff).slice(0, RECENT_MAX);
}
