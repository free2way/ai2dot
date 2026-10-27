import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertComponent, assertSafeTree, writeManifest } from "./lib.mjs";

const component = assertComponent(process.argv[2]);
const version = JSON.parse(fs.readFileSync(component === "desktop" ? "package.json" : "extension/package.json", "utf8")).version;
const sha = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = path.resolve("build/releases", component);
if (fs.existsSync(output) && fs.readdirSync(output).length) throw new Error("Release output must be empty.");
fs.mkdirSync(output, { recursive: true });
let names;
if (component === "extension") {
  const source = path.resolve("extension/build/chrome-mv3-prod");
  assertSafeTree(source);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, "manifest.json"), "utf8"));
  if (manifest.version !== version || manifest.manifest_version !== 3) throw new Error("Extension manifest version mismatch.");
  names = [`ai2dot-chrome-${version}.zip`];
  execFileSync("zip", ["-q", "-r", "-X", path.join(output, names[0]), ".", "-x", "*.map"], { cwd: source, stdio: "inherit" });
} else {
  if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("Desktop release must be built natively on Apple Silicon.");
  assertSafeTree(path.resolve("desktop/.runtime"));
  names = [`ai2dot-${version}-arm64.dmg`, `ai2dot-${version}-arm64.zip`];
  for (const name of names) fs.copyFileSync(path.resolve("desktop/release", name), path.join(output, name));
}
writeManifest(output, component, version, sha, names);
console.log(`Verified ${component} assets and checksums.`);
