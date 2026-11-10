import {
  ArrowUpRight,
  CalendarClock,
  CheckCheck,
  ChevronRight,
  CircleCheckBig,
  Hourglass,
  Inbox,
  Info,
  Route as RouteIcon,
  Workflow,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { daysBetween, formatDayDistance, formatElapsed, formatPlainDate, relativeDayLabel, type PlainDate } from "@/domain/dates";
import { LEAD_SOURCE_LABELS, LEAD_STATUS_META, OPEN_LEAD_STATUSES, formatLeadNumber, leadTitle, type LeadStatus } from "@/domain/lead";
import { leadsHref } from "@/domain/lead-query";
import type { DashboardData } from "@/server/services/dashboard";
import type { LeadListRow } from "@/server/services/leads";
import { AttentionBadge, LeadStatusBadge, PriorityFlag, passengersLabel, tripWhen, vehicleLabel } from "@/components/leads/lead-display";
import { Dot } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/misc";
import { cn, formatPercent, pluralize } from "@/lib/utils";

function ViewAll({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href as Route}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg"
    >
      {label}
      <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  );
}

function Definition({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip content={children}>
      <button type="button" className="inline-flex rounded-full text-fg-faint hover:text-fg-muted" aria-label="How this is calculated">
        <Info className="size-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// KPI tiles
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  href,
  icon,
  context,
  tone = "muted",
}: {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
  context: React.ReactNode;
  tone?: "muted" | "red" | "amber" | "green";
}) {
  return (
    <Link
      href={href as Route}
      className="group flex min-w-0 flex-col rounded-xl border border-border bg-surface p-4 shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-5 font-medium text-fg-secondary">{label}</span>
        <span className="text-fg-faint transition-colors group-hover:text-accent-strong [&_svg]:size-4">{icon}</span>
      </div>
      <span className="mt-2 text-[28px] leading-8 font-semibold tracking-[-0.03em] text-fg">{value}</span>
      <span
        className={cn(
          "mt-1.5 truncate text-xs",
          tone === "muted" && "text-fg-muted",
          tone === "red" && "font-medium text-[var(--red-fg)]",
          tone === "amber" && "font-medium text-[var(--amber-fg)]",
          tone === "green" && "font-medium text-[var(--green-fg)]",
        )}
      >
        {context}
      </span>
    </Link>
  );
}

export function KpiGrid({ kpis }: { kpis: DashboardData["kpis"] }) {
  const delta = kpis.received7d - kpis.receivedPrev7d;
  const dueTotal = kpis.followUpsOverdue + kpis.followUpsToday;
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile
        label="Received · 7 days"
        value={kpis.received7d}
        href={leadsHref({ view: "all", received: "7d" })}
        icon={<Inbox />}
        context={delta === 0 ? "Same as the prior 7 days" : `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs the prior 7 days`}
        tone={delta > 0 ? "green" : "muted"}
      />
      <KpiTile
        label="Awaiting contact"
        value={kpis.awaitingFirstContact}
        href={leadsHref({ view: "new" })}
        icon={<Hourglass />}
        context={
          kpis.oldestAwaitingHours == null
            ? "Everyone has been contacted"
            : `Oldest waiting ${kpis.oldestAwaitingHours < 48 ? `${kpis.oldestAwaitingHours}h` : `${Math.floor(kpis.oldestAwaitingHours / 24)}d`}`
        }
        tone={kpis.oldestAwaitingHours != null && kpis.oldestAwaitingHours >= 24 ? "red" : "muted"}
      />
      <KpiTile
        label="Active leads"
        value={kpis.active}
        href={leadsHref({ view: "open", status: ["new", "contacted", "qualified"] })}
        icon={<Workflow />}
        context="Not on hold or lost"
      />
      <KpiTile label="Qualified" value={kpis.qualified} href={leadsHref({ view: "qualified" })} icon={<CircleCheckBig />} context="Ready to quote" />
      <KpiTile
        label="Follow-ups due"
        value={dueTotal}
        href={leadsHref({ view: "follow_up" })}
        icon={<CalendarClock />}
        context={dueTotal === 0 ? "Nothing due today" : `${kpis.followUpsOverdue} overdue · ${kpis.followUpsToday} today`}
        tone={kpis.followUpsOverdue > 0 ? "red" : kpis.followUpsToday > 0 ? "amber" : "muted"}
      />
      <KpiTile
        label="Trips · next 14 days"
        value={kpis.upcomingTrips}
        href={leadsHref({ view: "upcoming" })}
        icon={<RouteIcon />}
        context={kpis.upcomingUnqualified > 0 ? `${kpis.upcomingUnqualified} not yet qualified` : "All upcoming trips qualified"}
        tone={kpis.upcomingUnqualified > 0 ? "amber" : "muted"}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Needs attention
// ---------------------------------------------------------------------------

export function AttentionCard({
  attention,
  timeZone,
  today,
  className,
}: {
  attention: DashboardData["attention"];
  timeZone: string;
  today: PlainDate;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader
        title="Needs attention"
        description={attention.total === 0 ? "Nothing is waiting on you" : `${pluralize(attention.total, "lead needs", "leads need")} someone today, most urgent first`}
        action={attention.total > 0 ? <ViewAll href={leadsHref({ view: "attention" })} label={`All ${attention.total}`} /> : null}
      />
      {attention.items.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCheck />}
          title="All caught up"
          description="No overdue follow-ups, waiting inquiries, stale leads or unqualified trips this week."
        />
      ) : (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {attention.items.map((lead) => {
            const when = tripWhen(lead, timeZone, today);
            return (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}` as Route}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="tabular shrink-0 text-xs font-medium text-fg-muted">{formatLeadNumber(lead.number)}</span>
                      <span className="truncate text-sm font-medium text-fg">{leadTitle(lead)}</span>
                      <PriorityFlag priority={lead.priority} className="hidden sm:inline-flex" />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {lead.customer.fullName}
                      {when.date ? ` · ${when.relative ?? when.date}${when.time ? `, ${when.time}` : ""}` : " · No trip date yet"}
                    </p>
                    <div className="mt-1.5 sm:hidden">
                      <AttentionBadge reason={lead.attention} />
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <AttentionBadge reason={lead.attention} />
                  </div>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-fg-faint transition-colors group-hover:text-fg-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Upcoming trips
// ---------------------------------------------------------------------------

export function UpcomingTripsCard({
  trips,
  total,
  timeZone,
  today,
  className,
}: {
  trips: LeadListRow[];
  total: number;
  timeZone: string;
  today: PlainDate;
  className?: string;
}) {
  const groups = new Map<string, LeadListRow[]>();
  for (const trip of trips) {
    const key = trip.tripDate ?? "";
    groups.set(key, [...(groups.get(key) ?? []), trip]);
  }
  return (
    <Card className={className}>
      <CardHeader
        title="Upcoming trips"
        description="Requested trips in the next 14 days — not confirmed bookings"
        action={total > 0 ? <ViewAll href={leadsHref({ view: "upcoming" })} label={total > trips.length ? `All ${total}` : "View all"} /> : null}
      />
      {trips.length === 0 ? (
        <EmptyState compact icon={<RouteIcon />} title="No trips in the next two weeks" description="Open leads with trip dates in the next 14 days will appear here." />
      ) : (
        <div className="border-t border-border-subtle">
          {[...groups.entries()].map(([date, rows]) => (
            <div key={date}>
              <p className="flex items-baseline justify-between bg-surface-sunken/60 px-4 py-1.5 text-xs font-semibold text-fg-secondary sm:px-5">
                <span>{relativeDayLabel(date, today)}</span>
                <span className="font-normal text-fg-muted">
                  {daysBetween(today, date) < 7 ? formatPlainDate(date, "short") : formatDayDistance(date, today)}
                </span>
              </p>
              <ul className="divide-y divide-border-subtle">
                {rows.map((lead) => {
                  const when = tripWhen(lead, timeZone, today);
                  const details = [passengersLabel(lead.passengersMin, lead.passengersMax), vehicleLabel(lead.vehicleCategory)].filter(Boolean).join(" · ");
                  return (
                    <li key={lead.id}>
                      <Link
                        href={`/leads/${lead.id}` as Route}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:px-5"
                      >
                        <span className="tabular w-[60px] shrink-0 text-sm font-medium text-fg">
                          {when.time ?? <span className="font-normal text-fg-faint">Time TBD</span>}
                          {when.zone ? <span className="block text-2xs font-normal text-fg-muted">{when.zone}</span> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">{leadTitle(lead)}</span>
                          <span className="block truncate text-xs text-fg-muted">
                            {lead.customer.fullName}
                            {details ? ` · ${details}` : ""}
                          </span>
                        </span>
                        <LeadStatusBadge status={lead.status} size="sm" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lead sources
// ---------------------------------------------------------------------------

export function SourcesCard({ sources, className }: { sources: DashboardData["sources"]; className?: string }) {
  const max = Math.max(1, ...sources.map((s) => s.inquiries));
  return (
    <Card className={className}>
      <CardHeader
        title="Lead sources"
        description="Inquiries received in the last 90 days"
        action={
          <Definition>
            Bar length is inquiries received; the gold portion is how many of them have reached Qualified so far. Response is the median time to
            first contact.
          </Definition>
        }
      />
      {sources.length === 0 ? (
        <EmptyState compact title="No inquiries in the last 90 days" />
      ) : (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="grid grid-cols-[minmax(0,1fr)_3rem_3.25rem_3.5rem] items-center gap-x-3 border-b border-border-subtle pb-2 text-2xs font-semibold tracking-[0.06em] text-fg-muted uppercase">
            <span>Source</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Qual.</span>
            <span className="text-right">Resp.</span>
          </div>
          <ul className="divide-y divide-border-subtle">
            {sources.map((s) => {
              const other = s.inquiries - s.qualified;
              return (
                <li key={s.source} className="grid grid-cols-[minmax(0,1fr)_3rem_3.25rem_3.5rem] items-center gap-x-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={leadsHref({ view: "all", source: [s.source], received: "90d" }) as Route}
                      className="block truncate text-sm text-fg hover:underline"
                    >
                      {LEAD_SOURCE_LABELS[s.source]}
                    </Link>
                    <div className="mt-1.5 flex h-2 items-stretch gap-[2px]" style={{ width: `${(s.inquiries / max) * 100}%` }} aria-hidden>
                      {s.qualified > 0 ? (
                        <span className={cn("bg-chart-2", other === 0 && "rounded-r-[3px]")} style={{ flexGrow: s.qualified, flexBasis: 0 }} />
                      ) : null}
                      {other > 0 ? <span className="rounded-r-[3px] bg-chart-1" style={{ flexGrow: other, flexBasis: 0 }} /> : null}
                    </div>
                  </div>
                  <span className="tabular text-right text-sm text-fg">{s.inquiries}</span>
                  <span className="tabular text-right text-sm text-fg-secondary">{formatPercent(s.qualified / s.inquiries)}</span>
                  <span className="tabular text-right text-sm text-fg-muted">{s.medianResponseMs != null ? formatElapsed(s.medianResponseMs) : "—"}</span>
                </li>
              );
            })}
          </ul>
          <ul className="mt-3 flex items-center gap-3 text-xs text-fg-secondary" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-2" />
              Reached qualified
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px] bg-chart-1" />
              Other inquiries
            </li>
          </ul>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function statusHref(status: LeadStatus): string {
  switch (status) {
    case "new":
    case "qualified":
    case "on_hold":
    case "lost":
      return leadsHref({ view: status });
    case "contacted":
      return leadsHref({ view: "open", status: ["contacted"] });
  }
}

export function PipelineCard({
  pipeline,
  qualification,
  response,
  className,
}: {
  pipeline: DashboardData["pipeline"];
  qualification: DashboardData["qualification"];
  response: DashboardData["response"];
  className?: string;
}) {
  const open = OPEN_LEAD_STATUSES.reduce((sum, s) => sum + pipeline.byStatus[s], 0);
  return (
    <Card className={className}>
      <CardHeader title="Pipeline" description={`${open} open of ${pluralize(pipeline.total, "inquiry", "inquiries")} on record`} />
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {open > 0 ? (
          <div
            role="img"
            aria-label={`Open pipeline: ${OPEN_LEAD_STATUSES.map((s) => `${pipeline.byStatus[s]} ${LEAD_STATUS_META[s].label.toLowerCase()}`).join(", ")}`}
            className="flex h-2 gap-[2px] overflow-hidden rounded-full"
          >
            {OPEN_LEAD_STATUSES.filter((s) => pipeline.byStatus[s] > 0).map((s) => (
              <Tooltip key={s} content={`${LEAD_STATUS_META[s].label}: ${pipeline.byStatus[s]} (${formatPercent(pipeline.byStatus[s] / open)})`}>
                <span className={cn("block h-full", `tone-${LEAD_STATUS_META[s].tone}`, "bg-[var(--tone-dot)]")} style={{ flexGrow: pipeline.byStatus[s], flexBasis: 0 }} />
              </Tooltip>
            ))}
          </div>
        ) : null}
        <ul className="mt-3 grid grid-cols-2 gap-x-4">
          {(["new", "contacted", "qualified", "on_hold", "lost"] as LeadStatus[]).map((s) => (
            <li key={s}>
              <Link
                href={statusHref(s) as Route}
                className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm transition-colors hover:bg-surface-hover"
              >
                <Dot tone={LEAD_STATUS_META[s].tone} />
                <span className="text-fg-secondary">{LEAD_STATUS_META[s].label}</span>
                <span className="tabular ml-auto font-medium text-fg">{pipeline.byStatus[s]}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              Qualification rate
              <Definition>
                Of the {qualification.inquiries} inquiries received in the last 90 days, the share that has reached Qualified at any point. This is not a
                booking rate — bookings aren&apos;t tracked in this release.
              </Definition>
            </p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-fg">{formatPercent(qualification.rate)}</p>
            <p className="text-xs text-fg-muted">
              {qualification.qualified} of {qualification.inquiries} · 90 days
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs text-fg-muted">
              First response
              <Definition>
                Median time from an inquiry arriving to the first status change out of New or the first logged contact, for inquiries received in the last 30
                days. {response.awaiting > 0 ? `${response.awaiting} still awaiting contact aren't included.` : ""}
              </Definition>
            </p>
            <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-fg">{response.medianMs != null ? formatElapsed(response.medianMs) : "—"}</p>
            <p className="text-xs text-fg-muted">median · {response.responded} responded · 30 days</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
