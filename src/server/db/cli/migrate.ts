/**
 * `npm run db:migrate` — apply pending SQL migrations. Never deletes data.
 */
import { openDatabase } from "../client";
import { inspectDatabase, runMigrations } from "../migrations";

const connection = openDatabase();
const before = inspectDatabase(connection);
runMigrations(connection);
const after = inspectDatabase(connection);
connection.sqlite.close();

const label = before.kind === "pending_migrations" ? `${before.pending} pending` : before.kind;
console.log(`✓ Migrations applied to ${connection.path} (was: ${label}, now: ${after.kind})`);
if (after.kind === "empty") {
  console.log("  The database has no workspace yet. Run `npm run db:seed` to load the demo workspace.");
}
