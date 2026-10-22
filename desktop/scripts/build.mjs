import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const desktopDir = path.join(root, "desktop");

const buildEnv = {
  ...process.env,
  AI2DOT_AUTH_MODE: "local",
  AI2DOT_DESKTOP: "1",
  DATABASE_URL: "",
  DATABASE_URL_UNPOOLED: "",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "",
  CLERK_SECRET_KEY: "",
  AI_GATEWAY_API_KEY: "",
  VERCEL_OIDC_TOKEN: "",
  BLOB_READ_WRITE_TOKEN: "",
  CRON_SECRET: "",
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};

function run(command, args, options = {}) {
  console.log(`\n[desktop:build] ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: buildEnv,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}`);
  }
}

console.log("[desktop:build] building Next.js production bundle");
run("npm", ["run", "build"]);

console.log("[desktop:build] preparing standalone runtime");
run(process.execPath, [path.join(desktopDir, "scripts", "prepare.mjs")]);

fs.mkdirSync(path.join(desktopDir, "release"), { recursive: true });

const builderBin = path.join(root, "node_modules", ".bin", "electron-builder");
run(builderBin, [
  "--mac",
  "--config",
  path.join(desktopDir, "electron-builder.yml"),
  "--publish",
  "never",
]);

console.log("\n[desktop:build] done");
console.log(`[desktop:build] artifacts: ${path.join(desktopDir, "release")}`);
