// Speaks with the device's own text-to-speech voices via the Web Speech API.

const synth = globalThis.speechSynthesis;

export const supported = typeof synth !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";

// How long to wait for a voice to start before giving up.
export const START_TIMEOUT_MS = 1_500;

// Some engines (Chrome, Android) cut off or stall on long utterances, so long
// text is spoken as a queue of sentence-sized pieces.
const MAX_CHUNK = 200;

let currentID = 0;
// Ends the current utterance's callbacks; set while one is in progress.
let endCurrent = null;
// Chrome can garbage-collect an utterance mid-speech, dropping its events,
// unless something holds a reference to it.
let live = [];

/** The voices the device offers. Some browsers load them asynchronously. */
export function voices() {
    return supported ? synth.getVoices() : [];
}

/** Run cb now and whenever the voice list changes (e.g. after it finishes loading). */
export function onVoicesChanged(cb) {
    if (!supported) return;
    synth.addEventListener?.("voiceschanged", cb);
    cb();
}

/** The voice with this voiceURI, or null for the system default. */
export function findVoice(voiceURI) {
    return (voiceURI && voices().find((v) => v.voiceURI === voiceURI)) || null;
}

/**
 * Speak text, stopping anything already playing. Must first be called from a
 * user gesture (a tap or key press); iOS refuses speech otherwise.
 *
 * @param {string} text
 * @param {{voiceURI?: string, onStart?: () => void, onEnd?: (error?: string) => void}} opts
 *   onStart runs when audio begins; onEnd runs once when speech ends, is
 *   stopped, or fails (with a message).
 * @returns {number} the utterance ID
 */
export function speak(text, {voiceURI = "", onStart = () => {}, onEnd = () => {}} = {}) {
    stop();
    const id = ++currentID;
    const voice = findVoice(voiceURI);
    const pieces = chunk(text);

    let started = false;
    let ended = false;
    const end = (error) => {
        if (ended) return;
        ended = true;
        if (endCurrent === end) endCurrent = null;
        clearTimeout(timer);
        live = live.filter((u) => !utterances.includes(u));
        onEnd(error);
    };
    const timer = setTimeout(() => {
        if (started || id !== currentID) return;
        end(`The voice didn't start within ${START_TIMEOUT_MS / 1000} seconds.`);
        stop();
    }, START_TIMEOUT_MS);

    const utterances = pieces.map((piece, i) => {
        const u = new SpeechSynthesisUtterance(piece);
        if (voice) {
            u.voice = voice;
            u.lang = voice.lang;
        }
        u.onstart = () => {
            if (started || id !== currentID) return;
            started = true;
            onStart();
        };
        if (i === pieces.length - 1) u.onend = () => end();
        u.onerror = (e) => {
            // "interrupted" and "canceled" mean speech was stopped on purpose.
            if (e.error === "interrupted" || e.error === "canceled") end();
            else if (e.error === "not-allowed") end("The browser only allows speech right after a tap or key press. Please try again.");
            else end(`The voice reported an error: ${e.error}.`);
        };
        return u;
    });
    live.push(...utterances);
    endCurrent = end;

    if (synth.paused) synth.resume(); // Chrome can get stuck paused
    for (const u of utterances) synth.speak(u);
    // Nothing to say (e.g. a pronunciation replaced it all). End after
    // returning, so callers see the same order of events as for real speech.
    if (utterances.length === 0) queueMicrotask(() => end());
    return id;
}

export function stop() {
    currentID++;
    // Browsers don't reliably fire end or error events on cancel(), so end it here.
    endCurrent?.();
    // Calling cancel() when idle can make Safari drop the next speak().
    if (supported && (synth.speaking || synth.pending)) synth.cancel();
}

/** Split text into pieces of at most MAX_CHUNK characters, at sentence breaks where possible. */
export function chunk(text) {
    const sentences = text.match(/[^.!?。！？\n]+[.!?。！？]*["')\]]*\s*|\n+/g) ?? [];
    const pieces = [];
    let current = "";
    const flush = () => {
        if (current.trim()) pieces.push(current.trim());
        current = "";
    };
    for (const s of sentences) {
        if (current.length + s.length <= MAX_CHUNK) {
            current += s;
            continue;
        }
        flush();
        // A single long sentence: break it at the last space before the limit.
        let rest = s;
        while (rest.length > MAX_CHUNK) {
            const at = rest.lastIndexOf(" ", MAX_CHUNK);
            const cutAt = at > 0 ? at : MAX_CHUNK;
            pieces.push(rest.slice(0, cutAt).trim());
            rest = rest.slice(cutAt);
        }
        current = rest;
    }
    flush();
    return pieces;
}
