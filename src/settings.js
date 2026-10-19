import * as speech from "./speech.js";
import {clearRecent, loadSettings, saveSettings} from "./store.js";

// Text size is a percentage of the browser's default text size. There's
// deliberately no maximum: low vision users may need very large text.
export const DEFAULT_TEXT_SIZE = 100;
const MIN_TEXT_SIZE = 50;

const voiceSel = document.getElementById("voice");
const sizeInput = document.getElementById("text-size");
const pronunciationsInput = document.getElementById("pronunciations");
const errorBox = document.getElementById("settings-error");
const infoDialog = document.getElementById("voice-info-dialog");
const THEMES = ["light", "dark", "system"];
const themeButtons = THEMES.map((t) => document.getElementById(`theme-${t}`));

/**
 * Force a color scheme, or hand control back to the system preference.
 * index.html applies the saved choice before the first paint the same way.
 */
function applyTheme(theme) {
    if (!THEMES.includes(theme)) theme = "system";
    if (theme === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.id === `theme-${theme}`)));
    // Tint the browser chrome to match: when a scheme is forced, only its meta
    // stays active. With "system", each meta's own media query applies again.
    for (const m of document.querySelectorAll("meta[name=theme-color]")) {
        m.dataset.media ??= m.media;
        if (theme === "system") m.media = m.dataset.media;
        else m.media = m.dataset.media.includes(theme) ? "" : "not all";
    }
}

export function showError(msg) {
    errorBox.textContent = msg;
    errorBox.hidden = !msg;
}

/** The text size in the input, raised to the minimum if needed. */
function textSizeValue() {
    const n = Math.round(Number(sizeInput.value));
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_TEXT_SIZE;
    return Math.max(MIN_TEXT_SIZE, n);
}

// "en-US" -> "English (United States)", falling back to the code itself.
const languageNames = (() => {
    try {
        return new Intl.DisplayNames([navigator.language], {type: "language", languageDisplay: "standard"});
    } catch {
        return null;
    }
})();
function languageName(lang) {
    try {
        return languageNames?.of(lang.replace("_", "-")) ?? lang;
    } catch {
        return lang;
    }
}

const baseLanguage = (lang) => lang.toLowerCase().split(/[-_]/)[0];

/**
 * Fill the voice list, grouped by language with the user's own languages
 * first. The saved choice stays selected; if its voice isn't offered (yet),
 * the list shows the system default without forgetting the choice.
 */
function fillVoices() {
    const saved = loadSettings().voiceURI;
    const voices = speech.voices();
    voiceSel.replaceChildren(new Option("System default", ""));

    const groups = new Map();
    for (const v of voices) {
        const name = languageName(v.lang);
        if (!groups.has(name)) groups.set(name, {lang: v.lang, voices: []});
        groups.get(name).voices.push(v);
    }
    // The user's exact locale first (en-US), then its relatives (en-GB), then other languages they use.
    const userLang = navigator.language.toLowerCase().replace("_", "-");
    const preferred = (navigator.languages ?? [navigator.language]).map(baseLanguage);
    const rank = (lang) => {
        if (lang.toLowerCase().replace("_", "-") === userLang) return -1;
        const i = preferred.indexOf(baseLanguage(lang));
        return i < 0 ? preferred.length : i;
    };
    const sorted = [...groups.entries()].sort(([aName, a], [bName, b]) =>
        rank(a.lang) - rank(b.lang) || aName.localeCompare(bName));

    for (const [name, group] of sorted) {
        const optgroup = document.createElement("optgroup");
        optgroup.label = name;
        group.voices.sort((a, b) => a.name.localeCompare(b.name));
        for (const v of group.voices) {
            const label = v.localService === false ? `${v.name} (needs internet)` : v.name;
            optgroup.append(new Option(label, v.voiceURI));
        }
        voiceSel.append(optgroup);
    }
    voiceSel.value = voices.some((v) => v.voiceURI === saved) ? saved : "";
}

/** Show the saved settings. */
export function refreshSettings() {
    showError("");
    const s = loadSettings();
    sizeInput.value = String(s.textSize || DEFAULT_TEXT_SIZE);
    applyTheme(s.theme);
    if (document.activeElement !== pronunciationsInput) {
        pronunciationsInput.value = s.pronunciations;
    }
    fillVoices();
}

/**
 * Wire up the settings controls. onTextSize runs as the text size is edited,
 * so the UI can resize live.
 */
export function initSettings({onTextSize, onPreview}) {
    speech.onVoicesChanged(fillVoices);

    voiceSel.addEventListener("change", () => saveSettings({voiceURI: voiceSel.value}));

    document.getElementById("voice-info").addEventListener("click", () => infoDialog.showModal());
    // A tap on the backdrop closes the dialog too.
    infoDialog.addEventListener("click", (e) => {
        if (e.target === infoDialog) infoDialog.close();
    });

    applyTheme(loadSettings().theme);
    themeButtons.forEach((b, i) => b.addEventListener("click", () => {
        saveSettings({theme: THEMES[i]});
        applyTheme(THEMES[i]);
    }));

    let sizeSaveTimer;
    sizeInput.addEventListener("input", () => {
        // Mid-edit, e.g. "1" on the way to "150": don't shrink everything to the minimum.
        if (sizeInput.value === "" || Number(sizeInput.value) < MIN_TEXT_SIZE) return;
        onTextSize(textSizeValue());
        clearTimeout(sizeSaveTimer);
        sizeSaveTimer = setTimeout(() => saveSettings({textSize: textSizeValue()}), 400);
    });
    sizeInput.addEventListener("change", () => {
        clearTimeout(sizeSaveTimer);
        sizeInput.value = String(textSizeValue()); // snap entries below the minimum
        onTextSize(textSizeValue());
        saveSettings({textSize: textSizeValue()});
    });

    let pronunciationsSaveTimer;
    const savePronunciations = () => saveSettings({pronunciations: pronunciationsInput.value});
    pronunciationsInput.addEventListener("input", () => {
        clearTimeout(pronunciationsSaveTimer);
        pronunciationsSaveTimer = setTimeout(savePronunciations, 400);
    });
    // Saves straight away when the field loses focus, e.g. on leaving settings.
    pronunciationsInput.addEventListener("change", () => {
        clearTimeout(pronunciationsSaveTimer);
        savePronunciations();
    });

    document.getElementById("preview").addEventListener("click", onPreview);

    // Forget every recent phrase. The main view rebuilds its list on return.
    const deleteBtn = document.getElementById("delete-saved");
    const deleteLabel = deleteBtn.querySelector("span");
    deleteBtn.addEventListener("click", () => {
        if (!confirm("Delete all of your recent phrases? This can't be undone.")) return;
        clearRecent();
        deleteLabel.textContent = "Saved Text Deleted";
        setTimeout(() => { deleteLabel.textContent = "Delete Saved Text"; }, 2500);
    });
}
