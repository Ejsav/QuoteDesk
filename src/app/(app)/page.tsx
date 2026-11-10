import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { AttentionCard, KpiGrid, PipelineCard, SourcesCard, UpcomingTripsCard } from "@/components/dashboard/dashboard-cards";
import { VolumeChart } from "@/components/dashboard/volume-chart";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState, Overline } from "@/components/ui/misc";
import { formatPlainDate, timeZoneLabel } from "@/domain/dates";
import { getContext } from "@/server/context";
import { getDashboard } from "@/server/services/dashboard";

export const metadata: Metadata = { title: "Command Center" };

export default async function CommandCenterPage() {
  const ctx = await getContext();
  const data = await getDashboard(ctx);
  const now = ctx.now();
  const firstName = ctx.user.name.split(" ")[0];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Overline>
            {formatPlainDate(data.today, "long")} · {timeZoneLabel(ctx.workspace.timeZone)}
          </Overline>
        }
        title={`Good ${data.greeting}, ${firstName}`}
        description="Here's what needs you today across inquiries, follow-ups and upcoming trips."
        actions={
          <Button asChild variant="primary">
            <Link href="/leads/new">
              <Plus /> New inquiry
            </Link>
          </Button>
        }
      />

      <KpiGrid kpis={data.kpis} />

      <div className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-12 xl:items-start">
        <div className="contents xl:col-span-7 xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <AttentionCard attention={data.attention} timeZone={ctx.workspace.timeZone} today={data.today} className="order-1 xl:order-none" />
          <Card className="order-4 xl:order-none">
            <CardHeader title="Inquiry volume" description="Inquiries received per week, and how many have reached Qualified" />
            <CardBody>
              <VolumeChart weeks={data.volume} />
            </CardBody>
          </Card>
          <SourcesCard sources={data.sources} className="order-5 xl:order-none" />
        </div>
        <div className="contents xl:col-span-5 xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <UpcomingTripsCard
            trips={data.upcoming}
            total={data.kpis.upcomingTrips}
            timeZone={ctx.workspace.timeZone}
            today={data.today}
            className="order-2 xl:order-none"
          />
          <PipelineCard pipeline={data.pipeline} qualification={data.qualification} response={data.response} className="order-3 xl:order-none" />
          <Card className="order-6 xl:order-none">
            <CardHeader title="Recent activity" description="The latest changes across your workspace" />
            <CardBody>
              {data.activity.length === 0 ? (
                <EmptyState compact title="No activity yet" description="Changes to leads, customers and operators will appear here as they happen." />
              ) : (
                <ActivityTimeline items={data.activity} scope="workspace" timeZone={ctx.workspace.timeZone} now={now} compact />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
