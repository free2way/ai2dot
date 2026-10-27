import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import type { getDb } from "@/server/db";
import * as schema from "@/server/db/schema";
import { getWorkspaceContext } from "@/server/db/workspace";
import { getPlatformConsoleData } from "./store";

const mocks = vi.hoisted(() => ({ db: null as ReturnType<typeof getDb> | null }));
vi.mock("@/server/db", () => ({ getDb: () => mocks.db!, isDatabaseConfigured: () => true }));
vi.mock("@/server/auth/session", () => ({
  getRequestIdentity: async () => ({ externalAuthId: "fixture-desktop-user", displayName: "Fixture" }),
}));
vi.mock("@/server/auth/clerk-profile", () => ({
  listClerkUserProfiles: vi.fn(() => { throw new Error("External profile requests must not occur in this test."); }),
}));

const client = new PGlite({ extensions: { vector, pg_trgm } });
const db = drizzle(client, { schema });
let userId: string;

beforeAll(async () => {
  mocks.db = db as unknown as ReturnType<typeof getDb>;
  await migrate(db, { migrationsFolder: "./drizzle" });
  const [user] = await db.insert(schema.users).values({
    externalAuthId: "fixture-desktop-user", displayName: "Fixture", email: "fixture@example.com",
  }).returning();
  userId = user.id;
  const [workspace] = await db.insert(schema.workspaces).values({ name: "Fixture workspace", ownerId: user.id }).returning();
  await db.insert(schema.workspaceMembers).values({ userId: user.id, workspaceId: workspace.id, role: "owner" });
  await db.insert(schema.usageEvents).values({
    workspaceId: workspace.id, userId: user.id, requestId: "fixture-request",
    inputTokens: 12, outputTokens: 8, costUsd: "0.01", status: "completed",
  });
}, 30_000);
afterAll(async () => { await client.close(); });

describe("platform console with the Desktop database driver", () => {
  it("retains real overview, daily, user and workspace rows after all migrations", async () => {
    const data = await getPlatformConsoleData();
    expect(data.overview).toMatchObject({ users: 1, workspaces: 1, inputTokens: 12, outputTokens: 8 });
    expect(data.users).toEqual([expect.objectContaining({ id: userId, tokenCount30d: 20 })]);
    expect(data.workspaces).toEqual([expect.objectContaining({ name: "Fixture workspace", tokenCount30d: 20 })]);
    expect(data.dailyUsage).toHaveLength(14);
    expect(data.dailyUsage.reduce((total, day) => total + day.tokens, 0)).toBe(20);
  });
  it("denies a suspended identity's workspace even when its login session is valid", async () => {
    expect(await getWorkspaceContext()).toMatchObject({ userId });
    await db.update(schema.users).set({ status: "suspended" }).where(eq(schema.users.id, userId));
    expect(await getWorkspaceContext()).toBeNull();
  });
});
