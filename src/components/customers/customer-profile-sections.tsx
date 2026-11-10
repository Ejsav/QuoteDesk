import { CalendarDays, Inbox, Mail, MessageSquareText, Phone, Plus, Users } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatPhone } from "@/domain/contact";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/domain/customer";
import { formatInstant, formatPlainDate, type PlainDate } from "@/domain/dates";
import { formatLeadNumber, leadTitle } from "@/domain/lead";
import type { CustomerDetail } from "@/server/services/customers";
import { FollowUpLabel, LeadStatusBadge, PriorityFlag, RouteLine, passengersLabel, tripWhen } from "@/components/leads/lead-display";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Unknown } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/menu";
import { EmptyState } from "@/components/ui/misc";
import { cn, pluralize } from "@/lib/utils";

function IconAction({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Tooltip content={label}>
      <Button asChild variant="ghost" size="icon-sm" aria-label={label}>
        <a href={href}>{icon}</a>
      </Button>
    </Tooltip>
  );
}

export function StatsStrip({ stats, timeZone }: { stats: CustomerDetail["stats"]; timeZone: string }) {
  const items: Array<{ label: string; value: React.ReactNode; isDate?: boolean; muted?: boolean }> = [
    { label: "Inquiries", value: stats.total },
    { label: "Open", value: stats.open },
    { label: "Reached qualified", value: stats.everQualified },
    { label: "Lost", value: stats.lost },
    {
      label: "First inquiry",
      value: stats.firstInquiryAt ? formatInstant(stats.firstInquiryAt, timeZone, "date") : "—",
      isDate: true,
      muted: !stats.firstInquiryAt,
    },
    {
      label: "Next requested trip",
      value: stats.nextTripDate ? formatPlainDate(stats.nextTripDate, "medium") : "None scheduled",
      isDate: true,
      muted: !stats.nextTripDate,
    },
  ];
  return (
    <Card className="overflow-hidden">
      <dl className="grid grid-cols-2 gap-px bg-border-subtle sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0 bg-surface px-4 py-3.5 sm:px-5">
            <dt className="truncate text-xs text-fg-muted">{item.label}</dt>
            <dd
              className={cn(
                "mt-1 truncate font-semibold tracking-[-0.01em] text-fg",
                item.isDate ? "text-sm leading-7" : "text-xl",
                item.muted && "font-medium text-fg-faint",
              )}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function InquiriesCard({
  customerId,
  leads,
  stats,
  timeZone,
  today,
}: {
  customerId: string;
  leads: CustomerDetail["leads"];
  stats: CustomerDetail["stats"];
  timeZone: string;
  today: PlainDate;
}) {
  const newHref = `/leads/new?customerId=${customerId}` as Route;
  return (
    <Card>
      <CardHeader
        title="Inquiries"
        description={leads.length === 0 ? "No trip requests yet" : `${pluralize(stats.total, "inquiry", "inquiries")} · ${stats.open} open · newest first`}
        action={
          leads.length > 0 ? (
            <Button asChild variant="ghost" size="sm">
              <Link href={newHref}>
                <Plus /> New inquiry
              </Link>
            </Button>
          ) : null
        }
      />
      {leads.length === 0 ? (
        <EmptyState
          compact
          icon={<Inbox />}
          title="No inquiries yet"
          description="Log this customer's first trip request — it will stay connected to this profile."
          action={
            <Button asChild variant="primary" size="sm">
              <Link href={newHref}>
                <Plus /> Create first inquiry
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border-subtle border-t border-border-subtle">
          {leads.map((lead) => {
            const when = tripWhen(lead, timeZone, today);
            const pax = passengersLabel(lead.passengersMin, lead.passengersMax);
            return (
              <li key={lead.id}>
                <Link
                  href={`/leads/${lead.id}` as Route}
                  className="group flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="tabular shrink-0 text-xs font-medium text-fg-muted">{formatLeadNumber(lead.number)}</span>
                      <span className="truncate text-sm font-medium text-fg group-hover:underline">{leadTitle(lead)}</span>
                      <PriorityFlag priority={lead.priority} />
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                      <span className="inline-flex shrink-0 items-center gap-1">
                        <CalendarDays aria-hidden className="size-3.5" />
                        {when.date ? (
                          <>
                            {when.date}
                            {when.time ? `, ${when.time}` : ""}
                            {when.zone ? ` ${when.zone}` : ""}
                          </>
                        ) : (
                          "No trip date yet"
                        )}
                      </span>
                      <RouteLine pickup={lead.pickupLocation} destination={lead.destination} stopCount={lead.stopCount} className="max-w-full sm:max-w-[300px]" />
                      {pax ? (
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <Users aria-hidden className="size-3.5" />
                          {pax}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:justify-end">
                    {lead.status !== "lost" && lead.followUpDate ? <FollowUpLabel date={lead.followUpDate} today={today} className="text-xs" /> : null}
                    <LeadStatusBadge status={lead.status} size="sm" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ContactCard({
  phone,
  email,
  preferredContact,
  companyName,
}: {
  phone: string | null;
  email: string | null;
  preferredContact: ContactMethod | null;
  companyName: string | null;
}) {
  return (
    <Card>
      <CardHeader title="Contact" />
      <CardBody>
        <dl className="divide-y divide-border-subtle">
          <div className="flex items-center gap-3 py-2.5 first:pt-0">
            <Phone aria-hidden className="size-4 shrink-0 text-fg-muted" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-fg-muted">Phone</dt>
              <dd className="tabular truncate text-sm text-fg">{phone ? formatPhone(phone) : <Unknown>No phone on file</Unknown>}</dd>
            </div>
            {phone ? (
              <div className="flex shrink-0 items-center">
                <IconAction href={`tel:${phone}`} label="Call" icon={<Phone />} />
                <IconAction href={`sms:${phone}`} label="Send a text" icon={<MessageSquareText />} />
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3 py-2.5">
            <Mail aria-hidden className="size-4 shrink-0 text-fg-muted" />
            <div className="min-w-0 flex-1">
              <dt className="text-xs text-fg-muted">Email</dt>
              <dd className="truncate text-sm text-fg">{email ?? <Unknown>No email on file</Unknown>}</dd>
            </div>
            {email ? (
              <div className="shrink-0">
                <IconAction href={`mailto:${email}`} label="Send an email" icon={<Mail />} />
              </div>
            ) : null}
          </div>
          <div className="py-2.5">
            <dt className="text-xs text-fg-muted">Preferred contact</dt>
            <dd className="text-sm text-fg">{preferredContact ? CONTACT_METHOD_LABELS[preferredContact] : <Unknown>No preference recorded</Unknown>}</dd>
          </div>
          <div className="py-2.5 last:pb-0">
            <dt className="text-xs text-fg-muted">Company</dt>
            <dd className="text-sm text-fg">{companyName ?? <Unknown>Individual customer</Unknown>}</dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}

/** Thumb-reachable contact actions shown under the header on small screens. */
export function ContactQuickActions({ phone, email, className }: { phone: string | null; email: string | null; className?: string }) {
  if (!phone && !email) return null;
  return (
    <div className={cn("grid auto-cols-fr grid-flow-col gap-2", className)}>
      {phone ? (
        <Button asChild variant="secondary" size="lg">
          <a href={`tel:${phone}`}>
            <Phone /> Call
          </a>
        </Button>
      ) : null}
      {phone ? (
        <Button asChild variant="secondary" size="lg">
          <a href={`sms:${phone}`}>
            <MessageSquareText /> Text
          </a>
        </Button>
      ) : null}
      {email ? (
        <Button asChild variant="secondary" size="lg">
          <a href={`mailto:${email}`}>
            <Mail /> Email
          </a>
        </Button>
      ) : null}
    </div>
  );
}
