import { defineConfig } from "drizzle-kit";

// Schema generation can run without a real database. Migrations still require
// DATABASE_URL_UNPOOLED or DATABASE_URL supplied outside the repository.
const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  "postgresql://placeholder.invalid/placeholder";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
