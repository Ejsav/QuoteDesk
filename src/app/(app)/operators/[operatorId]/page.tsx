import { ArrowUpRight, Mail, MapPin, Pencil, Phone } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import { ComplianceSection } from "@/components/operators/compliance-section";
import { FleetSection } from "@/components/operators/fleet-section";
import { OperatorMonogram } from "@/components/operators/operator-display";
import { OperatorHeaderActions } from "@/components/operators/operator-header-actions";
import { OperatorStatusMenu } from "@/components/operators/operator-status-menu";
import { Breadcrumbs, PageContainer } from "@/components/shell/page";
import { TrackRecent } from "@/components/shell/recent";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, DetailRow, Unknown } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { formatPhone } from "@/domain/contact";
import { formatInstant, formatRelativeTime } from "@/domain/dates";
import { getContext } from "@/server/context";
import { listOperatorActivity } from "@/server/services/activity-log";
import { today } from "@/server/services/context";
import { getOperator } from "@/server/services/operators";
import { cn, pluralize } from "@/lib/utils";

type Params = { params: Promise<{ operatorId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { operatorId } = await params;
  const ctx = await getContext();
  const detail = await getOperator(ctx, operatorId);
  return { title: detail?.operator.companyName ?? "Operator not found" };
}

function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub: React.ReactNode; tone?: "red" | "amber" }) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <p className="text-xs font-medium text-fg-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-[-0.02em] text-fg">{value}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-xs text-fg-muted",
          tone === "red" && "font-medium text-[var(--red-fg)]",
          tone === "amber" && "font-medium text-[var(--amber-fg)]",
        )}
      >
        {sub}
      </p>
    </div>
  );
}

export default async function OperatorPage({ params }: Params) {
  const { operatorId } = await params;
  const ctx = await getContext();
  const detail = await getOperator(ctx, operatorId);
  if (!detail) notFound();
  const activity = await listOperatorActivity(ctx, operatorId);
  const todayDate = today(ctx);
  const now = ctx.now();
  const tz = ctx.workspace.timeZone;
  const { operator, vehicles, compliance, fleet, verification } = detail;
  const problems = verification.expired + verification.issues;

  return (
    <PageContainer>
      <TrackRecent
        type="operator"
        id={operator.id}
        label={operator.companyName}
        sublabel={[operator.baseLocation, `${pluralize(fleet.totalVehicles, "vehicle")}`].filter(Boolean).join(" · ")}
        href={`/operators/${operator.id}`}
      />
      <Breadcrumbs items={[{ label: "Operators", href: "/operators" }, { label: operator.companyName }]} />

      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <OperatorMonogram name={operator.companyName} size="lg" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance text-fg">{operator.companyName}</h1>
              <OperatorStatusMenu operatorId={operator.id} status={operator.status} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-fg-muted">
              {operator.baseLocation ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin aria-hidden className="size-3.5" />
                  {operator.baseLocation}
                </span>
              ) : null}
              {operator.baseLocation ? <span aria-hidden>·</span> : null}
              <span>In your network since {formatInstant(operator.createdAt, tz, "date")}</span>
              <span aria-hidden>·</span>
              <span title={formatInstant(operator.updatedAt, tz, "full")}>Updated {formatRelativeTime(operator.updatedAt, tz, now)}</span>
            </p>
          </div>
        </div>
        <OperatorHeaderActions operatorId={operator.id} name={operator.companyName} vehicleCount={vehicles.length} recordCount={compliance.length} />
      </header>

      <Card className="mb-5 grid grid-cols-2 divide-border-subtle max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:grid-cols-4 lg:divide-x">
        <Stat
          label="Fleet"
          value={fleet.totalVehicles}
          sub={fleet.totalVehicles === 0 ? "No vehicles recorded" : `${pluralize(fleet.categories.length, "vehicle type")}`}
        />
        <Stat
          label="Largest vehicle"
          value={fleet.maxCapacity ? `${fleet.maxCapacity} seats` : "—"}
          sub={fleet.maxCapacity ? "Operator-reported capacity" : "Capacity not reported"}
        />
        <Stat
          label="Verification"
          value={`${verification.verified} of ${verification.tracked}`}
          sub={
            problems > 0
              ? `${problems} need${problems === 1 ? "s" : ""} attention`
              : verification.expiringSoon > 0
                ? `${verification.expiringSoon} expiring within 30 days`
                : "Standard checks verified"
          }
          tone={problems > 0 ? "red" : verification.expiringSoon > 0 ? "amber" : undefined}
        />
        <Stat
          label="Service areas"
          value={operator.serviceAreas.length}
          sub={operator.serviceAreas.length ? operator.serviceAreas.slice(0, 2).join(", ") : "None recorded"}
        />
      </Card>

      <div className="grid gap-5 xl:grid-cols-12 xl:items-start">
        <div className="order-2 min-w-0 space-y-5 xl:order-1 xl:col-span-8">
          <FleetSection operatorId={operator.id} vehicles={vehicles} fleet={fleet} today={todayDate} />
          <ComplianceSection
            operatorId={operator.id}
            records={compliance}
            summary={verification}
            today={todayDate}
            userName={ctx.user.name}
          />
          <Card>
            <CardHeader title="Activity" description="Changes recorded for this operator" />
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState compact title="No activity yet" />
              ) : (
                <ActivityTimeline items={activity} scope="operator" timeZone={tz} now={now} />
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="order-1 min-w-0 space-y-5 xl:order-2 xl:col-span-4">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="pt-0">
              <dl className="divide-y divide-border-subtle">
                <DetailRow label="Primary contact">{operator.contactName ?? <Unknown />}</DetailRow>
                <DetailRow label="Phone">
                  {operator.phone ? (
                    <a href={`tel:${operator.phone}`} className="tabular inline-flex items-center gap-1.5 text-fg hover:underline">
                      <Phone aria-hidden className="size-3.5 text-fg-muted" />
                      {formatPhone(operator.phone)}
                    </a>
                  ) : (
                    <Unknown />
                  )}
                </DetailRow>
                <DetailRow label="Email">
                  {operator.email ? (
                    <a href={`mailto:${operator.email}`} className="inline-flex max-w-full items-center gap-1.5 text-fg hover:underline">
                      <Mail aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
                      <span className="truncate">{operator.email}</span>
                    </a>
                  ) : (
                    <Unknown />
                  )}
                </DetailRow>
                <DetailRow label="Website">
                  {operator.website ? (
                    <a
                      href={operator.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-fg hover:underline"
                    >
                      <span className="truncate">{operator.website.replace(/^https?:\/\//, "")}</span>
                      <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
                    </a>
                  ) : (
                    <Unknown />
                  )}
                </DetailRow>
                <DetailRow label="Base">{operator.baseLocation ?? <Unknown />}</DetailRow>
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Service areas" description="Where they say they operate" />
            <CardBody className="pt-0">
              {operator.serviceAreas.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {operator.serviceAreas.map((area) => (
                    <li key={area}>
                      <Link
                        href={`/operators?area=${encodeURIComponent(area)}` as Route}
                        className="inline-flex h-7 items-center rounded-full border border-border bg-surface-sunken px-2.5 text-xs font-medium text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
                        title={`Other operators serving ${area}`}
                      >
                        {area}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fg-muted">No service areas recorded yet.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Relationship notes"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/operators/${operator.id}/edit` as Route} aria-label="Edit relationship notes">
                    <Pencil /> Edit
                  </Link>
                </Button>
              }
            />
            <CardBody className="pt-0">
              {operator.notes ? (
                <p className="text-sm leading-6 whitespace-pre-line text-fg-secondary">{operator.notes}</p>
              ) : (
                <p className="text-sm text-fg-muted">No notes yet — how they communicate, what they&apos;re great at, anything to watch for.</p>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
