import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function createDb() {
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

  return drizzle(client, { schema });
}

let database: ReturnType<typeof createDb> | null = null;

export function getDb() {
  database ??= createDb();
  return database;
}

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}
