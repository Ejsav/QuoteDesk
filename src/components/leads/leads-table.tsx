import { Inbox, SearchX } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatDayDistance, formatRelativeTime, type PlainDate } from "@/domain/dates";
import { describeAttention, formatLeadNumber, leadTitle } from "@/domain/lead";
import { LEAD_VIEW_META, leadsHref, type LeadQuery } from "@/domain/lead-query";
import type { LeadListRow } from "@/server/services/leads";
import { Button } from "@/components/ui/button";
import { Dot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Tooltip } from "@/components/ui/menu";
import {
  AttentionBadge,
  FollowUpLabel,
  LeadStatusBadge,
  PriorityFlag,
  RouteLine,
  passengersLabel,
  tripWhen,
  vehicleLabel,
} from "./lead-display";

interface TableProps {
  rows: LeadListRow[];
  query: LeadQuery;
  timeZone: string;
  today: PlainDate;
  now: Date;
  hasRefinements: boolean;
}

function AttentionDot({ row }: { row: LeadListRow }) {
  if (!row.attention) return null;
  const { label, tone } = describeAttention(row.attention);
  return (
    <Tooltip content={label}>
      <span className="relative z-[2] inline-flex shrink-0 cursor-help items-center" aria-label={label} role="img">
        <Dot tone={tone} />
      </span>
    </Tooltip>
  );
}

function TripCell({ row, timeZone, today }: { row: LeadListRow; timeZone: string; today: PlainDate }) {
  const when = tripWhen(row, timeZone, today);
  if (!when.date || !row.tripDate) return <span className="text-sm text-fg-faint italic">No date yet</span>;
  return (
    <div className="min-w-0">
      <p className="truncate text-sm text-fg">{when.date.replace(/, \d{4}$/, "")}</p>
      <p className="truncate text-xs text-fg-muted">
        {when.time ?? "Time TBD"}
        {when.zone ? ` ${when.zone}` : ""} · {formatDayDistance(row.tripDate, today)}
      </p>
    </div>
  );
}

/** Pickup over destination — readable at table widths without crushing either. */
function RouteStack({ pickup, destination, stopCount }: { pickup: string | null; destination: string | null; stopCount: number }) {
  if (!pickup && !destination) return <span className="text-sm text-fg-faint italic">Route not provided</span>;
  return (
    <div className="min-w-0 text-sm">
      <p className="truncate text-fg-secondary" title={pickup ?? undefined}>
        {pickup ?? <span className="text-fg-faint italic">Pickup TBD</span>}
      </p>
      <p className="flex min-w-0 items-center gap-1 text-xs text-fg-muted">
        <span aria-hidden>→</span>
        <span className="truncate" title={destination ?? undefined}>
          {destination ?? <span className="italic">Destination TBD</span>}
        </span>
        {stopCount > 0 ? (
          <span className="shrink-0 rounded-sm bg-surface-hover px-1 text-2xs font-medium" title={`${stopCount} intermediate ${stopCount === 1 ? "stop" : "stops"}`}>
            +{stopCount} {stopCount === 1 ? "stop" : "stops"}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function LeadsEmpty({ query, hasRefinements }: { query: LeadQuery; hasRefinements: boolean }) {
  if (hasRefinements) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="No leads match these filters"
        description={query.q ? `Nothing in “${LEAD_VIEW_META[query.view].label}” matches “${query.q}” with the current filters.` : "Try removing a filter or switching views."}
        action={
          <Button asChild variant="secondary">
            <Link href={leadsHref({ view: query.view }) as Route}>Clear search & filters</Link>
          </Button>
        }
      />
    );
  }
  const copy: Partial<Record<LeadQuery["view"], { title: string; description: string }>> = {
    attention: { title: "Nothing needs attention", description: "No overdue follow-ups, waiting inquiries, stale leads or unqualified trips this week." },
    new: { title: "No new inquiries", description: "Every inquiry has had a first response." },
    follow_up: { title: "No follow-ups due", description: "Nothing is overdue or due today." },
    upcoming: { title: "No trips in the next 14 days", description: "Open leads with trip dates in the next two weeks will show up here." },
    qualified: { title: "No qualified leads", description: "Leads move here once trip date, pickup and passenger count are confirmed." },
    on_hold: { title: "Nothing on hold", description: "Leads paused by the customer will appear here." },
    lost: { title: "No lost leads", description: "Leads closed without moving forward will appear here." },
  };
  const c = copy[query.view] ?? { title: "No inquiries yet", description: "Record your first transportation inquiry to start building the pipeline." };
  return (
    <EmptyState
      icon={<Inbox />}
      title={c.title}
      description={c.description}
      action={
        <Button asChild variant="primary">
          <Link href="/leads/new">New inquiry</Link>
        </Button>
      }
    />
  );
}

export function LeadsTable({ rows, query, timeZone, today, now, hasRefinements }: TableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-xs">
        <LeadsEmpty query={query} hasRefinements={hasRefinements} />
      </div>
    );
  }
  const showAttention = query.view === "attention";

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
        <table className="w-full table-fixed text-left">
          <caption className="sr-only">Leads — {LEAD_VIEW_META[query.view].label}</caption>
          <thead className="border-b border-border bg-surface-sunken/70 text-2xs font-semibold tracking-[0.06em] text-fg-muted uppercase">
            <tr>
              <th scope="col" className="w-[38%] px-4 py-2.5 font-semibold xl:w-[31%]">
                Inquiry
              </th>
              <th scope="col" className="w-[18%] px-3 py-2.5 font-semibold xl:w-[15%]">
                Trip
              </th>
              <th scope="col" className="hidden px-3 py-2.5 font-semibold xl:table-cell xl:w-[21%]">
                Route
              </th>
              <th scope="col" className="w-[15%] px-3 py-2.5 font-semibold xl:w-[12%]">
                Status
              </th>
              <th scope="col" className="w-[15%] px-3 py-2.5 font-semibold xl:w-[11%]">
                Follow-up
              </th>
              <th scope="col" className="w-[14%] px-4 py-2.5 text-right font-semibold xl:w-[10%]">
                Activity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row) => {
              const group = [passengersLabel(row.passengersMin, row.passengersMax), vehicleLabel(row.vehicleCategory)].filter(Boolean).join(" · ");
              return (
                <tr key={row.id} className="group relative transition-colors hover:bg-surface-hover/70 focus-within:bg-surface-hover/70">
                  <td className="px-4 py-3 align-top">
                    <div className="flex min-w-0 items-center gap-2">
                      <AttentionDot row={row} />
                      <span className="tabular shrink-0 text-xs font-medium text-fg-muted">{formatLeadNumber(row.number)}</span>
                      <Link
                        href={`/leads/${row.id}` as Route}
                        className="truncate text-sm font-medium text-fg outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
                      >
                        {leadTitle(row)}
                      </Link>
                      <PriorityFlag priority={row.priority} />
                    </div>
                    <p className="mt-0.5 truncate pl-0 text-xs text-fg-muted">
                      {row.customer.fullName}
                      {row.customer.companyName ? ` · ${row.customer.companyName}` : ""}
                      {group ? ` · ${group}` : ""}
                    </p>
                    {showAttention && row.attention ? (
                      <div className="mt-1.5">
                        <AttentionBadge reason={row.attention} />
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 align-top">
                    <TripCell row={row} timeZone={timeZone} today={today} />
                  </td>
                  <td className="hidden px-3 py-3 align-top xl:table-cell">
                    <RouteStack pickup={row.pickupLocation} destination={row.destination} stopCount={row.stopCount} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <LeadStatusBadge status={row.status} />
                  </td>
                  <td className="px-3 py-3 align-top">
                    <FollowUpLabel date={row.status === "lost" ? null : row.followUpDate} today={today} />
                  </td>
                  <td className="px-4 py-3 text-right align-top text-xs whitespace-nowrap text-fg-muted">
                    {formatRelativeTime(row.lastActivityAt, timeZone, now)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((row) => {
          const when = tripWhen(row, timeZone, today);
          const group = [passengersLabel(row.passengersMin, row.passengersMax), vehicleLabel(row.vehicleCategory)].filter(Boolean).join(" · ");
          return (
            <li key={row.id}>
              <Link
                href={`/leads/${row.id}` as Route}
                className="block rounded-xl border border-border bg-surface p-3.5 shadow-xs transition-colors active:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                      <span className="tabular font-medium">{formatLeadNumber(row.number)}</span>
                      {row.priority === "urgent" || row.priority === "high" ? <PriorityFlag priority={row.priority} /> : null}
                    </p>
                    <p className="mt-0.5 truncate text-[15px] font-semibold text-fg">{leadTitle(row)}</p>
                    <p className="truncate text-sm text-fg-secondary">{row.customer.fullName}</p>
                  </div>
                  <LeadStatusBadge status={row.status} size="sm" />
                </div>
                <div className="mt-2.5 grid gap-1 text-sm text-fg-secondary">
                  <p className="truncate">
                    {when.date ? (
                      <>
                        <span className="font-medium text-fg">{when.relative}</span>
                        {` · ${when.time ?? "time TBD"}${when.zone ? ` ${when.zone}` : ""}`}
                      </>
                    ) : (
                      <span className="text-fg-faint italic">No trip date yet</span>
                    )}
                  </p>
                  <RouteLine pickup={row.pickupLocation} destination={row.destination} stopCount={row.stopCount} className="text-sm" />
                  {group ? <p className="truncate text-xs text-fg-muted">{group}</p> : null}
                </div>
                {(row.attention || (row.followUpDate && row.status !== "lost")) ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2.5">
                    {row.attention ? <AttentionBadge reason={row.attention} /> : null}
                    {!row.attention && row.followUpDate ? <FollowUpLabel date={row.followUpDate} today={today} className="text-xs" /> : null}
                  </div>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function leadsHasRefinements(query: LeadQuery): boolean {
  return !!query.q.trim() || query.status.length + query.priority.length + query.source.length + query.occasion.length + query.vehicle.length > 0 || !!query.trip || !!query.received || !!query.followUp;
}

