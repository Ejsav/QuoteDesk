import { AlertTriangle, ArrowDown, ArrowUp, CalendarClock } from "lucide-react";
import { formatPlainDate, formatPlainTime, relativeDayLabel, zoneAbbreviation, type PlainDate } from "@/domain/dates";
import {
  LEAD_PRIORITY_META,
  LEAD_STATUS_META,
  OCCASION_LABELS,
  describeAttention,
  followUpState,
  formatPassengers,
  type AttentionReason,
  type LeadPriority,
  type LeadStatus,
  type Occasion,
} from "@/domain/lead";
import { vehiclePreferenceLabel, type VehiclePreference } from "@/domain/vehicle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LeadStatusBadge({ status, size = "md", className }: { status: LeadStatus; size?: "sm" | "md"; className?: string }) {
  const meta = LEAD_STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot size={size} className={className}>
      {meta.label}
    </Badge>
  );
}

/** Only non-normal priorities draw attention; "normal" renders nothing. */
export function PriorityFlag({ priority, showLow = false, className }: { priority: LeadPriority; showLow?: boolean; className?: string }) {
  if (priority === "normal" || (priority === "low" && !showLow)) return null;
  const meta = LEAD_PRIORITY_META[priority];
  const Icon = priority === "urgent" ? AlertTriangle : priority === "high" ? ArrowUp : ArrowDown;
  return (
    <Badge tone={meta.tone} size="sm" variant="soft" className={className}>
      <span className="inline-flex items-center gap-1">
        <Icon aria-hidden className="size-3" />
        {meta.label}
      </span>
    </Badge>
  );
}

export function AttentionBadge({ reason, size = "sm" }: { reason: AttentionReason; size?: "sm" | "md" }) {
  const { label, tone } = describeAttention(reason);
  return (
    <Badge tone={tone} size={size} dot>
      {label}
    </Badge>
  );
}

export function FollowUpLabel({ date, today, className }: { date: PlainDate | null; today: PlainDate; className?: string }) {
  const state = followUpState(date, today);
  if (state.kind === "none" || !date) return <span className={cn("text-fg-faint", className)}>—</span>;
  const tone = state.kind === "overdue" ? "text-[var(--red-fg)]" : state.kind === "today" ? "text-[var(--amber-fg)]" : "text-fg-secondary";
  const text =
    state.kind === "overdue"
      ? `${state.days}d overdue`
      : state.kind === "today"
        ? "Today"
        : state.days === 1
          ? "Tomorrow"
          : formatPlainDate(date, "short");
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium whitespace-nowrap", tone, className)} title={formatPlainDate(date, "long")}>
      <CalendarClock aria-hidden className="size-3.5 opacity-80" />
      {text}
    </span>
  );
}

export interface TripWhen {
  date: string | null;
  relative: string | null;
  time: string | null;
  zone: string | null;
}

/** Date/time as the customer requested it, with the zone shown only when it differs from the business zone. */
export function tripWhen(
  lead: { tripDate: PlainDate | null; pickupTime: string | null; timeZone: string },
  businessTimeZone: string,
  today?: PlainDate,
): TripWhen {
  const zone =
    lead.tripDate && lead.timeZone !== businessTimeZone ? zoneAbbreviation(lead.timeZone, new Date(`${lead.tripDate}T12:00:00Z`)) : null;
  return {
    date: lead.tripDate ? formatPlainDate(lead.tripDate, "weekdayYear") : null,
    relative: lead.tripDate && today ? relativeDayLabel(lead.tripDate, today) : null,
    time: lead.pickupTime ? formatPlainTime(lead.pickupTime) : null,
    zone,
  };
}

export function occasionLabel(occasion: Occasion | null): string | null {
  return occasion ? OCCASION_LABELS[occasion] : null;
}

export function passengersLabel(min: number | null, max: number | null): string | null {
  const p = formatPassengers(min, max);
  return p ? `${p} pax` : null;
}

export function vehicleLabel(value: VehiclePreference | null): string | null {
  return value ? vehiclePreferenceLabel(value) : null;
}

export function RouteLine({
  pickup,
  destination,
  stopCount,
  className,
}: {
  pickup: string | null;
  destination: string | null;
  stopCount: number;
  className?: string;
}) {
  if (!pickup && !destination) return <span className={cn("text-fg-faint italic", className)}>Route not provided</span>;
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{pickup ?? <span className="text-fg-faint italic">Pickup TBD</span>}</span>
      <span aria-hidden className="shrink-0 text-fg-faint">
        →
      </span>
      {stopCount > 0 ? (
        <span className="shrink-0 rounded-sm bg-surface-hover px-1 text-2xs font-medium text-fg-muted" title={`${stopCount} intermediate ${stopCount === 1 ? "stop" : "stops"}`}>
          +{stopCount}
        </span>
      ) : null}
      <span className="truncate">{destination ?? <span className="text-fg-faint italic">Destination TBD</span>}</span>
    </span>
  );
}
