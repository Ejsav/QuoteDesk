import { PencilLine } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ActivityComposer } from "@/components/leads/activity-composer";
import { FollowUpCard } from "@/components/leads/follow-up-card";
import { LeadMoreMenu, PriorityControl, StatusControl } from "@/components/leads/lead-controls";
import {
  AttentionBanner,
  CustomerCard,
  DetailsCard,
  FleetMatchCard,
  NotesCard,
  ReadinessCard,
  TripCard,
} from "@/components/leads/lead-detail-cards";
import { LeadMobileBar } from "@/components/leads/lead-mobile-bar";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { TrackRecent } from "@/components/shell/recent";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatRelativeTime } from "@/domain/dates";
import { LEAD_SOURCE_LABELS, formatLeadNumber, leadTitle, missingForQualification } from "@/domain/lead";
import { getContext } from "@/server/context";
import { listLeadActivity } from "@/server/services/activity-log";
import { today } from "@/server/services/context";
import { getLead } from "@/server/services/leads";
import { findFleetMatches } from "@/server/services/operators";

type Params = { params: Promise<{ leadId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { leadId } = await params;
  const ctx = await getContext();
  const detail = await getLead(ctx, leadId);
  return { title: detail ? `${formatLeadNumber(detail.lead.number)} · ${leadTitle(detail.lead)}` : "Lead not found" };
}

export default async function LeadPage({ params }: Params) {
  const { leadId } = await params;
  const ctx = await getContext();
  const detail = await getLead(ctx, leadId);
  if (!detail) notFound();

  const { lead, customer } = detail;
  const category = lead.vehicleCategory && lead.vehicleCategory !== "no_preference" ? lead.vehicleCategory : null;
  const minCapacity = lead.passengersMax ?? null;
  const [activity, fleet] = await Promise.all([
    listLeadActivity(ctx, lead.id),
    category || minCapacity ? findFleetMatches(ctx, { category, minCapacity }, 3) : Promise.resolve(null),
  ]);
  const missing = missingForQualification(lead);
  const title = leadTitle(lead);
  const ref = formatLeadNumber(lead.number);
  const now = ctx.now();
  const tz = ctx.workspace.timeZone;

  return (
    <PageContainer>
      <TrackRecent type="lead" id={lead.id} label={`${ref} · ${title}`} sublabel={customer.fullName} href={`/leads/${lead.id}`} />
      <PageHeader
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: ref }]}
        title={title}
        description={
          <>
            <Link href={`/customers/${customer.id}` as Route} className="font-medium text-fg-secondary hover:underline">
              {customer.fullName}
            </Link>
            {customer.companyName ? ` · ${customer.companyName}` : ""} · Received {formatRelativeTime(lead.createdAt, tz, now)} via{" "}
            {LEAD_SOURCE_LABELS[lead.source].toLowerCase()}
          </>
        }
        actions={
          <div className="hidden items-center gap-2 md:flex">
            <StatusControl leadId={lead.id} leadNumber={lead.number} status={lead.status} missing={missing} />
            <PriorityControl leadId={lead.id} priority={lead.priority} />
            <Button asChild variant="secondary">
              <Link href={`/leads/${lead.id}/edit` as Route}>
                <PencilLine /> Edit
              </Link>
            </Button>
            <LeadMoreMenu
              leadId={lead.id}
              leadNumber={lead.number}
              customerName={customer.fullName}
              activityCount={activity.length}
              stopCount={detail.stops.length}
            />
          </div>
        }
      />
      <LeadMobileBar
        leadId={lead.id}
        leadNumber={lead.number}
        status={lead.status}
        missing={missing}
        phone={customer.phone}
        customerName={customer.fullName}
        activityCount={activity.length}
        stopCount={detail.stops.length}
      />

      {detail.attention ? <AttentionBanner reason={detail.attention} /> : null}

      <div className="flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,370px)] xl:items-start">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <div className="order-1 xl:order-none">
            <TripCard detail={detail} businessTimeZone={tz} today={today(ctx)} />
          </div>
          <div className="order-4 xl:order-none">
            <ReadinessCard detail={detail} />
          </div>
          <div className="order-5 xl:order-none">
            <Card>
              <CardHeader title="Activity" description="Every change, note and logged contact — recorded as it happened" />
              <CardBody className="space-y-6">
                <ActivityComposer leadId={lead.id} status={lead.status} id="composer" />
                <ActivityTimeline items={activity} scope="lead" timeZone={tz} now={now} />
              </CardBody>
            </Card>
          </div>
        </div>
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <div className="order-2 xl:order-none">
            <FollowUpCard id="follow-up" leadId={lead.id} date={lead.followUpDate} note={lead.followUpNote} status={lead.status} today={today(ctx)} />
          </div>
          <div className="order-3 xl:order-none">
            <CustomerCard detail={detail} />
          </div>
          <div className="order-6 xl:order-none">
            <DetailsCard detail={detail} businessTimeZone={tz} now={now} />
          </div>
          <div className="order-7 xl:order-none">
            <FleetMatchCard match={fleet} criteria={{ category, minCapacity }} />
          </div>
          <div className="order-8 xl:order-none">
            <NotesCard notes={lead.notes} leadId={lead.id} />
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
