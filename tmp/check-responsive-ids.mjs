import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const collectIds = (source) => new Set([...source.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const before = collectIds(execFileSync("git", ["show", "70bf5d5^:index.html"], { encoding: "utf8" }));
const after = collectIds(readFileSync("index.html", "utf8"));
const missing = [...before].filter((id) => !after.has(id));
const added = [...after].filter((id) => !before.has(id));

console.log(JSON.stringify({ before: before.size, after: after.size, missing, added }, null, 2));
if (missing.length) process.exitCode = 1;
