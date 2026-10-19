import {test} from "node:test";
import assert from "node:assert/strict";
import {apply, parse} from "../src/pronounce.js";

const cases = [
    ["basic", "dachary -> dakahri", "Hi, I'm dachary.", "Hi, I'm dakahri."],
    ["case-insensitive", "dachary -> dakahri", "DACHARY and Dachary", "dakahri and dakahri"],
    ["arrow separator", "dachary → dakahri", "dachary", "dakahri"],
    ["whitespace trimmed", "  dachary   ->   dakahri  ", "dachary!", "dakahri!"],
    ["multi-word replacement", "nginx -> engine x", "nginx is up", "engine x is up"],
    ["multi-word phrase", "New York -> noo york", "Off to new\nyork", "Off to noo york"],
    ["whole words only", "cat -> kat", "cat category bobcat", "kat category bobcat"],
    ["possessive", "dachary -> dakahri", "dachary's cat", "dakahri's cat"],
    ["punctuation word", "C++ -> see plus plus", "I like C++.", "I like see plus plus."],
    ["longest wins", "new -> nu\nnew york -> noo york", "new york is new", "noo york is nu"],
    ["no chaining", "a -> b\nb -> c", "a b", "b c"],
    ["last duplicate wins", "x -> one\nX -> two", "x", "two"],
    ["first separator splits", "a -> b -> c", "a", "b -> c"],
    ["ignored lines", "no separator\n -> nothing\n\n", "no separator", "no separator"],
    ["empty replacement", "um ->", "um hello", " hello"],
    ["no rules", "", "unchanged", "unchanged"],
    ["unicode", "café -> kaffay", "Café time", "kaffay time"],
];

for (const [name, rules, input, want] of cases) {
    test(name, () => assert.equal(apply(input, parse(rules)), want));
}
