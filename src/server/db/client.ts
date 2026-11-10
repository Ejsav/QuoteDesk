/**
 * SQLite connection management.
 *
 * One connection per process, opened lazily (never at import time) and cached
 * on `globalThis` so Next.js dev-mode hot reloads don't leak handles.
 * WAL mode + foreign keys are enabled on every connection.
 */
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

export interface Connection {
  sqlite: Database.Database;
  db: DB;
  path: string;
}

export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured === ":memory:") return configured;
  // The database lives outside the bundle; tell Turbopack not to trace this path.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), configured || "data/quotedesk.db");
}

export function openDatabase(filePath: string = resolveDatabasePath()): Connection {
  if (filePath !== ":memory:") fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sqlite = new Database(filePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  sqlite.pragma("synchronous = NORMAL");
  return { sqlite, db: drizzle({ client: sqlite, schema }), path: filePath };
}

const cache = globalThis as unknown as { __quotedeskConnection?: Connection };

export function getConnection(): Connection {
  const filePath = resolveDatabasePath();
  if (!cache.__quotedeskConnection || cache.__quotedeskConnection.path !== filePath) {
    cache.__quotedeskConnection?.sqlite.close();
    cache.__quotedeskConnection = openDatabase(filePath);
  }
  return cache.__quotedeskConnection;
}

export function getDb(): DB {
  return getConnection().db;
}
