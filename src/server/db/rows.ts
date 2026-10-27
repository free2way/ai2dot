/** Postgres.js returns an array; PGlite returns an object containing rows. */
export function getQueryRows<Row>(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows as Row[];
  }
  throw new Error("Unsupported database query result.");
}
