import { CircleAlert, CircleCheck, Clock3, ShieldCheck } from "lucide-react";
import { initials } from "@/domain/contact";
import { formatPlainDate } from "@/domain/dates";
import {
  OPERATOR_STATUS_META,
  complianceStatusMeta,
  type EffectiveCompliance,
  type OperatorStatus,
  type VerificationSummary,
} from "@/domain/operator";
import { VEHICLE_CATEGORY_META, type VehicleCategory } from "@/domain/vehicle";
import type { FleetSummary } from "@/server/services/operators";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export function OperatorStatusBadge({ status, size = "md", className }: { status: OperatorStatus; size?: "sm" | "md"; className?: string }) {
  const meta = OPERATOR_STATUS_META[status];
  return (
    <Badge tone={meta.tone} dot size={size} className={className}>
      {meta.label}
    </Badge>
  );
}

/** Rounded-square monogram — companies, as opposed to the round person avatar. */
export function OperatorMonogram({ name, size = "md", className }: { name: string; size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken font-semibold tracking-[0.02em] text-fg-secondary",
        size === "md" ? "size-9 text-xs" : "size-12 text-sm",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Compact category names for dense rows (full names live in VEHICLE_CATEGORY_META). */
const SHORT_CATEGORY_LABELS: Record<VehicleCategory, string> = {
  sedan: "Sedan",
  suv: "SUV",
  sprinter: "Sprinter",
  stretch_limo: "Stretch limo",
  suv_limo: "SUV limo",
  party_bus: "Party bus",
  mini_coach: "Mini coach",
  motor_coach: "Motor coach",
  trolley: "Trolley",
};

/** Category chips with quantities, e.g. "Party bus ×2". */
export function FleetChips({
  fleet,
  max = 3,
  compact = false,
  className,
}: {
  fleet: FleetSummary;
  max?: number;
  compact?: boolean;
  className?: string;
}) {
  if (fleet.categories.length === 0) return <span className={cn("text-sm text-fg-faint italic", className)}>No vehicles recorded</span>;
  const shown = fleet.categories.slice(0, max);
  const hidden = fleet.categories.length - shown.length;
  const label = (c: VehicleCategory) => (compact ? SHORT_CATEGORY_LABELS[c] : VEHICLE_CATEGORY_META[c].label);
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {shown.map((c) => (
        <span
          key={c.category}
          title={VEHICLE_CATEGORY_META[c.category].label}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border-subtle bg-surface-sunken px-1.5 text-xs whitespace-nowrap text-fg-secondary"
        >
          {label(c.category)}
          {c.quantity > 1 ? <span className="tabular text-fg-muted">×{c.quantity}</span> : null}
        </span>
      ))}
      {hidden > 0 ? (
        <Tooltip
          content={fleet.categories
            .slice(max)
            .map((c) => `${VEHICLE_CATEGORY_META[c.category].label}${c.quantity > 1 ? ` ×${c.quantity}` : ""}`)
            .join(", ")}
        >
          <span tabIndex={0} className="inline-flex h-6 cursor-default items-center rounded-md px-1 text-xs whitespace-nowrap text-fg-muted">
            +{hidden}
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

/** "15 vehicles · up to 40 seats" */
export function fleetLine(fleet: FleetSummary): string {
  if (fleet.totalVehicles === 0) return "";
  const count = `${fleet.totalVehicles} ${fleet.totalVehicles === 1 ? "vehicle" : "vehicles"}`;
  return fleet.maxCapacity ? `${count} · up to ${fleet.maxCapacity} seats` : `${count} · seats not reported`;
}

/**
 * Six-segment meter over the standard checklist: verified (green), expired or
 * in dispute (red), expiring soon (amber), everything else on the neutral track.
 */
export function VerificationMeter({ summary, className }: { summary: VerificationSummary; className?: string }) {
  const problems = summary.expired + summary.issues;
  const soon = Math.min(summary.expiringSoon, summary.verified);
  const segments: Array<"verified" | "soon" | "problem" | "track"> = [];
  for (let i = 0; i < summary.verified - soon; i++) segments.push("verified");
  for (let i = 0; i < soon; i++) segments.push("soon");
  for (let i = 0; i < problems; i++) segments.push("problem");
  while (segments.length < summary.tracked) segments.push("track");
  return (
    <span aria-hidden className={cn("flex items-center gap-[2px]", className)}>
      {segments.slice(0, summary.tracked).map((kind, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-2.5 first:rounded-l-full last:rounded-r-full",
            kind === "verified" && "bg-[var(--green-dot)]",
            kind === "soon" && "bg-[var(--amber-dot)]",
            kind === "problem" && "bg-[var(--red-dot)]",
            kind === "track" && "bg-surface-active",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Honest verification summary: how many of the standard checks are verified,
 * plus explicit markers for anything expired, in dispute or expiring soon.
 * Deliberately never says "compliant".
 */
export function VerificationSummaryInline({ summary, className }: { summary: VerificationSummary; className?: string }) {
  const problems = summary.expired + summary.issues;
  const allVerified = summary.verified === summary.tracked;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="flex min-w-0 items-center gap-2 truncate text-sm whitespace-nowrap text-fg">
        {allVerified ? (
          <span className="inline-flex items-center gap-1">
            <ShieldCheck aria-hidden className="size-3.5 text-[var(--green-fg)]" />
            All verified
          </span>
        ) : (
          <span>
            <span className="tabular font-medium">{summary.verified}</span>
            <span className="text-fg-muted"> of {summary.tracked} verified</span>
          </span>
        )}
      </span>
      <VerificationMeter summary={summary} />
      {problems > 0 || summary.expiringSoon > 0 ? (
        <span className="flex flex-wrap items-center gap-x-2 text-xs">
          {summary.expired > 0 ? <span className="font-medium text-[var(--red-fg)]">{summary.expired} expired</span> : null}
          {summary.issues > 0 ? <span className="font-medium text-[var(--red-fg)]">{summary.issues} issue{summary.issues > 1 ? "s" : ""}</span> : null}
          {summary.expiringSoon > 0 ? <span className="font-medium text-[var(--amber-fg)]">{summary.expiringSoon} expiring soon</span> : null}
        </span>
      ) : summary.missing > 0 ? (
        <span className="text-xs text-fg-muted">{summary.missing} not on file</span>
      ) : null}
    </div>
  );
}

export function ComplianceStatusBadge({ effective, className }: { effective: EffectiveCompliance; className?: string }) {
  const meta = complianceStatusMeta(effective.status);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <Badge tone={meta.tone} dot size="sm">
        {meta.label}
      </Badge>
      {effective.expiringSoon && effective.daysUntilExpiry != null ? (
        <Badge tone="amber" size="sm">
          <span className="inline-flex items-center gap-1">
            <Clock3 aria-hidden className="size-3" />
            {effective.daysUntilExpiry === 0 ? "Expires today" : `Expires in ${effective.daysUntilExpiry}d`}
          </span>
        </Badge>
      ) : null}
    </span>
  );
}

/** Whether a vehicle's details are the operator's word or independently checked. */
export function VehicleSourceLabel({ verifiedOn, note }: { verifiedOn: string | null; note: string | null }) {
  if (!verifiedOn) {
    return (
      <Tooltip content="Details as stated by the operator. Nobody on your team has checked this vehicle yet.">
        <span tabIndex={0} className="inline-flex cursor-default items-center gap-1 text-xs whitespace-nowrap text-fg-muted">
          <CircleAlert aria-hidden className="size-3.5 text-fg-faint" />
          Operator-reported
        </span>
      </Tooltip>
    );
  }
  return (
    <Tooltip content={note ? `Verification note: ${note}` : "Verified by your team"}>
      <span tabIndex={0} className="inline-flex cursor-default items-center gap-1 text-xs font-medium whitespace-nowrap text-[var(--green-fg)]">
        <CircleCheck aria-hidden className="size-3.5" />
        Verified · {formatPlainDate(verifiedOn, "medium")}
      </span>
    </Tooltip>
  );
}
