import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import runtimeFiles from "../lib/runtime-files.cjs";

const { runtimeCopyFilter, assertNoEnvironmentFiles } = runtimeFiles;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const desktopDir = path.join(root, "desktop");
const runtimeDir = path.join(desktopDir, ".runtime");
const standaloneDir = path.join(root, ".next", "standalone");

function copy(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: runtimeCopyFilter,
  });
}

function requirePath(target, label) {
  if (!fs.existsSync(target)) {
    throw new Error(`Missing ${label}: ${target}`);
  }
}

console.log("[desktop:prepare] verifying Next standalone output");
requirePath(path.join(standaloneDir, "server.js"), "standalone server.js");
requirePath(path.join(root, ".next", "static"), ".next/static");
requirePath(path.join(root, "public"), "public");
requirePath(path.join(root, "drizzle", "meta", "_journal.json"), "drizzle journal");

console.log("[desktop:prepare] building runtime directory");
fs.rmSync(runtimeDir, { recursive: true, force: true });
fs.mkdirSync(runtimeDir, { recursive: true });

copy(standaloneDir, runtimeDir);
copy(path.join(root, ".next", "static"), path.join(runtimeDir, ".next", "static"));
copy(path.join(root, "public"), path.join(runtimeDir, "public"));
copy(path.join(root, "drizzle"), path.join(runtimeDir, "drizzle"));
copy(
  path.join(desktopDir, "runtime", "desktop-start.mjs"),
  path.join(runtimeDir, "desktop-start.mjs"),
);
copy(
  path.join(desktopDir, "runtime", "migrate.mjs"),
  path.join(runtimeDir, "migrate.mjs"),
);

// The migration launcher runs before Next boots and needs these packages
// available as real files, even if Next chose to bundle them.
for (const pkg of [
  "@electric-sql/pglite",
  "@electric-sql/pglite-pgvector",
  "drizzle-orm",
]) {
  const source = path.join(root, "node_modules", pkg);
  const destination = path.join(runtimeDir, "node_modules", pkg);
  requirePath(source, pkg);
  copy(source, destination);
}

const requiredAssets = [
  path.join(runtimeDir, "server.js"),
  path.join(runtimeDir, "desktop-start.mjs"),
  path.join(runtimeDir, "node_modules", "@electric-sql", "pglite", "dist", "pglite.wasm"),
  path.join(runtimeDir, "node_modules", "@electric-sql", "pglite", "dist", "pglite.data"),
  path.join(runtimeDir, "node_modules", "@electric-sql", "pglite-pgvector", "dist"),
  path.join(runtimeDir, "node_modules", "drizzle-orm", "pglite"),
  path.join(runtimeDir, "drizzle", "meta", "_journal.json"),
];
for (const asset of requiredAssets) {
  requirePath(asset, "runtime asset");
}
assertNoEnvironmentFiles(runtimeDir);

const size = execFileSync("du", ["-sh", runtimeDir], { encoding: "utf8" }).trim();
console.log(`[desktop:prepare] runtime ready: ${size}`);
