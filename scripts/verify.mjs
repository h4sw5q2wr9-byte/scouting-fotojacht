import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync("challenges.js", "utf8"), ctx);
const data = ctx.window.FOTOJACHT_LOCAL_REFERENCES;
assert(
  data.length >= 16 && data.length <= 30,
  "Keep a small, complete local-photo deck",
);
assert.equal(new Set(data.map((i) => i.id)).size, data.length);
assert.equal(new Set(data.map((i) => i.title)).size, data.length);
const manifest = JSON.parse(
  fs.readFileSync("assets/references/sources.json", "utf8"),
);
assert.equal(manifest.version, 2);
assert.deepEqual(JSON.parse(JSON.stringify(data)), manifest.items);
for (const item of data) {
  for (const key of [
    "id",
    "title",
    "category",
    "difficulty",
    "description",
    "image",
    "author",
    "license",
    "licenseUrl",
    "source_page",
    "sourceFile",
  ])
    assert(item[key], `${item.id}: ${key} missing`);
  assert.equal(item.status, "ready");
  assert.equal(item.imageType, "photograph");
  assert(
    Number.isInteger(item.players) && item.players >= 1 && item.players <= 4,
  );
  assert(
    Number.isInteger(item.maxPlayers) &&
      item.maxPlayers >= item.players &&
      item.maxPlayers <= 4,
  );
  assert(/^assets\/references\/[a-z0-9-]+\.jpg$/.test(item.image), item.image);
  assert(fs.existsSync(item.image), item.image);
  const file = fs.readFileSync(item.image);
  assert.equal(file.readUInt16BE(0), 0xffd8);
  assert(file.length > 10000, `${item.id}: reference too small`);
  assert(
    item.license === "Public domain" ||
      item.license === "CC0" ||
      /^CC BY(?:-SA)? /.test(item.license),
  );
  assert(item.licenseUrl.startsWith("https://creativecommons.org/"));
}
for (const file of ["app.js", "sw.js", "challenges.js", "vendor/fflate.js"])
  new vm.Script(fs.readFileSync(file, "utf8"));
const html = fs.readFileSync("index.html", "utf8"),
  app = fs.readFileSync("app.js", "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
assert.equal(ids.length, new Set(ids).size);
for (const match of app.matchAll(/\$\(['"]([^'"]+)['"]\)/g))
  assert(ids.includes(match[1]), `Missing UI element ${match[1]}`);
assert(
  !/timerToggle|teamName|createTeam|searchOriginal|showAll|google\.com|tbm=isch/.test(
    html + app,
  ),
  "Old gameplay controls must not return",
);
for (const file of [
  "styles.css",
  "manifest.webmanifest",
  "credits.html",
  "archive/challenges-v1.json",
  "assets/icon.svg",
  "assets/og-image.png",
])
  assert(fs.existsSync(file), file);
const archive = JSON.parse(fs.readFileSync("archive/challenges-v1.json"));
assert(
  archive.length >= 170,
  "Keep old deck titles and credits for saved-photo exports",
);
for (let i = 1; i <= 125; i++)
  assert(
    archive.some((item) => item.id === `foto-${String(i).padStart(3, "0")}`),
  );
assert(
  data.filter((item) => item.players >= 2).length >=
    Math.ceil(data.length * 0.8),
  "At least 80% of the deck must be for 2–4 people",
);
const png = fs.readFileSync("assets/og-image.png");
assert.equal(png.readUInt32BE(16), 1200);
assert.equal(png.readUInt32BE(20), 630);
assert(html.includes('property="og:image"'));
assert(html.includes('name="twitter:card"'));
console.log(
  `PASS: ${data.length} real local-photo challenges, matching V2 manifest/credits, archived earlier titles, valid app/worker, no timers/teams/search detours, social preview intact.`,
);
