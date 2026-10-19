// Rewrites text with the user's custom pronunciations before it's spoken.

// Separators between a word and how to say it, e.g. "dachary -> dakahri".
const SEPARATORS = ["->", "→"];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Read one rule per line in the form "word -> replacement" (or with "→").
 * Whitespace around both sides is ignored, as are lines without a separator
 * or without a word. When a word appears more than once, the last line wins.
 * @returns {{word: string, say: string, re: RegExp}[]}
 */
export function parse(text) {
    let rules = [];
    for (const line of (text ?? "").split("\n")) {
        const parts = cut(line);
        if (!parts) continue;
        const fields = parts.word.trim().split(/\s+/).filter(Boolean);
        if (fields.length === 0) continue;
        // Spaces inside a phrase match any run of whitespace, so "New York"
        // still matches across a line break.
        const re = new RegExp(fields.map(escapeRegExp).join("\\s+"), "giu");
        const word = fields.join(" ");
        rules = rules.filter((r) => r.word.toLowerCase() !== word.toLowerCase());
        rules.push({word, say: parts.say.trim(), re});
    }
    return rules;
}

// Split a line at its first separator.
function cut(line) {
    let at = -1, sepLen = 0;
    for (const sep of SEPARATORS) {
        const i = line.indexOf(sep);
        if (i >= 0 && (at < 0 || i < at)) {
            at = i;
            sepLen = sep.length;
        }
    }
    if (at < 0) return null;
    return {word: line.slice(0, at), say: line.slice(at + sepLen)};
}

/**
 * Replace each rule's word in text with its replacement. Words only match
 * whole: "cat -> kat" changes "Cat" but not "category". Longer words take
 * precedence over shorter ones they overlap, and replacements are never
 * themselves rewritten by other rules.
 */
export function apply(text, rules) {
    if (rules.length === 0) return text;
    const ordered = [...rules].sort((a, b) => b.word.length - a.word.length); // stable

    const spans = [];
    const overlaps = (start, end) => spans.some((s) => start < s.end && s.start < end);
    for (const r of ordered) {
        for (const m of text.matchAll(r.re)) {
            const start = m.index, end = m.index + m[0].length;
            if (wholeWord(text, start, end) && !overlaps(start, end)) {
                spans.push({start, end, say: r.say});
            }
        }
    }
    if (spans.length === 0) return text;
    spans.sort((a, b) => a.start - b.start);

    let out = "";
    let last = 0;
    for (const s of spans) {
        out += text.slice(last, s.start) + s.say;
        last = s.end;
    }
    return out + text.slice(last);
}

// Whether text[start:end] isn't part of a longer word. A match that begins or
// ends with punctuation (e.g. "C++") only needs a boundary on its word-character sides.
function wholeWord(text, start, end) {
    const match = [...text.slice(start, end)];
    if (isWordChar(match[0]) && isWordChar([...text.slice(0, start)].at(-1))) return false;
    if (isWordChar(match.at(-1)) && isWordChar([...text.slice(end)][0])) return false;
    return true;
}

function isWordChar(ch) {
    return ch !== undefined && /[\p{L}\p{N}_]/u.test(ch);
}
