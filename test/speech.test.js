import {test} from "node:test";
import assert from "node:assert/strict";
import {chunk} from "../src/speech.js";

test("short text stays whole", () => {
    assert.deepEqual(chunk("Hello there. How are you?"), ["Hello there. How are you?"]);
});

test("empty text has no pieces", () => {
    assert.deepEqual(chunk("  "), []);
});

test("long text splits at sentence breaks", () => {
    const s = "This sentence is about fifty characters long, ok. ";
    const pieces = chunk(s.repeat(6));
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((p) => p.length <= 200 && p.endsWith(".")));
    assert.equal(pieces.join(" "), s.repeat(6).trim());
});

test("a long sentence splits at spaces", () => {
    const words = Array.from({length: 100}, (_, i) => `word${i}`).join(" ");
    const pieces = chunk(words);
    assert.ok(pieces.every((p) => p.length <= 200));
    assert.equal(pieces.join(" "), words);
});

test("text without punctuation is kept", () => {
    assert.deepEqual(chunk("no punctuation here"), ["no punctuation here"]);
});
