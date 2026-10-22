import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export async function migrateDesktopDatabase({ dataDir, migrationsFolder }) {
  const pgDataDir = path.join(dataDir, "pgdata");
  const journal = path.join(migrationsFolder, "meta", "_journal.json");

  if (!fs.existsSync(journal)) {
    throw new Error(`Database migrations not found: ${migrationsFolder}`);
  }

  fs.mkdirSync(pgDataDir, { recursive: true, mode: 0o700 });

  const client = new PGlite(pgDataDir, {
    extensions: { vector, pg_trgm },
  });

  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.close();
  }

  return pgDataDir;
}
