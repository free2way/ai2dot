import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { getQueryRows } from "./rows";

describe("driver-independent query rows", () => {
  it("preserves Postgres.js array rows", () => {
    expect(getQueryRows([{ total: 12 }])).toEqual([{ total: 12 }]);
  });
  it("reads real PGlite execute results without losing rows", async () => {
    const client = new PGlite();
    try {
      const result = await drizzle(client).execute(sql`select 12 as total`);
      expect(getQueryRows(result)).toEqual([{ total: 12 }]);
    } finally { await client.close(); }
  });
  it("accepts empty results from both drivers", () => {
    expect(getQueryRows([])).toEqual([]);
    expect(getQueryRows({ rows: [] })).toEqual([]);
  });
  it("rejects unknown result shapes instead of reporting zero usage", () => {
    expect(() => getQueryRows({ affectedRows: 1 })).toThrow("Unsupported");
  });
});
