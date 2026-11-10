/**
 * `npm run db:reset` — DESTRUCTIVE: deletes everything in the database, then
 * re-applies migrations and loads fresh demo data.
 *
 * Requires explicit confirmation: pass `--yes` (`npm run db:reset -- --yes`),
 * or type "reset" at the interactive prompt. Without a terminal and without
 * `--yes`, it refuses.
 *
 * The reset happens inside the same database file (tables are dropped, not
 * the file), so a running dev server keeps a valid handle and simply sees the
 * fresh data on its next request.
 */
import readline from "node:readline/promises";
import type Database from "better-sqlite3";
import { openDatabase, resolveDatabasePath } from "../client";
import { runMigrations } from "../migrations";
import { formatSeedSummary, seedDemoData } from "../seed";

const confirmedByFlag = process.argv.slice(2).some((arg) => arg === "--yes" || arg === "-y");

async function confirm(path: string): Promise<boolean> {
  if (confirmedByFlag) return true;
  if (!process.stdin.isTTY) {
    console.error("✗ Refusing to reset without confirmation. This deletes all data in");
    console.error(`  ${path}`);
    console.error("  Re-run with `npm run db:reset -- --yes` if that's what you want.");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.log(`This permanently deletes ALL data in ${path}`);
    console.log("and reloads the demo workspace. This cannot be undone.");
    const answer = await rl.question('Type "reset" to continue: ');
    return answer.trim() === "reset";
  } finally {
    rl.close();
  }
}

function dropEverything(sqlite: Database.Database): number {
  const objects = sqlite
    .prepare("select type, name from sqlite_master where name not like 'sqlite_%' and type in ('table', 'view', 'trigger')")
    .all() as Array<{ type: "table" | "view" | "trigger"; name: string }>;
  // PRAGMA foreign_keys is a no-op inside a transaction, so toggle it outside.
  sqlite.pragma("foreign_keys = OFF");
  try {
    sqlite.transaction(() => {
      for (const kind of ["trigger", "view", "table"] as const) {
        for (const object of objects.filter((o) => o.type === kind)) {
          sqlite.exec(`DROP ${kind.toUpperCase()} IF EXISTS "${object.name.replace(/"/g, '""')}"`);
        }
      }
    })();
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
  return objects.filter((o) => o.type === "table").length;
}

async function main(): Promise<number> {
  const path = resolveDatabasePath();
  if (!(await confirm(path))) {
    if (!confirmedByFlag && process.stdin.isTTY) console.log("Reset cancelled. Nothing changed.");
    return 1;
  }
  const connection = openDatabase(path);
  try {
    const dropped = dropEverything(connection.sqlite);
    runMigrations(connection);
    const started = Date.now();
    const summary = await seedDemoData(connection);
    console.log(`✓ Reset ${connection.path} (dropped ${dropped} tables, re-migrated) and loaded demo data in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(formatSeedSummary(summary));
    return 0;
  } finally {
    connection.sqlite.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error("✗ Reset failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
