# CLAUDE.md — QuoteDesk OS

Guidance for engineers and coding agents working in this repository. Read this first; read `docs/ARCHITECTURE.md` for the reasoning behind it.

## What this is

A commercial-grade foundation for a transportation **broker** platform. Brokers don't own vehicles: they take customer inquiries, work with independent operators, and (in future releases) quote, book and get paid. **Current scope is intake → qualification.** Quotes, operator offers, bookings, dispatch, messaging and payments do not exist yet — never add UI, statuses or copy that implies they do.

## Commands

- `npm run dev` · `npm run build` · `npm start`
- `npm run check` — lint + typecheck + Vitest. Run before every commit.
- `npm run test:e2e` — Playwright against a production build on port 3100 using `data/e2e.db` (auto-reset).
- `npm run db:generate` after editing `src/server/db/schema.ts`, then `npm run db:migrate`. Commit the generated SQL in `drizzle/`.
- `npm run db:reset -- --yes` — destructive demo refresh. Never wire seeding/resetting into app startup.

## Next.js 16 specifics (this is not the Next you may remember)

Read `node_modules/next/dist/docs/` before using an unfamiliar API (see `AGENTS.md`). Things this codebase already relies on:
- `params` / `searchParams` are Promises — `await` them.
- `error.tsx` receives `{ error: unknown, retry }`; call `retry()` (re-fetch + re-render), not `reset()`.
- `typedRoutes: true` — `Link href` is type-checked against real routes. Building a dynamic string? Cast with `as Route` only after you know the route exists.
- Dev output lives in `.next/dev`; `next build` writes `.next/`, so they can run side by side.
- Server actions are queued one at a time; typeahead reads use GET route handlers under `src/app/api/` instead.

## Architecture in one screen

```
UI (src/app, src/components)            ← no business rules, no DB access
  │  server actions (src/server/actions)  validate with Zod → call service → revalidatePath("/", "layout")
  │  route handlers (src/app/api)         read-only JSON for typeahead
  ▼
Services (src/server/services)          ← all reads/writes, transactions, activity logging, tenancy scoping
  ▼
Domain (src/domain)                     ← pure rules & vocabulary, shared with the client (no DB, no React)
  ▼
DB (src/server/db)                      ← Drizzle schema + CHECK constraints as the last line of defense
```

Rules that keep it maintainable:
1. **Business rules live in `src/domain`** (e.g. `planStatusTransition`, `attentionReason`, `evaluateReadiness`, `effectiveCompliance`). Components and services call them; they never re-implement them.
2. **Services own data access.** Every function takes a `ServiceContext` (`db`, `workspace`, `user`, `now()`), scopes queries by `ctx.workspace.id`, and is `async` (implementation is sync better-sqlite3 today, so moving to Postgres changes internals only).
3. **Every write is one transaction that also calls `logActivity`** with a typed payload from `domain/activity.ts`. `logActivity` is the only writer of `leads.last_activity_at`.
4. **Actions never throw to the client.** They return `ActionResult` (`src/lib/action-result.ts`). Map new error cases through the typed errors in `services/errors.ts`.
5. **Zod schemas in `src/domain/schemas` are the server's contract.** Client forms reuse them (see `components/leads/lead-form-model.ts`) — don't write a second set of rules in a component.
6. `src/server/context.ts` is the single place that resolves "who is acting". Auth will replace its internals, nothing else.

## Business rules (do not break)

- **Lead statuses:** `new → contacted → qualified`, plus `on_hold` and `lost`. No booking/payment statuses until those modules exist.
- **Qualified = ready to quote:** requires trip date, pickup location and passenger count. Enforced in `planStatusTransition`, in `updateLead` for already-qualified leads, and by a DB CHECK.
- **Lost requires a reason** and closes any open follow-up. `qualified_at` records the first time a lead reached Qualified and is never cleared. `first_response_at` = first move out of New (not to Lost) or first logged contact.
- **Logging contact on a New lead moves it to Contacted** (recorded as its own timeline entry). Logged contacts are records — QuoteDesk sends nothing.
- **Unknown ≠ zero.** Passenger counts are a nullable range (`min = max` for exact). Vehicle preference distinguishes `null` (not discussed) from `no_preference`. Never invent defaults for customer facts.
- **Customers:** duplicates (same normalized phone or email) are surfaced and must be confirmed; never auto-merge. A customer with inquiries can't be deleted (FK RESTRICT + `RuleError`); merging is explicit.
- **Operators:** fleet data is operator-reported unless a vehicle has a dated verification note. Compliance `verified` requires a date and an evidence note (schema + DB CHECK) and records the verifier from the session. Expiry is derived at read time. Never show a blanket "compliant" badge.
- **Money:** integer cents. The only money today is a customer's *stated budget* — never sum it into revenue or present it as a price.
- **Lead numbers** come from `workspaces.next_lead_number` and are never reused.

## Time & dates

- Customer-requested dates are `YYYY-MM-DD` text, times `HH:MM`, always with the record's IANA `time_zone`. `pickup_at` is derived (ordering only) — never the source of truth.
- `src/domain/dates.ts` is dependency-free and client-safe (plain-date math in UTC, Intl formatting). `src/domain/zoned-time.ts` (Temporal polyfill) handles wall-clock ↔ instant and DST.
- "Today" is always computed in the **workspace** time zone (`today(ctx)`), never the server's.
- Instants are `Date` (integer ms in SQLite).

## Concurrency & idempotency

- Full edits send `version`; mismatch → `ConflictError` ("reload to see the latest").
- Quick actions (status, priority, follow-up) send the expected current value (compare-and-set). Repeating an action that already took effect returns `changed: false` — safe double-clicks.
- Creates carry a `clientRequestId` (unique per workspace) generated once per form instance; a repeat submit returns the original record.
- Notes/contact logs identical to the previous entry by the same user within 30s are treated as double submits.

## UI conventions

- Use primitives in `src/components/ui` (Button, Input/Textarea, Select, Field + `fieldAria`, Badge/Dot, Card/CardHeader/CardBody, Dialog/ConfirmDialog, DropdownMenu, Popover, Tooltip, Segmented, EmptyState, Skeleton) and shell pieces (`PageContainer`, `PageHeader`, `Pager`, `TrackRecent`).
- Colors are semantic tokens in `globals.css` (both themes). Status/chart colors were validated with the dataviz validator for CVD separation — if you add a hue, validate it in light **and** dark.
- Lists are URL-driven (shareable, refresh-safe); filters only read.
- Copy is direct, specific and honest. Explain consequences before destructive actions.
- Responsive means re-prioritized, not shrunk: phones get cards, a tab bar, and a sticky lead action bar.
- Accessibility: every control labelled, errors linked via `aria-describedby`, visible focus, reduced-motion respected.

## Adding a module (e.g. Quotes)

1. Vocabulary + rules in `src/domain/quote.ts`; Zod schemas in `src/domain/schemas/quote.ts`.
2. Tables in `schema.ts` with `workspace_id`, CHECKs for invariants, FKs to `leads`/`customers`/`operators`; `npm run db:generate`.
3. Service in `src/server/services/quotes.ts` (transactions + `logActivity` with new activity types added to `domain/activity.ts`).
4. Actions in `src/server/actions/quotes.ts`; pages under `src/app/(app)/quotes`; add a nav section in `components/shell/nav.ts` **only when it ships**.
5. Tests: domain unit tests + service integration tests + extend the e2e journey.

## Reserved for future work (don't fake them)

Quotes & versioning, operator offers/comparisons, bookings (customer acceptance vs operator confirmation vs financial status), scheduling-conflict detection, dispatch, messaging, payments & deposits, financial reporting, authentication, multiple workspaces & roles.
