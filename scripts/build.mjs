// Copies src/ to dist/ and stamps two things: the version from package.json
// (shown on the settings page) and a build hash of every file's contents.
// Deploying a build with a new hash is what tells installed copies of the app
// to update (see src/sw.js and src/update.js).

import {createHash} from "node:crypto";
import {chmodSync, cpSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {join, relative, sep} from "node:path";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");
const dist = join(root, "dist");

const skip = (name) => name.startsWith(".");

function files(dir) {
    return readdirSync(dir, {withFileTypes: true})
        .filter((e) => !skip(e.name))
        .flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
        .sort();
}

rmSync(dist, {recursive: true, force: true});
cpSync(src, dist, {recursive: true, filter: (p) => !skip(p.split(sep).at(-1))});

// Editors sometimes save files owner-only; rsync would carry that to the
// server, which then answers 403. Make every copied file world-readable.
for (const p of files(dist)) chmodSync(p, 0o644);

const paths = files(dist).map((p) => relative(dist, p).split(sep).join("/"));
const assets = paths.filter((p) => p !== "sw.js" && p !== "index.html");

const {version} = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

function stamp(file, replacements) {
    const path = join(dist, file);
    let text = readFileSync(path, "utf8");
    for (const [pattern, value] of replacements) {
        if (!pattern.test(text)) throw new Error(`${file}: couldn't find ${pattern}`);
        text = text.replace(pattern, value);
    }
    writeFileSync(path, text);
}

// Stamp the version before hashing so a version bump alone produces a new build.
stamp("version.js", [[/export const VERSION = .*;/, `export const VERSION = ${JSON.stringify(version)};`]]);

const hash = createHash("sha256");
for (const p of paths.filter((p) => p !== "sw.js")) {
    hash.update(p).update("\0").update(readFileSync(join(dist, p))).update("\0");
}
const build = hash.digest("hex").slice(0, 10);

stamp("sw.js", [
    [/const VERSION = .*;/, `const VERSION = ${JSON.stringify(build)};`],
    // index.html is cached as "./", the URL the app is opened at.
    [/const ASSETS = .*;/, `const ASSETS = ${JSON.stringify(["./", ...assets])};`],
]);

console.info(`Built dist/ — version ${version}, build ${build}, ${paths.length} files`);
