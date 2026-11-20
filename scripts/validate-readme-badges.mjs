import { readFileSync, existsSync } from "node:fs";
import { strict as assert } from "node:assert";
import { URL } from "node:url";

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const pkg = JSON.parse(read("package.json"));
const readme = read("README.md");
const workflow = read(".github/workflows/releases.yml");
const agents = read("AGENTS.md");
for (const name of ["SPRINTS.md", "BACKLOG.md", "CONTRIBUTING.md", "RELEASES.md", "SECURITY.md"]) {
  const content = read(name);
  assert(content.startsWith("# "), `${name} must have a Markdown title`);
  assert(content.length > 250, `${name} must contain project-specific guidance`);
}

const path = "https://github.com/drakeg/creator-desk";
const badges = readme.match(/<!-- badges:start -->([\s\S]*?)<!-- badges:end -->/);
assert(badges, "README badge markers must exist");
const section = badges[1];
assert(readme.indexOf("<!-- badges:start -->") > readme.indexOf("\n"), "Badges must follow H1");
assert(readme.slice(readme.indexOf("\n")+1,readme.indexOf("<!-- badges:start -->")).trim() === "", "Badges must be immediately beneath title");
assert(section.split(/\n\s*\n/).filter(Boolean).length <= 3, "Use at most three compact badge rows");
const sourceUrl = encodeURIComponent("https://raw.githubusercontent.com/drakeg/creator-desk/main/package.json");
const expected = [
  ["TypeScript", "$.devDependencies.typescript", pkg.devDependencies.typescript],
  ["React", "$.dependencies.react", pkg.dependencies.react],
  ["Electron", "$.devDependencies.electron", pkg.devDependencies.electron],
  ["Vite", "$.devDependencies.vite", pkg.devDependencies.vite],
];
for (const [label, query, version] of expected) {
  assert(typeof version === "string" && /^\d+\.\d+\.\d+/.test(version),
    `Cannot verify ${label} version from package.json`);
  const expectedSource = `![${label}](https://img.shields.io/badge/dynamic/json?url=${sourceUrl}&query=${encodeURIComponent(query)}&label=${label}`;
  assert(section.includes(expectedSource), `Missing or stale ${label} dynamic manifest badge`);
}
const node = workflow.match(/node-version:\s*["']?([\d.]+)/)?.[1];
assert(node, "Cannot find CI Node.js version");
assert(section.includes(`![Node.js ${node}]`), "Node.js runtime badge is stale");
assert(read("src/main/storage/store.ts").includes('from "node:sqlite"'), "SQLite badge needs source evidence");
assert(section.includes("![SQLite]"), "SQLite badge missing");
assert(section.includes(`${path}/actions/workflows/releases.yml/badge.svg?branch=main`), "Dynamic CI badge missing");
assert(section.includes("img.shields.io/github/v/release/drakeg/creator-desk"), "Dynamic published release badge missing");
for (const suffix of ["issues", "issues-pr"]) {
  assert(section.includes(`img.shields.io/github/${suffix}/drakeg/creator-desk`), `Dynamic ${suffix} badge missing`);
}
assert(agents.includes("README badge policy"), "AGENTS.md must define badge maintenance");
for (const match of section.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) {
  assert(match[1].startsWith("https://"), "Badge links must use HTTPS");
}
for (const match of section.matchAll(/!\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)) {
  assert(match[1].startsWith("https://"), "Badge image URLs must use HTTPS");
}
const hasLicense = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].some(existsSync);
if (!hasLicense) assert(!/shields\.io\/github\/license|!\[License/i.test(section), "No license file; license badge is unsupported");
for (const platform of ["Docker", "Vercel", "AWS"]) {
  assert(!section.includes(`![${platform}`), `Unsupported platform badge: ${platform}`);
}
console.log("README badge validation passed: verified stack, live status, destinations, and contributor policy.");
