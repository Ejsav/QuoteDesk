import { History, PencilLine, StickyNote } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActivityTimeline } from "@/components/activity/activity-timeline";
import {
  CustomerHeaderActions,
  CustomerProfileProvider,
  DuplicatesBanner,
  EditCustomerButton,
} from "@/components/customers/customer-profile-actions";
import { ContactCard, ContactQuickActions, InquiriesCard, StatsStrip } from "@/components/customers/customer-profile-sections";
import { Expandable } from "@/components/customers/expandable";
import { Breadcrumbs, PageContainer } from "@/components/shell/page";
import { TrackRecent } from "@/components/shell/recent";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatPhone } from "@/domain/contact";
import { CONTACT_METHOD_LABELS } from "@/domain/customer";
import { formatInstant } from "@/domain/dates";
import { getContext } from "@/server/context";
import { listCustomerActivity } from "@/server/services/activity-log";
import { today } from "@/server/services/context";
import { getCustomer, getCustomerVersion } from "@/server/services/customers";

type Params = { params: Promise<{ customerId: string }> };

/** Timeline entries shown before "Show all". */
const PREVIEW_ENTRIES = 8;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { customerId } = await params;
  const ctx = await getContext();
  const customer = await getCustomerVersion(ctx, customerId);
  return { title: customer?.fullName ?? "Customer not found" };
}

export default async function CustomerProfilePage({ params }: Params) {
  const { customerId } = await params;
  const ctx = await getContext();
  const detail = await getCustomer(ctx, customerId);
  if (!detail) notFound();

  const activity = await listCustomerActivity(ctx, customerId, 50);
  const { customer, stats } = detail;
  const tz = ctx.workspace.timeZone;
  const todayDate = today(ctx);
  const now = ctx.now();

  return (
    <CustomerProfileProvider
      customer={{
        id: customer.id,
        version: customer.version,
        fullName: customer.fullName,
        companyName: customer.companyName,
        email: customer.email,
        phone: customer.phone,
        preferredContact: customer.preferredContact,
        notes: customer.notes,
        leadCount: stats.total,
      }}
    >
      <TrackRecent
        type="customer"
        id={customer.id}
        label={customer.fullName}
        sublabel={customer.companyName ?? (formatPhone(customer.phone) || customer.email || undefined)}
        href={`/customers/${customer.id}`}
      />
      <PageContainer>
        <Breadcrumbs items={[{ label: "Customers", href: "/customers" }, { label: customer.fullName }]} />

        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={customer.fullName} size="xl" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.025em] text-fg">{customer.fullName}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
                <span className="truncate">{customer.companyName ?? "Individual customer"}</span>
                <span aria-hidden>·</span>
                <span>Customer since {formatInstant(customer.createdAt, tz, "date")}</span>
                {customer.preferredContact ? (
                  <Badge tone="champagne" size="sm">
                    Prefers {CONTACT_METHOD_LABELS[customer.preferredContact].toLowerCase()}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CustomerHeaderActions customerId={customer.id} />
          </div>
        </header>

        <ContactQuickActions phone={customer.phone} email={customer.email} className="mb-5 lg:hidden" />
        <DuplicatesBanner matches={detail.possibleDuplicates} className="mb-5" />

        {/* Phones: summary → contact & notes → history. Desktop: history under the summary, sidebar alongside both. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
          <div className="min-w-0 space-y-5 lg:col-span-8">
            <StatsStrip stats={stats} timeZone={tz} />
            <InquiriesCard customerId={customer.id} leads={detail.leads} stats={stats} timeZone={tz} today={todayDate} />
          </div>

          <div className="min-w-0 space-y-5 lg:col-span-4 lg:row-span-2">
            <ContactCard phone={customer.phone} email={customer.email} preferredContact={customer.preferredContact} companyName={customer.companyName} />
            <Card>
              <CardHeader
                title="Notes"
                icon={<StickyNote />}
                action={
                  customer.notes ? (
                    <EditCustomerButton className="h-7">
                      <PencilLine /> Edit
                    </EditCustomerButton>
                  ) : null
                }
              />
              <CardBody>
                {customer.notes ? (
                  <p className="text-sm leading-6 whitespace-pre-line text-fg-secondary">{customer.notes}</p>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center">
                    <p className="text-sm text-fg-muted">No notes yet. Capture preferences, billing contacts or VIP details.</p>
                    <EditCustomerButton className="mt-3">
                      <PencilLine /> Add notes
                    </EditCustomerButton>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <Card className="min-w-0 lg:col-span-8">
            <CardHeader title="Activity" description="Changes to this customer and everything on their inquiries" icon={<History />} />
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState compact title="No activity yet" />
              ) : activity.length > PREVIEW_ENTRIES ? (
                <Expandable
                  total={activity.length}
                  preview={<ActivityTimeline items={activity.slice(0, PREVIEW_ENTRIES)} scope="customer" timeZone={tz} now={now} />}
                  full={<ActivityTimeline items={activity} scope="customer" timeZone={tz} now={now} />}
                />
              ) : (
                <ActivityTimeline items={activity} scope="customer" timeZone={tz} now={now} />
              )}
            </CardBody>
          </Card>
        </div>
      </PageContainer>
    </CustomerProfileProvider>
  );
}
