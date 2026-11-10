/**
 * `npm run db:seed` — load the demo workspace into an EMPTY, migrated database.
 *
 * Safe by design: if the database already contains a workspace, nothing is
 * changed. Starting over is a separate, deliberate command (`npm run db:reset`).
 */
import { openDatabase } from "../client";
import { inspectDatabase } from "../migrations";
import { formatSeedSummary, seedDemoData } from "../seed";

async function main(): Promise<number> {
  const connection = openDatabase();
  try {
    const state = inspectDatabase(connection);
    if (state.kind === "uninitialized" || state.kind === "pending_migrations") {
      const detail = state.kind === "pending_migrations" ? ` (${state.pending} pending migration${state.pending === 1 ? "" : "s"})` : "";
      console.error(`✗ ${connection.path} isn't migrated yet${detail}. Run \`npm run db:migrate\` first.`);
      return 1;
    }
    if (state.kind === "ready") {
      console.log(`• ${connection.path} already contains a workspace — seeding never modifies existing data. Nothing changed.`);
      console.log("  To wipe everything and load fresh demo data, run `npm run db:reset`.");
      return 0;
    }
    const started = Date.now();
    const summary = await seedDemoData(connection);
    console.log(`✓ Demo data loaded into ${connection.path} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.log(formatSeedSummary(summary));
    return 0;
  } finally {
    connection.sqlite.close();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error("✗ Seeding failed:", error instanceof Error ? error.message : error);
    console.error("  If the database is now partially seeded, run `npm run db:reset` to start clean.");
    process.exit(1);
  },
);
