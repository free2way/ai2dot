import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultAppSupportDir, getPaths, loadOrCreateConfig } from "../lib/config.mjs";
import { buildServerEnv, waitForServer } from "../lib/server.mjs";
import { migrateDesktopDatabase } from "../runtime/migrate.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../..");
const port = Number(process.env.AI2DOT_DESKTOP_DEV_PORT || 3210);
const cloudDev = process.env.AI2DOT_DEV_CLOUD === "1";

const paths = getPaths(defaultAppSupportDir());
const config = loadOrCreateConfig(paths.root);

const baseEnv = {
  ...process.env,
  ...buildServerEnv({ config, paths, port }),
  NODE_ENV: "development",
};
// Allow local console logging during development.
delete baseEnv.CLERK_SECRET_KEY;

console.log(`[desktop:dev] data directory: ${paths.root}`);
console.log("[desktop:dev] preparing local database…");
await migrateDesktopDatabase({
  dataDir: paths.dataDir,
  migrationsFolder: path.join(root, "drizzle"),
});
console.log("[desktop:dev] database ready");

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
const nextProcess = spawn(
  process.execPath,
  [nextBin, "dev", "--port", String(port), "--hostname", "127.0.0.1"],
  {
    cwd: root,
    env: baseEnv,
    stdio: "inherit",
    detached: true,
  },
);

let electronProcess = null;
let stopping = false;

function stopNext(signal = "SIGTERM") {
  if (!nextProcess.pid || nextProcess.exitCode !== null) return;
  try {
    process.kill(-nextProcess.pid, signal);
  } catch {
    nextProcess.kill(signal);
  }
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  electronProcess?.kill("SIGTERM");
  stopNext();
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("exit", () => stopNext("SIGKILL"));

nextProcess.on("exit", (code) => {
  if (!stopping) {
    console.error(`[desktop:dev] next dev exited with code ${code}`);
    shutdown(code ?? 1);
  }
});

console.log(`[desktop:dev] waiting for http://127.0.0.1:${port} …`);
await waitForServer(`http://127.0.0.1:${port}`, { timeoutMs: 120_000 });

const electronBin = path.join(root, "node_modules", ".bin", "electron");
electronProcess = spawn(electronBin, [path.join(root, "desktop", "main.mjs")], {
  cwd: root,
  env: {
    ...process.env,
    ...(cloudDev
      ? {
          AI2DOT_DESKTOP_MODE: "cloud",
          AI2DOT_DESKTOP_SERVER_URL: `http://127.0.0.1:${port}`,
        }
      : {
          AI2DOT_DESKTOP_DEV_URL: `http://127.0.0.1:${port}`,
          AI2DOT_DESKTOP_DATA_DIR: paths.dataDir,
        }),
  },
  stdio: "inherit",
});

electronProcess.on("exit", (code) => {
  shutdown(code ?? 0);
});
