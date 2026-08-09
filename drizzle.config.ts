import { defineConfig } from "drizzle-kit";

// `generate` only reads the schema, so keep it usable before Neon is provisioned.
// `migrate` still requires a real DATABASE_URL supplied by the operator.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://schema-only:disabled@localhost/ai2dot";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  strict: true,
  verbose: true,
});
