import {beforeEach, test} from "node:test";
import assert from "node:assert/strict";
import {addRecent, clearRecent, listRecent, loadSettings, RECENT_WINDOW_MS, saveSettings} from "../src/store.js";

const DEFAULTS = {voiceURI: "", textSize: 0, pronunciations: "", theme: "system", quickButtons: ["No", "Maybe", "Yes"]};

beforeEach(() => {
    const data = new Map();
    globalThis.localStorage = {
        getItem: (k) => (data.has(k) ? data.get(k) : null),
        setItem: (k, v) => data.set(k, String(v)),
        removeItem: (k) => data.delete(k),
    };
});

test("recent: newest first, duplicates move to the top", () => {
    addRecent("one", 1000);
    addRecent("two", 2000);
    addRecent(" one ", 3000);
    assert.deepEqual(listRecent(3000).map((e) => e.text), ["one", "two"]);
});

test("recent: clearRecent removes everything", () => {
    addRecent("one", 1000);
    addRecent("two", 2000);
    clearRecent();
    assert.deepEqual(listRecent(2000), []);
    assert.equal(globalThis.localStorage.getItem("livingspeech.recent"), null);
});

test("recent: ignores blank text", () => {
    addRecent("   ", 1000);
    assert.deepEqual(listRecent(1000), []);
});

test("recent: expires after 24 hours", () => {
    addRecent("old", 0);
    addRecent("new", RECENT_WINDOW_MS);
    assert.deepEqual(listRecent(RECENT_WINDOW_MS + 1).map((e) => e.text), ["new"]);
});

test("recent: capped at 50", () => {
    for (let i = 0; i < 60; i++) addRecent(`p${i}`, 1000 + i);
    const list = listRecent(2000);
    assert.equal(list.length, 50);
    assert.equal(list[0].text, "p59");
});

test("settings: defaults, then merged saves", () => {
    assert.deepEqual(loadSettings(), DEFAULTS);
    saveSettings({textSize: 150});
    saveSettings({voiceURI: "x"});
    saveSettings({quickButtons: ["Hi", "", "Bye"]});
    assert.deepEqual(loadSettings(), {...DEFAULTS, voiceURI: "x", textSize: 150, quickButtons: ["Hi", "", "Bye"]});
});

test("survives broken storage", () => {
    globalThis.localStorage = {getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }};
    addRecent("hi");
    assert.deepEqual(listRecent(), []);
    assert.deepEqual(loadSettings(), DEFAULTS);
});
