import { Database, ShieldCheck } from "lucide-react";
import type { SetupState } from "@/server/context";
import { CopyCommand } from "./copy-command";
import { Wordmark } from "./logo";

function contentFor(state: Exclude<SetupState, { kind: "ready" }>) {
  switch (state.kind) {
    case "uninitialized":
      return {
        title: "Set up your local database",
        body: "QuoteDesk keeps its data in a SQLite file on this machine, and that database hasn't been set up yet. One command creates the schema and loads the fictional demo workspace.",
        commands: ["npm run db:setup"],
      };
    case "pending_migrations":
      return {
        title: "Your database needs an update",
        body: `${state.pending} database ${state.pending === 1 ? "migration hasn't" : "migrations haven't"} been applied yet. Migrations only add structure — they never delete your records.`,
        commands: ["npm run db:migrate"],
      };
    case "empty":
      return {
        title: "Load the demo workspace",
        body: "The database schema is in place, but there's no workspace yet. Seeding loads a fictional Chicago broker with customers, inquiries and operators.",
        commands: ["npm run db:seed"],
      };
    case "error":
      return {
        title: "QuoteDesk can't open its database",
        body: state.message,
        commands: ["npm run db:setup"],
      };
  }
}

export function SetupScreen({ state }: { state: Exclude<SetupState, { kind: "ready" }> }) {
  const content = contentFor(state);
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <Wordmark className="mb-8" />
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg-muted">
            <Database className="size-5" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-[-0.02em] text-fg">{content.title}</h1>
          <p className="mt-2 text-sm leading-6 text-fg-secondary">{content.body}</p>
          <p className="mt-5 mb-2 text-sm font-medium text-fg">Run this in the project folder, then reload:</p>
          <div className="space-y-2">
            {content.commands.map((c) => (
              <CopyCommand key={c} command={c} />
            ))}
          </div>
          <div className="mt-6 flex gap-2.5 rounded-lg bg-surface-sunken p-3 text-xs leading-5 text-fg-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-secondary" aria-hidden />
            <p>
              QuoteDesk never creates, migrates or resets data on its own at startup. Every database change is a command you run on purpose —
              so opening the app can never wipe your records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
