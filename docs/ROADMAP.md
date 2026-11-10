# Roadmap

What exists today, and what comes next. Each milestone should ship complete — domain rules, schema with constraints, services with activity logging, UI, tests — rather than as placeholder pages.

## ✅ Foundation (this release)

**Command Center**
- [x] KPI tiles from live records: received (7d vs prior 7d), awaiting contact, active, qualified, follow-ups due, trips in 14 days
- [x] Ranked "needs attention" queue with explicit reasons
- [x] Upcoming requested trips (clearly not bookings)
- [x] Weekly inquiry volume (12 weeks, with table view), lead-source performance, pipeline, defined qualification rate and first-response time
- [x] Workspace activity feed

**Lead Management**
- [x] URL-driven views, search (name, phone digits, email, reference, locations, stops), facets, sorting, pagination
- [x] Create/edit with unknown and partial facts, passenger ranges, stops, time zones, DST validation, stated budget
- [x] Inline customer creation with live duplicate hints and explicit confirmation
- [x] Status workflow with rules (qualification facts, lost reasons), priority, follow-ups (presets, done, reschedule)
- [x] Notes and logged contacts (call, email, text, meeting; inbound or outbound) on a real timeline
- [x] Quote readiness, fleet match against operator-reported fleets, delete with an audit trail
- [x] Drafts survive refresh; idempotent creates; optimistic concurrency; safe double-clicks
- [x] Phone-first detail page with a sticky action bar

**Customer Directory**
- [x] Directory with search, filters and sort; profiles with stats, inquiries, notes and timeline
- [x] Duplicate detection, explicit merge, delete protection

**Operator Network**
- [x] Directory with fleet and verification summaries; filters by vehicle, capacity, area and verification state
- [x] Structured fleet records (category, capacity, quantity, amenities, optional verification)
- [x] Compliance checklist: operator-reported vs document received vs verified (with evidence) vs issue, plus derived expiry

**Platform**
- [x] ⌘K command palette, responsive shell, light and dark themes, CVD-validated chart and status colors
- [x] SQLite + Drizzle migrations, CHECK-constraint integrity, workspace-scoped data model
- [x] Deterministic demo dataset; safe seed and reset CLIs
- [x] 82 unit/integration tests (time-zone independent), 6 end-to-end journeys against a production build

## Next: Quoting (milestone 2)

- Quotes linked to a lead, with immutable versions, line items (vehicle, hours, fees, gratuity, taxes) and validity windows
- A customer-facing quote document; status `draft → sent → accepted | declined | expired` (only marked sent when it actually is)
- Margin view: operator cost vs customer price, so the first real financial numbers come with their inputs

## Milestone 3: Operator offers & comparison

- Request offers from matching operators (from the fleet match), record their price and validity, compare side by side
- Offer acceptance as the first real availability confirmation
- Operator service history, response times and reliability notes

## Milestone 4: Bookings & coordination

- Booking records that keep customer acceptance, operator confirmation and financial status as separate states
- Scheduling-conflict detection on vehicles (`pickup_at` + duration)
- Trip-day coordination: driver/vehicle details, itinerary changes, day-of status

## Milestone 5: Payments & finance

- Deposits, balances and refunds through a payment provider, with webhooks reconciled into payment records
- Receivables, payouts to operators, margin and revenue reporting

## Milestone 6: Multi-user SaaS

- Authentication, workspace memberships and roles (owner, admin, agent), with permissions enforced in services
- PostgreSQL, background jobs (reminders, expiring compliance alerts), audit export, backups
- Customer and operator communications (email/SMS) with delivery tracking

## Known gaps to revisit

- Notes are immutable (audit-friendly); consider "edit within 5 minutes" with history
- Lead list "Most urgent" sort ranks in memory (fine for hundreds of open leads; move ranking to SQL at scale)
- Search uses LIKE; switch to trigram or full-text search on PostgreSQL
- No bulk actions on the leads list yet
