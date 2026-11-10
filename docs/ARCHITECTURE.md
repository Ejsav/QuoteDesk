# Architecture

Why QuoteDesk OS is built the way it is, and how future modules plug in. For day-to-day conventions see [`CLAUDE.md`](../CLAUDE.md).

## Stack

| Choice | Why |
| --- | --- |
| **Next.js 16 App Router** | Server components render data straight from services; server actions give typed mutations without an API layer; route handlers serve typeahead reads. |
| **React 19 + Tailwind CSS 4** | Tokens live in CSS (`@theme`), so light/dark are two token sets rather than two stylesheets. |
| **Radix primitives + cmdk + sonner** | Accessible behavior (focus, keyboard, ARIA) for menus, dialogs, tooltips and the command palette, styled entirely in-house. |
| **Drizzle ORM + better-sqlite3** | No code generation step, no engine binaries to download, SQL-transparent queries, generated SQL migrations. SQLite needs no credentials or services, so a fresh clone runs. |
| **Zod 4** | One schema per operation, shared by server actions (authoritative) and client forms (UX). |
| **Temporal (polyfill)** | Correct wall-clock ↔ instant conversion with explicit DST disambiguation. |
| **Vitest + Playwright** | Fast unit/integration tests on in-memory SQLite; end-to-end journeys against a production build. |
| **TypeScript 6.0** | TypeScript 7 (native) is current, but `typescript-eslint` supports `< 6.1`; 6.0 keeps type-aware linting. |

npm (not pnpm) keeps setup to `npm install` on any machine; `better-sqlite3` ships prebuilt binaries for current Node versions on macOS, Linux and Windows.

## Layers

```
app/ + components/   presentation — no business rules, no DB
server/actions/      validate (Zod) → service → revalidate; returns ActionResult, never throws
server/services/     transactions, rules, activity log, workspace scoping, queries
domain/              pure rules & vocabulary, shared with the client
server/db/           schema + CHECK constraints, connection, migrations, seed
```

The service API is `async` even though better-sqlite3 is synchronous. Transactions use better-sqlite3's synchronous transaction callback, which gives true serialization: nothing interleaves between "read" and "write". Moving to PostgreSQL means switching the driver, making those callbacks `async`, and porting `schema.ts` from `sqlite-core` to `pg-core`. Callers don't change.

## Data model

```
workspaces 1─* users
workspaces 1─* customers 1─* leads 1─* lead_stops
workspaces 1─* operators 1─* operator_vehicles
                         1─* operator_compliance
workspaces 1─* activities  (subject: lead | customer | operator | none)
```

- **Tenancy from day one.** Every root table has `workspace_id`; services always scope by `ctx.workspace.id`. Child tables are reached through their parent.
- **Customers are referenced, never copied.** Leads hold `customer_id`; changing a phone number updates one row. `customers → leads` is `ON DELETE RESTRICT`.
- **Leads** store the request as given: nullable facts, passenger *ranges*, `vehicle_category` that distinguishes "not discussed" (null) from "no preference", a stated budget in cents, and calendar date + wall time + time zone.
- **Lead numbers** come from a per-workspace counter (`next_lead_number`), so they're never reused after deletes, which matters for audit trails. On PostgreSQL this becomes `UPDATE … RETURNING`.
- **Operators** carry structured fleets (category, quantity, capacity, amenities) and one compliance record per standard check, with a partial unique index (`kind <> 'other'`).
- **Activities** are an append-only log written in the same transaction as the change. Payloads hold raw values; descriptions are rendered at display time (`domain/activity.ts`). Deleting a lead cascades its timeline but writes a `lead.deleted` entry on the customer, so the trail outlives the record.

## Integrity in depth

1. **Client:** the same Zod schema validates as you type and before submit (`lead-form-model.ts`).
2. **Server:** actions re-parse input; services enforce rules that need context (follow-ups not in the past in the workspace zone, qualification facts, duplicates, ownership).
3. **Database:** CHECK constraints make impossible states unwritable. Examples: a qualified lead without its facts, a lost lead without a reason, an inverted passenger range, a "verified" record without evidence, a pickup time without a date, an unreachable customer. NULL handling is explicit, because `NULL IN (…)` passes a CHECK.

Concurrency:
- **Full edits** carry `version` (optimistic locking) and return a clear conflict message.
- **Quick actions** use compare-and-set on the field they change, and are idempotent when the target state already holds, so double-clicks are safe.
- **Creates** carry a `client_request_id` with a unique index per workspace. The lead form persists its draft and request id in `sessionStorage`, so a refresh mid-submit returns the original record instead of creating a duplicate.

## Time

| Kind | Storage | Example |
| --- | --- | --- |
| Instant (created, updated, activity) | integer ms → `Date` | `2026-11-10T15:04:05Z` |
| Customer-requested date | `TEXT YYYY-MM-DD` + record `time_zone` | `2026-06-13` |
| Customer-requested time | `TEXT HH:MM` + record `time_zone` | `18:30` |
| Business calendar date (follow-ups) | `TEXT YYYY-MM-DD` in the workspace zone | `2026-11-12` |
| Derived pickup instant | integer ms (`pickup_at`) — ordering only | |

- Nonexistent wall times (spring-forward gaps) are **rejected** with an explanation; QuoteDesk never silently moves a pickup.
- Repeated wall times (fall-back) resolve to the **first** occurrence and show a note.
- Durations are elapsed time, so a 4-hour charter starting at 11 PM on a fall-back night ends at 2 AM on the clock.
- Trip end times that cross midnight show `+1 day`.
- The demo workspace uses `America/Chicago`. Trips elsewhere keep their own zone, and the UI shows the zone abbreviation plus the business-zone equivalent.

## Metrics definitions (Command Center)

- **Active:** status New, Contacted or Qualified.
- **Qualification rate:** of inquiries received in the last 90 days, the share that has reached Qualified at any point (`qualified_at`). It is not a booking rate.
- **First response:** median time from creation to the first status change out of New, or the first logged contact. It covers the last 30 days; leads still awaiting contact are reported separately.
- **Needs attention:** one rule set (`domain/lead.ts → attentionReason`) mirrored in SQL (`services/leads.ts → attentionCondition`). An integration test asserts both agree on the demo dataset. Reasons, in order: trip ≤ 7 days and not qualified, follow-up overdue, awaiting first contact (24h SLA), follow-up due today, trip date passed, no activity for 7+ days with no follow-up.
- Weekly buckets are Monday-start weeks in the business zone.

## Search

Global search reuses each workspace's list query, so the palette and the lists can never disagree. Phone search matches digits against stored E.164 values, and `L-1042`, `#1042` and `1042` all find the same lead. LIKE queries are fine at this scale; on PostgreSQL use `pg_trgm` or `tsvector`.

## UI system

- Semantic tokens for both themes, including tone variables for badges and dots. Chart and status colors were run through the dataviz palette validator (lightness band, chroma floor, CVD ΔE, contrast) separately for each theme.
- Lists are URL state. Navigation runs in a React transition that keeps the previous results visible, dimmed, instead of flashing skeletons.
- Phones get re-prioritized layouts: cards, a bottom tab bar with the attention count, a sticky lead action bar, and bottom-sheet dialogs.

## How future modules connect

```
customers ─┐
           ├─ leads ──< quotes (versioned) ──< quote_lines
operators ─┤              │
           └─ operator_vehicles
                          │
           operator_offers (lead_id, operator_id, vehicle_id?, price_cents, valid_until, status)
                          │
           bookings (lead_id, quote_id, accepted_offer_id,
                     customer_acceptance: pending|accepted|declined,
                     operator_confirmation: requested|confirmed|declined,
                     financial_status: unpaid|deposit_paid|paid|refunded)
                          │
           payments (booking_id, kind: deposit|balance|refund, amount_cents, status, provider_ref)
```

- A **quote** references an existing lead (and through it, the customer). Versions are immutable rows, with `quote_id + version` unique.
- An **operator offer** references a known operator and optionally a specific vehicle record. Availability becomes a real fact here: an offer *is* the operator's confirmation for a date, which is why leads never claim it.
- A **booking** keeps three independent states: what the customer accepted, what the operator confirmed, and where the money stands. Collapsing them is the mistake this design avoids.
- Leads then gain `booked` and `won` outcomes alongside `lost`, and the dashboard's qualification rate gains a true conversion rate.
- **Scheduling conflicts** use `pickup_at` plus duration against operator vehicles. That's why the instant is already stored.
- **Auth:** replace `src/server/context.ts` internals (session → membership → workspace). Add `memberships(user_id, workspace_id, role)` and enforce roles in services.
- **Production:** PostgreSQL (`pg-core` schema, async transactions, `pg_trgm` search), a managed secret store, HTTPS, audit export, backups.
