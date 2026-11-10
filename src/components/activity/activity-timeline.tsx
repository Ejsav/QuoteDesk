import {
  ArrowRightLeft,
  Building2,
  CalendarCheck2,
  CalendarPlus,
  CalendarX2,
  CarFront,
  Flag,
  GitMerge,
  Inbox,
  Mail,
  MessageSquareText,
  MessagesSquare,
  PencilLine,
  Phone,
  ShieldCheck,
  StickyNote,
  Trash2,
  UserRound,
  UserRoundPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { describeActivity, type ActivityPayloads, type ActivityType } from "@/domain/activity";
import type { ContactChannel } from "@/domain/customer";
import { formatInstant, formatRelativeTime } from "@/domain/dates";
import { LEAD_STATUS_META, formatLeadNumber } from "@/domain/lead";
import type { ActivityView } from "@/server/services/activity-log";
import { toneClass } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const CHANNEL_ICON: Record<ContactChannel, LucideIcon> = { call: Phone, email: Mail, text: MessageSquareText, meeting: Users };

function iconFor(type: ActivityType, data: unknown): { icon: LucideIcon; toneClass?: string } {
  switch (type) {
    case "lead.created":
      return { icon: Inbox, toneClass: "tone-champagne" };
    case "lead.status_changed": {
      const to = (data as ActivityPayloads["lead.status_changed"]).to;
      return { icon: ArrowRightLeft, toneClass: toneClass(LEAD_STATUS_META[to].tone) };
    }
    case "lead.priority_changed":
      return { icon: Flag };
    case "lead.follow_up_scheduled":
      return { icon: CalendarPlus };
    case "lead.follow_up_completed":
      return { icon: CalendarCheck2, toneClass: "tone-green" };
    case "lead.follow_up_cleared":
      return { icon: CalendarX2 };
    case "lead.updated":
    case "customer.updated":
    case "operator.updated":
    case "vehicle.updated":
      return { icon: PencilLine };
    case "lead.customer_changed":
      return { icon: UserRound };
    case "lead.deleted":
    case "customer.deleted":
    case "operator.deleted":
    case "vehicle.removed":
    case "compliance.removed":
      return { icon: Trash2 };
    case "note.added":
      return { icon: StickyNote };
    case "contact.logged":
      return { icon: CHANNEL_ICON[(data as ActivityPayloads["contact.logged"]).channel] ?? MessagesSquare };
    case "customer.created":
      return { icon: UserRoundPlus };
    case "customer.merged":
      return { icon: GitMerge };
    case "operator.created":
    case "operator.status_changed":
      return { icon: Building2 };
    case "vehicle.added":
      return { icon: CarFront };
    case "compliance.recorded":
      return { icon: ShieldCheck };
  }
}

function SubjectLink({ item }: { item: ActivityView }) {
  if (item.lead) {
    return (
      <Link href={`/leads/${item.lead.id}` as Route} className="font-medium text-fg hover:underline">
        <span className="tabular text-fg-muted">{formatLeadNumber(item.lead.number)}</span> {item.lead.title}
      </Link>
    );
  }
  if (item.customer) {
    return (
      <Link href={`/customers/${item.customer.id}` as Route} className="font-medium text-fg hover:underline">
        {item.customer.name}
      </Link>
    );
  }
  if (item.operator) {
    return (
      <Link href={`/operators/${item.operator.id}` as Route} className="font-medium text-fg hover:underline">
        {item.operator.name}
      </Link>
    );
  }
  return null;
}

/**
 * Timeline of real activity entries. `scope` controls how much context each
 * entry spells out: on a lead's own page the lead is implied.
 */
export function ActivityTimeline({
  items,
  scope,
  timeZone,
  now,
  compact,
  className,
}: {
  items: ActivityView[];
  scope: "lead" | "customer" | "operator" | "workspace";
  timeZone: string;
  now: Date;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((item, index) => {
        const showSubject = scope === "workspace" || (scope === "customer" && !!item.lead);
        // When the subject line already names the record, the description shouldn't repeat it.
        const describeScope =
          scope === "operator" || (showSubject && item.lead) ? "lead" : showSubject && (item.customer || item.operator) ? "customer" : scope === "workspace" ? "workspace" : scope;
        const description = describeActivity(item, describeScope);
        const { icon: Icon, toneClass: tone } = iconFor(item.type, item.data);
        const last = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!last ? <span aria-hidden className="absolute top-8 bottom-0 left-[13px] w-px bg-border-subtle" /> : null}
            <span
              className={cn(
                "relative z-[1] mt-0.5 flex size-[27px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-fg-muted",
                tone && `${tone} border-transparent bg-[var(--tone-bg)] text-[var(--tone-fg)]`,
              )}
            >
              <Icon aria-hidden className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              {showSubject ? (
                <p className="mb-0.5 truncate text-sm">
                  <SubjectLink item={item} />
                </p>
              ) : null}
              <p className={cn("text-sm text-fg-secondary", !showSubject && "text-fg")}>{description.title}</p>
              {description.body ? (
                <p
                  className={cn(
                    "mt-1.5 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2 text-sm leading-6 whitespace-pre-line text-fg-secondary",
                    compact && "line-clamp-2",
                  )}
                >
                  {description.body}
                </p>
              ) : null}
              {description.changes && description.changes.length > 0 && !compact ? (
                <ul className="mt-1.5 space-y-1">
                  {description.changes.map((c, i) => (
                    <li key={`${c.label}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-fg-muted">
                      <span className="font-medium text-fg-secondary">{c.label}</span>
                      {c.from === "updated" && c.to === "updated" ? (
                        <span>updated</span>
                      ) : (
                        <>
                          <span className="line-through decoration-fg-faint/60">{c.from}</span>
                          <span aria-hidden>→</span>
                          <span className="text-fg-secondary">{c.to}</span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 text-xs text-fg-muted">
                {item.actorName ?? "System"} ·{" "}
                <time dateTime={item.createdAt.toISOString()} title={formatInstant(item.createdAt, timeZone, "full")}>
                  {formatRelativeTime(item.createdAt, timeZone, now)}
                </time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
