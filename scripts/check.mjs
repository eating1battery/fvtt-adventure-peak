import { readdir, readFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (file.endsWith(".json")) JSON.parse(await readFile(file, "utf8"));
    else if (file.endsWith(".mjs")) {
      const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      if (result.status !== 0) throw new Error(result.stderr);
    }
  }
}
await check(root);
const manifest = JSON.parse(await readFile(path.join(root, "module.json"), "utf8"));
for (const file of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(l => l.path)]) {
  await access(path.join(root, file));
}
console.log("JavaScript syntax, JSON, and manifest asset paths passed.");
