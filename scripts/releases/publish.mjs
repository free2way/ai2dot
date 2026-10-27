import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { assertComponent, findGithubRelease, parseVersion, verifyManifest } from "./lib.mjs";

const component = assertComponent(process.argv[2]);
const version = process.env.RELEASE_VERSION;
parseVersion(version);
const tag = `${component}-v${version}`;
const sha = process.env.GITHUB_SHA;
const repository = process.env.GITHUB_REPOSITORY;
if (!/^[a-f0-9]{40}$/.test(sha ?? "") || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) throw new Error("Missing release context.");
const output = path.resolve("build/releases", component);
const assets = verifyManifest(output, component, version, sha).map((name) => path.join(output, name));
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
const findRelease = () => findGithubRelease(repository, tag,
  (args) => spawnSync("gh", args, { encoding: "utf8" }), gh);
let release = findRelease();
if (release && release.target_commitish !== sha) throw new Error("Refusing to overwrite a release from another commit.");
if (release && !release.draft) {
  const names = release.assets.map((asset) => asset.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(assets.map((asset) => path.basename(asset)).sort())) throw new Error("Published release is missing expected assets.");
  console.log(`Release ${tag} is already published for this commit.`);
  process.exit(0);
}
if (!release) {
  const label = component === "desktop" ? "macOS Desktop" : "Chrome Extension";
  const notes = [`${label} ${version}`, `Source commit: ${sha}`, "SHA-256 checksums are included.",
    component === "desktop" ? "Apple Silicon (arm64). Unsigned and not notarized; macOS may show a security warning."
      : "Unzip and load the directory in Chrome Developer mode. Configure the public sign-in parameter locally; no credentials are bundled.",
  ].join("\n\n");
  gh("release", "create", tag, "--repo", repository, "--target", sha, "--draft", "--title", `${label} ${version}`, "--notes", notes);
}
gh("release", "upload", tag, ...assets, "--repo", repository, "--clobber");
release = findRelease();
if (!release) throw new Error("Unable to reload the draft release for verification.");
if (release.assets.length !== assets.length || assets.some((asset) => !release.assets.some((remote) => remote.name === path.basename(asset) && remote.size === fs.statSync(asset).size))) {
  throw new Error("Uploaded asset verification failed; release remains a draft.");
}
gh("release", "edit", tag, "--repo", repository, "--draft=false", component === "desktop" ? "--latest" : "--latest=false");
console.log(`Published ${tag}.`);
