import { openDatabase } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrations";
import { users, workspaces } from "@/server/db/schema";
import { seedDemoData } from "@/server/db/seed";
import type { ServiceContext } from "@/server/services/context";
import { newId } from "@/lib/ids";

/** Fixed "now": Tuesday 2026-11-10, 9:00 AM in Chicago. */
export const TEST_NOW = new Date("2026-11-10T15:00:00Z");

export function emptyContext(now: Date = TEST_NOW) {
  const connection = openDatabase(":memory:");
  runMigrations(connection);
  const workspaceId = newId("ws");
  const userId = newId("usr");
  connection.db
    .insert(workspaces)
    .values({ id: workspaceId, name: "Test Brokerage", slug: "test", timeZone: "America/Chicago", currency: "USD", nextLeadNumber: 1001, createdAt: now })
    .run();
  connection.db.insert(users).values({ id: userId, workspaceId, name: "Test User", email: "test@example.com", role: "owner", createdAt: now }).run();
  let current = now;
  const ctx: ServiceContext = {
    db: connection.db,
    workspace: { id: workspaceId, name: "Test Brokerage", timeZone: "America/Chicago", currency: "USD" },
    user: { id: userId, name: "Test User" },
    now: () => current,
  };
  return {
    ctx,
    connection,
    setNow(next: Date) {
      current = next;
    },
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
  };
}

export async function seededContext(now: Date = TEST_NOW) {
  const connection = openDatabase(":memory:");
  runMigrations(connection);
  await seedDemoData(connection, { now });
  const workspace = connection.db.select().from(workspaces).get()!;
  const user = connection.db.select().from(users).get()!;
  const ctx: ServiceContext = {
    db: connection.db,
    workspace: { id: workspace.id, name: workspace.name, timeZone: workspace.timeZone, currency: workspace.currency },
    user: { id: user.id, name: user.name },
    now: () => now,
  };
  return { ctx, connection };
}

let counter = 0;
/** Unique idempotency key per call. */
export function requestId(): string {
  counter += 1;
  return `test-request-${counter}-${Math.random().toString(36).slice(2, 10)}`;
}
