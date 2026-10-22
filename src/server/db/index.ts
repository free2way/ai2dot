import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type AppDatabase = ReturnType<typeof createPostgresDb>;

export function getDesktopDataDir() {
  const configured = process.env.AI2DOT_DESKTOP_DATA_DIR?.trim();
  return configured ? path.resolve(configured) : null;
}

export function isDesktopDatabaseEnabled() {
  return process.env.AI2DOT_DESKTOP === "1" && Boolean(getDesktopDataDir());
}

function createPostgresDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const configuredPoolSize = Number(process.env.DATABASE_POOL_MAX);
  const max = Number.isInteger(configuredPoolSize)
    ? Math.min(Math.max(configuredPoolSize, 1), 50)
    : 10;
  const client = postgres(connectionString, {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return drizzlePostgres(client, { schema });
}

function createDesktopDb() {
  const dataDir = getDesktopDataDir();

  if (!dataDir) {
    throw new Error("AI2DOT_DESKTOP_DATA_DIR is not configured.");
  }

  const client = new PGlite(path.join(dataDir, "pgdata"), {
    extensions: { vector, pg_trgm },
  });
  desktopClient = client;

  // PGlite exposes the same Drizzle query builder surface used by the app.
  // The concrete driver type differs, so keep the public type stable.
  return drizzlePglite(client, { schema }) as unknown as AppDatabase;
}

const globalForDatabase = globalThis as typeof globalThis & {
  ai2dotDatabase?: AppDatabase;
  ai2dotCloseDatabase?: () => Promise<void>;
};

let database: AppDatabase | null = null;
let desktopClient: PGlite | null = null;

function createDb() {
  return isDesktopDatabaseEnabled() ? createDesktopDb() : createPostgresDb();
}

export function getDb(): AppDatabase {
  database ??= globalForDatabase.ai2dotDatabase ??= createDb();
  return database;
}

export async function closeDatabase() {
  if (!desktopClient) return;
  const client = desktopClient;
  desktopClient = null;
  database = null;
  delete globalForDatabase.ai2dotDatabase;
  await client.close();
}

globalForDatabase.ai2dotCloseDatabase = closeDatabase;

export function isDatabaseConfigured() {
  return isDesktopDatabaseEnabled() || Boolean(process.env.DATABASE_URL);
}
