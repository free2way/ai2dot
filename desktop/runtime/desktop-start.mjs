import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateDesktopDatabase } from "./migrate.mjs";

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.AI2DOT_DESKTOP_DATA_DIR;

if (!dataDir) {
  console.error("[desktop] AI2DOT_DESKTOP_DATA_DIR is not configured.");
  process.exit(1);
}

process.chdir(runtimeDir);

try {
  const pgDataDir = await migrateDesktopDatabase({
    dataDir,
    migrationsFolder: path.join(runtimeDir, "drizzle"),
  });
  console.log(`[desktop] database ready at ${pgDataDir}`);
} catch (error) {
  console.error(
    "[desktop] database migration failed:",
    error instanceof Error ? error.stack || error.message : error,
  );
  process.exit(1);
}

await import("./server.js");

async function shutdown(signal) {
  console.log(`[desktop] received ${signal}, closing database`);
  try {
    await globalThis.ai2dotCloseDatabase?.();
  } catch (error) {
    console.error("[desktop] failed to close database:", error);
  }
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
