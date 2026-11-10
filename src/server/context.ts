/**
 * Request context for pages, route handlers and server actions.
 *
 * LOCAL DEMONSTRATION ENVIRONMENT: there is no authentication. Every request
 * acts as the first user of the first workspace in the database. When auth
 * arrives, this is the single place that changes: resolve the session, then
 * the workspace membership, and return the same ServiceContext shape.
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import fs from "node:fs";
import { cache } from "react";
import { getConnection, resolveDatabasePath } from "./db/client";
import { inspectDatabase, type DatabaseState } from "./db/migrations";
import { users, workspaces } from "./db/schema";
import type { ServiceContext } from "./services/context";

export class DatabaseNotReadyError extends Error {
  constructor(readonly state: DatabaseState | { kind: "error"; message: string }) {
    super(`Database not ready: ${state.kind}`);
    this.name = "DatabaseNotReadyError";
  }
}

let knownReady = false;

export type SetupState = DatabaseState | { kind: "error"; message: string };

/** Never mutates the database — startup only inspects it. */
export const getDatabaseState = cache(async (): Promise<SetupState> => {
  await connection(); // all app data is request-time: opt out of static rendering
  if (knownReady) return { kind: "ready" };
  try {
    // Don't let SQLite create an empty file just because the app was opened.
    const filePath = resolveDatabasePath();
    if (filePath !== ":memory:" && !fs.existsSync(filePath)) return { kind: "uninitialized" };
    const state = inspectDatabase(getConnection());
    if (state.kind === "ready") knownReady = true;
    return state;
  } catch (error) {
    return { kind: "error", message: error instanceof Error ? error.message : String(error) };
  }
});

export const getContext = cache(async (): Promise<ServiceContext> => {
  const state = await getDatabaseState();
  if (state.kind !== "ready") throw new DatabaseNotReadyError(state);
  const { db } = getConnection();
  const workspace = db.select().from(workspaces).orderBy(asc(workspaces.createdAt)).limit(1).get();
  const user = workspace
    ? db.select().from(users).where(eq(users.workspaceId, workspace.id)).orderBy(asc(users.createdAt)).limit(1).get()
    : undefined;
  if (!workspace || !user) {
    knownReady = false;
    throw new DatabaseNotReadyError({ kind: "empty" });
  }
  return {
    db,
    workspace: { id: workspace.id, name: workspace.name, timeZone: workspace.timeZone, currency: workspace.currency },
    user: { id: user.id, name: user.name },
    now: () => new Date(),
  };
});
