import fs from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { COMPONENTS, affectsComponent, latestRelease, nextVersion, reservedVersion } from "./lib.mjs";

const repository = process.env.GITHUB_REPOSITORY;
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) throw new Error("Missing repository context.");
const selection = process.env.RELEASE_COMPONENT || "auto";
if (!["auto", "all", ...COMPONENTS].includes(selection)) throw new Error("Invalid component selection.");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const sha = git("rev-parse", "HEAD");
const releases = JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", `repos/${repository}/releases?per_page=100`], { encoding: "utf8" })).flat();
const outputs = {};
for (const component of COMPONENTS) {
  const latest = latestRelease(component, releases);
  const base = JSON.parse(fs.readFileSync(component === "desktop" ? "package.json" : "extension/package.json", "utf8")).version;
  let changed = true;
  if (latest) {
    const baseline = /^[a-f0-9]{40}$/.test(latest.target_commitish)
      ? latest.target_commitish : git("rev-parse", `${latest.tag_name}^{commit}`);
    const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", baseline, sha]);
    if (ancestor.status !== 0) throw new Error(`The ${component} release baseline is not an ancestor; merge the published branch before releasing.`);
    changed = git("diff", "--name-only", baseline, sha, "--").split("\n").some((file) => affectsComponent(component, file));
  }
  const requested = selection === "all" || selection === component;
  const enabled = selection === "auto" ? changed : requested;
  const version = nextVersion(base, reservedVersion(component, releases));
  outputs[component] = String(enabled);
  outputs[`${component}_version`] = version;
  outputs[`${component}_tag`] = `${component}-v${version}`;
}
console.log(JSON.stringify(outputs, null, 2));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,
  Object.entries(outputs).map(([name, value]) => `${name}=${value}\n`).join(""));
