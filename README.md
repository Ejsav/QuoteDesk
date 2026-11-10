# QuoteDesk OS

The operating platform for premium ground-transportation brokers — the people who coordinate party buses, executive cars, airport transfers, wedding shuttles and group charters across a network of independent operators.

This repository is the **first release foundation**: a fast, polished, working application around five connected experiences — the **Command Center**, **Lead Management**, the **Customer Directory**, the **Operator Network**, and **global search & navigation** (⌘K).

> **Status: local demonstration environment.** There is no sign-in, there is a single workspace, and data lives in a SQLite file on your machine. It is not a secure multi-user deployment. See [Limitations](#limitations).

---

## Quick start

Requirements: **Node.js 22.12+** (npm 10 ships with it). No external services, accounts or credentials.

```bash
npm install
```

```bash
npm run db:setup
```

```bash
npm run dev
```

Open <http://localhost:3000>. `db:setup` applies the migrations and loads a fictional Chicago brokerage ("Arden & Lake Transportation") with 48 customers, 65 inquiries and 14 operators.

If you open the app before setting up the database, it shows a setup screen with the exact command to run. **The app never creates, migrates, seeds or resets data on its own.**

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on port 3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | `tsc --noEmit` across app, scripts and tests |
| `npm test` | Unit + integration tests (Vitest, in-memory SQLite) |
| `npm run test:e2e` | End-to-end tests (Playwright) against a production build |
| `npm run check` | lint + typecheck + unit/integration tests |

### Database

| Command | What it does | Safe? |
| --- | --- | --- |
| `npm run db:migrate` | Apply pending SQL migrations from `drizzle/` | Never deletes data |
| `npm run db:seed` | Load the demo workspace into an **empty** database | Refuses (no-op) if a workspace exists |
| `npm run db:setup` | `db:migrate` + `db:seed` | Safe to re-run |
| `npm run db:reset -- --yes` | **Wipes everything** and reloads fresh demo data | Destructive — needs `--yes` or typing `reset` |
| `npm run db:generate` | Generate a new migration after editing `src/server/db/schema.ts` | — |
| `npm run db:studio` | Browse the database with Drizzle Studio | — |

The database path defaults to `./data/quotedesk.db`. Override it with `DATABASE_PATH` (see `.env.example`). `db:reset` rebuilds inside the same file, so a running dev server keeps working.

Demo dates are generated **relative to the day you seed**, so "overdue", "today" and "upcoming" look right immediately. As days pass, the data ages naturally; run `npm run db:reset -- --yes` to refresh it.

### Tests

```bash
npm test
```

```bash
npm run test:e2e
```

The end-to-end suite wipes and re-seeds its own database (`./data/e2e.db`), builds the app, serves it on port 3100 and drives a real browser through the acceptance journey: create a customer → create an inquiry → edit it → change status → schedule a follow-up → add a note → reload → see the dashboard change → search → filter → command palette → validation and double-submit protection → operator + vehicle → phone-sized status update. Your demo database is never touched.

On a fresh machine, install the browser once first:

```bash
npx playwright install chromium
```

## What's inside

- **Command Center** — six KPI tiles, a ranked *Needs attention* queue, upcoming requested trips, weekly inquiry volume, lead-source performance, pipeline and recent activity. Every number is computed from records, and every metric with a definition explains it (e.g. *qualification rate* is "reached Qualified", explicitly not a booking rate).
- **Lead Management** — URL-driven views, search, faceted filters and sorting; a detail page built around the trip (wall-clock time + time zone, DST-aware, midnight-crossing end times), quote readiness, follow-ups, status changes with business rules, an activity timeline with notes and logged contacts, and an operator fleet match. Create/edit forms handle unknown and partial information, inline customer creation with duplicate detection, drafts that survive refreshes, and stale-edit protection.
- **Customer Directory** — one profile per person/organization with all their inquiries, contact actions, possible-duplicate detection, an explicit merge flow, and delete rules that protect inquiry history.
- **Operator Network** — fleets as structured vehicle records (category, capacity, amenities), and verification & compliance records that separate *operator-reported* from *verified by your team* (date, verifier and evidence required).
- **Search & navigation** — sidebar + mobile tab bar, breadcrumbs, and a ⌘K / `/` command palette that searches leads, customers and operators and runs actions.

Light and dark themes are both designed (toggle in the sidebar or the palette). Chart and status colors were validated for color-vision deficiency in both themes.

## Project structure

```
src/
  app/                 Next.js App Router — (app)/ pages, api/ read-only JSON routes
  components/          ui/ primitives · shell/ navigation & palette · leads/ customers/ operators/ dashboard/ activity/
  domain/              Pure business rules & vocabulary (no DB, no React) + Zod schemas
  server/
    db/                Drizzle schema, connection, migrations helpers, seed, CLIs
    services/          Business operations (transactions, rules, activity logging, queries)
    actions/           Thin server actions: validate → service → revalidate
drizzle/               Generated SQL migrations (committed)
tests/                 unit/ · integration/ (Vitest) · e2e/ (Playwright)
docs/                  ARCHITECTURE.md · ROADMAP.md
```

Read **[CLAUDE.md](./CLAUDE.md)** before changing code, **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** for why things are built this way, and **[docs/ROADMAP.md](./docs/ROADMAP.md)** for what comes next.

## Time zones

The demo workspace's business time zone is **America/Chicago** (stored on the workspace). "Today", follow-up dates and dashboards use it. Each inquiry stores the customer's requested **calendar date + wall-clock time + its own IANA time zone**, so a 5:30 AM Detroit pickup stays 5:30 AM Detroit time. Nonexistent times (spring-forward gaps) are rejected; repeated times (fall-back) resolve to the first occurrence and are flagged.

## Demo data

Everything in the seed is fictional: people, companies, operators, hotels and venues. Phone numbers use the reserved `555-01XX` range; emails use reserved `example.*` domains; document references start with `DEMO-`. Public landmarks (O'Hare, Midway, Navy Pier…) appear only as locations.

## Limitations

- **No authentication or authorization.** Every request acts as the demo workspace's owner. Do not expose this server to a network you don't control.
- **Single workspace, single node.** The schema is workspace-scoped and ready for multi-tenancy, but there is no account system yet. SQLite fits local use; production should move to PostgreSQL (see ARCHITECTURE).
- **No quoting, bookings, dispatch, messaging or payments yet.** QuoteDesk never claims an operator confirmed availability, a quote was sent, a message was delivered, or money moved. Logged calls/emails are records of contact that happened elsewhere.
- **Verification is manual.** Records marked *Verified* reflect what your team recorded, with evidence notes — there are no automated checks against insurers or regulators.
- `npm audit` reports moderate advisories in development-only tooling (`drizzle-kit`'s bundled esbuild, `typescript-eslint`'s minimatch). Neither ships in the application.
