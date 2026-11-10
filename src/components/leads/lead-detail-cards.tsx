import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CircleCheck,
  CircleDashed,
  Clock3,
  Mail,
  MapPin,
  MessageSquareText,
  NotebookPen,
  Phone,
  Route as RouteIcon,
  Sparkles,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatPhone } from "@/domain/contact";
import { CONTACT_METHOD_LABELS } from "@/domain/customer";
import {
  formatDayDistance,
  formatDuration,
  formatElapsed,
  formatInstant,
  formatPlainDate,
  formatPlainTime,
  formatRelativeTime,
  timeZoneLabel,
  type PlainDate,
} from "@/domain/dates";
import {
  LEAD_SOURCE_LABELS,
  OCCASION_LABELS,
  SERVICE_TYPE_META,
  describeAttention,
  evaluateReadiness,
  formatLeadNumber,
  formatPassengers,
  type AttentionReason,
} from "@/domain/lead";
import { formatCents } from "@/domain/money";
import { OPERATOR_STATUS_META } from "@/domain/operator";
import { VEHICLE_CATEGORY_META, vehiclePreferenceLabel } from "@/domain/vehicle";
import type { LeadDetail } from "@/server/services/leads";
import type { FleetMatch } from "@/server/services/operators";
import { Badge, toneClass } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow, Unknown } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/misc";
import { cn, pluralize } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Attention banner
// ---------------------------------------------------------------------------

const ATTENTION_HINTS: Record<AttentionReason["kind"], string> = {
  trip_soon_unqualified: "The requested trip is close. Confirm the details and qualify it, or update the status.",
  follow_up_overdue: "Reach out, then mark the follow-up done or reschedule it.",
  awaiting_first_contact: "Make first contact, then log it below — logging moves the lead to Contacted.",
  follow_up_today: "Today is the scheduled follow-up date.",
  trip_date_passed: "The requested date is in the past. Update the status, or the trip details if the date moved.",
  stale: "Nothing has happened for a while and no follow-up is scheduled. Schedule one or update the status.",
};

export function AttentionBanner({ reason }: { reason: AttentionReason }) {
  const { label, tone } = describeAttention(reason);
  return (
    <div role="status" className={cn(toneClass(tone), "mb-5 flex items-start gap-3 rounded-xl bg-[var(--tone-bg)] px-4 py-3")}>
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-[var(--tone-fg)]">{label}</p>
        <p className="mt-0.5 text-fg-secondary">{ATTENTION_HINTS[reason.kind]}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trip
// ---------------------------------------------------------------------------

function RouteStop({ kind, label, note, last }: { kind: "pickup" | "stop" | "destination"; label: React.ReactNode; note?: string | null; last?: boolean }) {
  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? <span aria-hidden className="absolute top-5 bottom-0 left-[7px] w-px bg-border" /> : null}
      <span
        aria-hidden
        className={cn(
          "relative z-[1] mt-1 flex size-[15px] shrink-0 items-center justify-center rounded-full border-2 bg-surface",
          kind === "pickup" ? "border-accent" : kind === "destination" ? "border-fg" : "border-border-strong",
        )}
      >
        {kind !== "stop" ? <span className={cn("size-1.5 rounded-full", kind === "pickup" ? "bg-accent" : "bg-fg")} /> : null}
      </span>
      <div className="min-w-0">
        <p className="text-2xs font-semibold tracking-[0.06em] text-fg-muted uppercase">
          {kind === "pickup" ? "Pickup" : kind === "destination" ? "Destination" : "Stop"}
        </p>
        <p className="text-sm text-fg">{label}</p>
        {note ? <p className="text-xs text-fg-muted">{note}</p> : null}
      </div>
    </li>
  );
}

function Fact({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border-subtle bg-surface-sunken/60 px-3 py-2.5">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-fg">{children}</p>
      {hint ? <p className="text-2xs leading-4 text-fg-faint">{hint}</p> : null}
    </div>
  );
}

export function TripCard({ detail, businessTimeZone, today }: { detail: LeadDetail; businessTimeZone: string; today: PlainDate }) {
  const { lead, stops, schedule } = detail;
  const otherZone = lead.timeZone !== businessTimeZone;
  const passengers = formatPassengers(lead.passengersMin, lead.passengersMax);
  return (
    <Card>
      <CardHeader
        title="Trip"
        icon={<RouteIcon />}
        action={
          <div className="flex flex-wrap justify-end gap-1.5">
            {lead.occasion ? <Badge tone="champagne">{OCCASION_LABELS[lead.occasion]}</Badge> : null}
            {lead.serviceType ? <Badge tone="gray">{SERVICE_TYPE_META[lead.serviceType].label}</Badge> : null}
          </div>
        }
      />
      <CardBody className="space-y-5">
        <div>
          {lead.tripDate ? (
            <>
              <p className="text-xl font-semibold tracking-[-0.02em] text-fg">{formatPlainDate(lead.tripDate, "long")}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-secondary">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 aria-hidden className="size-3.5 text-fg-muted" />
                  {lead.pickupTime ? (
                    <span className="font-medium text-fg">
                      {formatPlainTime(lead.pickupTime)} {schedule.zoneAbbreviation}
                    </span>
                  ) : (
                    <span className="text-fg-muted italic">Pickup time not set</span>
                  )}
                </span>
                <span aria-hidden className="text-fg-faint">
                  ·
                </span>
                <span>{formatDayDistance(lead.tripDate, today)}</span>
                {otherZone ? (
                  <Badge tone="blue" size="sm">
                    {timeZoneLabel(lead.timeZone)}
                  </Badge>
                ) : null}
              </p>
              {otherZone && lead.pickupAt ? (
                <p className="mt-1 text-xs text-fg-muted">
                  That&apos;s {formatInstant(lead.pickupAt, businessTimeZone, "time")} {timeZoneLabel(businessTimeZone)} — times are stored as the
                  customer requested them.
                </p>
              ) : null}
              {schedule.ambiguous ? (
                <p className="mt-2 rounded-md bg-surface-sunken px-2.5 py-1.5 text-xs text-fg-secondary">
                  This time occurs twice on this date because clocks fall back. QuoteDesk uses the first occurrence ({schedule.zoneAbbreviation}).
                </p>
              ) : null}
              {lead.durationMinutes ? (
                <p className="mt-1.5 text-sm text-fg-secondary">
                  {formatDuration(lead.durationMinutes)}
                  {schedule.end ? (
                    <>
                      {" "}
                      · ends around <span className="font-medium text-fg">{formatPlainTime(schedule.end.time)}</span>
                      {schedule.end.dayOffset > 0 ? (
                        <Badge tone="amber" size="sm" className="ml-1.5">
                          +{schedule.end.dayOffset} day
                        </Badge>
                      ) : null}
                    </>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-fg-muted">Trip date not set yet</p>
              <p className="mt-1 text-sm text-fg-muted">The customer hasn&apos;t confirmed a date. Add it once they do.</p>
            </>
          )}
        </div>

        <ol aria-label="Route">
          <RouteStop kind="pickup" label={lead.pickupLocation ?? <Unknown>Not provided yet</Unknown>} />
          {stops.map((s) => (
            <RouteStop key={s.id} kind="stop" label={s.location} note={s.note} />
          ))}
          <RouteStop
            kind="destination"
            last
            label={lead.destination ?? <Unknown>{lead.serviceType === "hourly" ? "As directed" : "Not provided yet"}</Unknown>}
          />
        </ol>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Passengers" hint={lead.passengersMin != null && lead.passengersMax !== lead.passengersMin ? "Range — not final" : undefined}>
            {passengers ?? <span className="font-normal text-fg-faint italic">Unknown</span>}
          </Fact>
          <Fact label="Vehicle">
            {lead.vehicleCategory ? vehiclePreferenceLabel(lead.vehicleCategory) : <span className="font-normal text-fg-faint italic">Not discussed</span>}
          </Fact>
          <Fact label="Stated budget" hint={lead.budgetCents != null ? "Customer's figure, not a price" : undefined}>
            {lead.budgetCents != null ? formatCents(lead.budgetCents) : <span className="font-normal text-fg-faint italic">Not shared</span>}
          </Fact>
        </div>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

export function ReadinessCard({ detail }: { detail: LeadDetail }) {
  const r = evaluateReadiness(detail.lead);
  const pct = Math.round((r.completed / r.total) * 100);
  const missingAny = r.missingEssential.length + r.missingDetails.length > 0;
  return (
    <Card>
      <CardHeader
        title="Quote readiness"
        icon={<Sparkles />}
        description="Essentials are required to qualify; details make a future quote accurate."
        action={<span className="tabular text-sm font-semibold text-fg">{r.completed}/{r.total}</span>}
      />
      <CardBody>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-active" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quote readiness">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {r.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2 text-sm">
              {item.complete ? (
                <CircleCheck aria-hidden className="size-4 shrink-0 text-[var(--green-dot)]" />
              ) : (
                <CircleDashed aria-hidden className={cn("size-4 shrink-0", item.essential ? "text-[var(--amber-dot)]" : "text-fg-faint")} />
              )}
              <span className={cn(item.complete ? "text-fg-secondary" : "text-fg")}>{item.label}</span>
              {!item.complete && item.essential ? (
                <Badge tone="amber" size="sm">
                  Essential
                </Badge>
              ) : null}
              <span className="sr-only">{item.complete ? "— provided" : "— missing"}</span>
            </li>
          ))}
        </ul>
        {missingAny ? (
          <Button asChild variant="secondary" size="sm" className="mt-4">
            <Link href={`/leads/${detail.lead.id}/edit` as Route}>Add missing details</Link>
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

export function CustomerCard({ detail }: { detail: LeadDetail }) {
  const c = detail.customer;
  const others = c.leadCount - 1;
  return (
    <Card>
      <CardHeader title="Customer" titleAs="h2" />
      <CardBody>
        <Link href={`/customers/${c.id}` as Route} className="group flex items-center gap-3 rounded-lg">
          <Avatar name={c.fullName} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold text-fg group-hover:underline">{c.fullName}</p>
            {c.companyName ? (
              <p className="flex items-center gap-1 truncate text-sm text-fg-muted">
                <Building2 aria-hidden className="size-3.5" />
                {c.companyName}
              </p>
            ) : null}
          </div>
        </Link>
        <div className="mt-4 space-y-2">
          {c.phone ? (
            <div className="flex items-center justify-between gap-2">
              <span className="tabular truncate text-sm text-fg">{formatPhone(c.phone)}</span>
              <span className="flex shrink-0 gap-1">
                <Tooltip content="Call">
                  <Button asChild variant="secondary" size="icon-sm" aria-label={`Call ${c.fullName}`}>
                    <a href={`tel:${c.phone}`}>
                      <Phone />
                    </a>
                  </Button>
                </Tooltip>
                <Tooltip content="Text">
                  <Button asChild variant="secondary" size="icon-sm" aria-label={`Text ${c.fullName}`}>
                    <a href={`sms:${c.phone}`}>
                      <MessageSquareText />
                    </a>
                  </Button>
                </Tooltip>
              </span>
            </div>
          ) : null}
          {c.email ? (
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm text-fg">{c.email}</span>
              <Tooltip content="Email">
                <Button asChild variant="secondary" size="icon-sm" aria-label={`Email ${c.fullName}`}>
                  <a href={`mailto:${c.email}`}>
                    <Mail />
                  </a>
                </Button>
              </Tooltip>
            </div>
          ) : null}
          {c.preferredContact ? <p className="text-xs text-fg-muted">Prefers {CONTACT_METHOD_LABELS[c.preferredContact].toLowerCase()}</p> : null}
        </div>
        <Link
          href={`/customers/${c.id}` as Route}
          className="mt-4 flex items-center justify-between rounded-lg border border-border-subtle px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface-hover"
        >
          <span>
            {others > 0 ? `${pluralize(others, "other inquiry", "other inquiries")} · ${c.openLeadCount} open in total` : "First inquiry from this customer"}
          </span>
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Details
// ---------------------------------------------------------------------------

export function DetailsCard({ detail, businessTimeZone, now }: { detail: LeadDetail; businessTimeZone: string; now: Date }) {
  const { lead } = detail;
  return (
    <Card>
      <CardHeader title="Details" icon={<CalendarClock />} />
      <CardBody>
        <dl className="divide-y divide-border-subtle">
          <DetailRow label="Reference">
            <span className="tabular font-medium">{formatLeadNumber(lead.number)}</span>
          </DetailRow>
          <DetailRow label="Source">{LEAD_SOURCE_LABELS[lead.source]}</DetailRow>
          <DetailRow label="Received">{formatInstant(lead.createdAt, businessTimeZone, "full")}</DetailRow>
          <DetailRow label="Recorded by">{detail.createdByName ?? <Unknown>Unknown</Unknown>}</DetailRow>
          <DetailRow label="First response">
            {lead.firstResponseAt ? (
              `${formatElapsed(lead.firstResponseAt.getTime() - lead.createdAt.getTime())} after the inquiry`
            ) : lead.status === "new" ? (
              <span className="text-[var(--amber-fg)]">Awaiting first contact</span>
            ) : (
              <Unknown>None recorded</Unknown>
            )}
          </DetailRow>
          <DetailRow label="Qualified">
            {lead.qualifiedAt ? formatInstant(lead.qualifiedAt, businessTimeZone, "date") : <Unknown>Not yet</Unknown>}
          </DetailRow>
          <DetailRow label="Status since">{formatRelativeTime(lead.statusChangedAt, businessTimeZone, now)}</DetailRow>
          <DetailRow label="Last activity">{formatRelativeTime(lead.lastActivityAt, businessTimeZone, now)}</DetailRow>
        </dl>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Fleet match (directory lookup — not availability)
// ---------------------------------------------------------------------------

export function FleetMatchCard({
  match,
  criteria,
}: {
  match: FleetMatch | null;
  criteria: { category: keyof typeof VEHICLE_CATEGORY_META | null; minCapacity: number | null };
}) {
  const params = new URLSearchParams();
  if (criteria.category) params.set("category", criteria.category);
  if (criteria.minCapacity) params.set("minCapacity", String(criteria.minCapacity));
  const categoryLabel = criteria.category ? VEHICLE_CATEGORY_META[criteria.category].label : null;
  const what = categoryLabel ? `${/^(SUV|[AEIOU])/.test(categoryLabel) ? "an" : "a"} ${categoryLabel}` : "a vehicle";
  const seats = criteria.minCapacity ? ` seating ${criteria.minCapacity}+` : "";
  return (
    <Card>
      <CardHeader title="Fleet match" icon={<MapPin />} description="Operators whose reported fleet fits this request" />
      <CardBody>
        {!match ? (
          <p className="text-sm text-fg-muted">Add a passenger count or vehicle preference to see which operators in your network could fit.</p>
        ) : (
          <>
            <p className="text-sm text-fg">
              <span className="font-semibold">{pluralize(match.total, "operator")}</span> {match.total === 1 ? "lists" : "list"} {what}
              {seats}.
            </p>
            {match.operators.length > 0 ? (
              <ul className="mt-3 divide-y divide-border-subtle rounded-lg border border-border-subtle">
                {match.operators.map((op) => {
                  const best = [...op.matchingVehicles].sort((a, b) => (b.capacity ?? 0) - (a.capacity ?? 0))[0];
                  return (
                    <li key={op.id}>
                      <Link href={`/operators/${op.id}` as Route} className="flex items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-hover">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-fg">{op.companyName}</span>
                          {best ? (
                            <span className="block truncate text-xs text-fg-muted">
                              {best.quantity > 1 ? `${best.quantity} × ` : ""}
                              {best.label ?? VEHICLE_CATEGORY_META[best.category].label}
                              {best.capacity ? ` · ${best.capacity} pax` : ""}
                            </span>
                          ) : null}
                        </span>
                        <Badge tone={OPERATOR_STATUS_META[op.status].tone} size="sm">
                          {OPERATOR_STATUS_META[op.status].label}
                        </Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link href={`/operators?${params.toString()}` as Route}>
                View in Operator Network <ArrowUpRight />
              </Link>
            </Button>
            <p className="mt-3 text-xs text-fg-muted">Based on fleets operators reported to you. Availability and pricing are not confirmed.</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Internal notes
// ---------------------------------------------------------------------------

export function NotesCard({ notes, leadId }: { notes: string | null; leadId: string }) {
  return (
    <Card>
      <CardHeader
        title="Internal notes"
        icon={<NotebookPen />}
        action={
          <Button asChild variant="ghost" size="xs">
            <Link href={`/leads/${leadId}/edit#notes` as Route}>Edit</Link>
          </Button>
        }
      />
      <CardBody>
        {notes ? (
          <p className="text-sm leading-6 whitespace-pre-line text-fg-secondary">{notes}</p>
        ) : (
          <p className="text-sm text-fg-muted">No internal notes yet. Use the timeline for dated updates; keep standing requirements here.</p>
        )}
      </CardBody>
    </Card>
  );
}
