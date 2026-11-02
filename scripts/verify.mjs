import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const context = { window: {} };
vm.runInNewContext(fs.readFileSync("challenges.js", "utf8"), context);
const data = context.window.CHALLENGES;
assert.equal(data.length, 145);
assert.equal(new Set(data.map((x) => x.id)).size, data.length);
assert.equal(new Set(data.map((x) => x.title.toLowerCase())).size, data.length);
for (let i = 1; i <= 125; i++)
  assert(
    data.some((x) => x.id === `foto-${String(i).padStart(3, "0")}`),
    "Original ID missing",
  );
const sources = JSON.parse(fs.readFileSync("assets/references/sources.json"));
for (const item of data) {
  for (const key of [
    "id",
    "title",
    "description",
    "category",
    "query",
    "people",
    "difficulty",
  ])
    assert(item[key], `${item.id}: ${key}`);
  if (item.image) {
    assert(!item.image.startsWith("http"));
    assert(fs.existsSync(item.image));
    assert(sources.some((x) => x.id === item.id && x.image === item.image));
    assert(item.author && item.source && item.license);
  } else assert.equal(item.referenceType, "search");
}
const html = fs.readFileSync("index.html", "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((x) => x[1]);
assert.equal(ids.length, new Set(ids).size, "Duplicate element IDs");
for (const path of [
  "app.js",
  "styles.css",
  "sw.js",
  "manifest.webmanifest",
  "assets/icon.svg",
])
  assert(fs.existsSync(path));
new vm.Script(fs.readFileSync("app.js", "utf8"));
new vm.Script(fs.readFileSync("sw.js", "utf8"));
console.log(
  `PASS: ${data.length} unique challenges; all 125 original IDs; ${sources.length} local references; valid scripts and assets.`,
);
