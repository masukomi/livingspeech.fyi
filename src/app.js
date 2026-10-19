import * as pronounce from "./pronounce.js";
import * as speech from "./speech.js";
import {DEFAULT_TEXT_SIZE, initSettings, refreshSettings, showError} from "./settings.js";
import {addRecent, listRecent, loadSettings} from "./store.js";
import {checkNow, initUpdates} from "./update.js";
import {VERSION} from "./version.js";

const PREVIEW_TEXT = "Hello! This is how I sound.";

const mainView = document.getElementById("main-view");
const settingsView = document.getElementById("settings-view");
const input = document.getElementById("input");
const recentList = document.getElementById("recent");
const quickButtons = document.getElementById("quick-buttons");
const banner = document.getElementById("banner");
const updateBanner = document.getElementById("update-banner");
const speakToggle = document.getElementById("speak-toggle");

let speaking = false;

// While anything is being spoken, the play button by the text box becomes a stop button.
function setSpeaking(on) {
    speaking = on;
    updateSpeakToggle();
}

function updateSpeakToggle() {
    speakToggle.classList.toggle("speaking", speaking);
    const label = speaking ? "Stop speaking" : "Speak";
    speakToggle.title = label;
    speakToggle.setAttribute("aria-label", label);
    speakToggle.disabled = !speaking && !input.value.trim();
}

// --- sizing ---

// Grow the text box with its content up to half the visible height, then scroll.
function autosize() {
    const maxH = Math.floor((window.visualViewport?.height ?? window.innerHeight) * 0.5);
    input.style.height = "auto";
    const needed = input.scrollHeight + 2; // + borders
    input.style.height = `${Math.min(needed, maxH)}px`;
    input.style.overflowY = needed > maxH ? "auto" : "hidden";
}

// Everything in the stylesheet is sized in rem, so the root font size scales
// the whole UI. A percentage keeps the browser's (and the OS's) text size as the base.
function applyTextSize(percent) {
    document.documentElement.style.fontSize = percent === DEFAULT_TEXT_SIZE ? "" : `${percent}%`;
    autosize();
}

// --- banner ---

const UNSUPPORTED = "This browser can't speak text. Try Safari on iPhone or iPad, or Chrome on Android.";

function showBanner(msg) {
    banner.textContent = msg;
    banner.hidden = !msg;
}

// --- quick buttons ---

// One button per non-blank label. They're a fixed part of the screen, so
// speaking one doesn't add it to the recent list.
function refreshQuickButtons() {
    const labels = loadSettings().quickButtons.map((t) => t.trim()).filter(Boolean);
    quickButtons.replaceChildren(...labels.map((label) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "quick-button";
        b.textContent = label;
        b.addEventListener("click", () => speak(label, {remember: false}));
        return b;
    }));
    quickButtons.hidden = labels.length === 0;
}

// --- recent ---

function refreshRecent() {
    const entries = listRecent();
    recentList.replaceChildren();
    if (entries.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "Phrases you speak today show up here.";
        recentList.append(li);
    }
    for (const e of entries) {
        const li = document.createElement("li");
        li.title = e.text;

        // Speak the phrase directly, leaving whatever is in the text box alone.
        const play = document.createElement("button");
        play.className = "icon-btn play";
        play.title = "Speak";
        play.setAttribute("aria-label", `Speak: ${e.text}`);
        // A circled play symbol; a bare triangle reads as an "expand" disclosure arrow.
        play.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M10 8.2v7.6l6-3.8z"/></svg>';
        play.addEventListener("click", (ev) => {
            ev.stopPropagation(); // don't also copy it into the text box
            speak(e.text);
        });

        const text = document.createElement("span");
        text.className = "text";
        text.textContent = e.text;

        li.append(play, text);
        // Tapping the rest of the row puts the phrase in the text box for editing.
        li.addEventListener("click", () => {
            input.value = e.text;
            autosize();
            updateSpeakToggle();
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
            input.scrollTop = input.scrollHeight;
        });
        recentList.append(li);
    }
}

// --- speech ---

/** Speak text with the chosen voice. remember=false skips the recent list (previews). */
function speak(text, {remember = true} = {}) {
    showBanner("");
    showError("");
    if (!speech.supported) {
        showBanner(UNSUPPORTED);
        return;
    }
    if (remember) {
        addRecent(text);
        refreshRecent();
    }
    const {voiceURI, pronunciations} = loadSettings();
    const spoken = pronounce.apply(text, pronounce.parse(pronunciations));

    // End anything still speaking first (its onEnd resets this state); some
    // browsers report errors synchronously from inside speak().
    speech.stop();
    setSpeaking(true);
    speech.speak(spoken, {
        voiceURI,
        onEnd: (error) => {
            setSpeaking(false);
            if (error) {
                const msg = `Couldn't speak. ${error}`;
                if (settingsView.hidden) showBanner(msg);
                else showError(msg);
            }
        },
    });
}


// Speak the text box's contents and clear it.
function speakInput() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    autosize();
    speak(text);
}

input.addEventListener("input", () => {
    autosize();
    updateSpeakToggle();
});
input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    speakInput();
});

// Keep focus in the text box, so tapping the button doesn't close the phone's keyboard.
speakToggle.addEventListener("pointerdown", (e) => e.preventDefault());
speakToggle.addEventListener("click", () => {
    if (speaking) speech.stop();
    else speakInput();
});

// --- views ---

function showSettings(show) {
    mainView.hidden = show;
    settingsView.hidden = !show;
    window.scrollTo(0, 0);
    if (show) {
        refreshSettings();
    } else {
        refreshRecent(); // phrases may have been deleted in settings
        refreshQuickButtons(); // labels may have changed in settings
        autosize();
    }
}

document.getElementById("open-settings").addEventListener("click", () => showSettings(true));
document.getElementById("close-settings").addEventListener("click", () => showSettings(false));
initSettings({
    onTextSize: applyTextSize,
    onPreview: () => speak(PREVIEW_TEXT, {remember: false}),
});

// Phrases expire, so refresh the list whenever the app comes back to the foreground.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshRecent();
});
window.visualViewport?.addEventListener("resize", autosize);

// --- add to home screen ---

const installBtn = document.getElementById("install-info");
const installDialog = document.getElementById("install-dialog");
// Already running from the home screen: the instructions have done their job.
const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
installBtn.hidden = installed;
installBtn.addEventListener("click", () => installDialog.showModal());
// A tap on the backdrop closes the dialog too.
installDialog.addEventListener("click", (e) => {
    if (e.target === installDialog) installDialog.close();
});

// --- updates ---

const checkBtn = document.getElementById("check-updates");
checkBtn.addEventListener("click", async () => {
    checkBtn.disabled = true;
    checkBtn.textContent = "Checking…";
    checkBtn.textContent = await checkNow();
    setTimeout(() => {
        checkBtn.textContent = "Check for updates";
        checkBtn.disabled = false;
    }, 3000);
});

updateBanner.addEventListener("click", () => location.reload());

// A new version has taken over. Reload right away unless that would lose
// something: text being typed, speech in progress, or an open settings view.
function onUpdated() {
    const busy = input.value.trim() || speaking || !settingsView.hidden;
    if (busy) updateBanner.hidden = false;
    else location.reload();
}

// --- startup ---

document.getElementById("version").textContent = `Version ${VERSION}`;
applyTextSize(loadSettings().textSize || DEFAULT_TEXT_SIZE);
refreshQuickButtons();
refreshRecent();
if (!speech.supported) showBanner(UNSUPPORTED);
// Don't pop up the keyboard on phones; it would cover the recent list.
if (!matchMedia("(pointer: coarse)").matches) input.focus();
void initUpdates(onUpdated);
