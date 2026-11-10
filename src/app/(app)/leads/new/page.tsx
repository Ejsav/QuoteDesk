import type { Metadata } from "next";
import { LeadForm } from "@/components/leads/lead-form";
import { emptyLeadForm } from "@/components/leads/lead-form-model";
import type { CustomerSummary } from "@/components/leads/customer-picker";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { getContext } from "@/server/context";
import { today } from "@/server/services/context";
import { getCustomer } from "@/server/services/customers";

export const metadata: Metadata = { title: "New inquiry" };

export default async function NewLeadPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const ctx = await getContext();
  const customerId = typeof params.customerId === "string" ? params.customerId : null;
  const prefill = customerId ? await getCustomer(ctx, customerId) : null;
  const initialCustomer: CustomerSummary | null = prefill
    ? {
        id: prefill.customer.id,
        fullName: prefill.customer.fullName,
        companyName: prefill.customer.companyName,
        email: prefill.customer.email,
        phone: prefill.customer.phone,
        leadCount: prefill.stats.total,
      }
    : null;
  const defaults = { ...emptyLeadForm(ctx.workspace.timeZone), customerId: initialCustomer?.id ?? "" };

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[{ label: "Leads", href: "/leads" }, { label: "New inquiry" }]}
        title="New inquiry"
        description={
          initialCustomer
            ? `Record a new transportation request from ${initialCustomer.fullName}.`
            : "Capture what the customer told you. Only the customer and source are required — everything else can wait."
        }
      />
      <LeadForm mode="create" defaultValues={defaults} initialCustomer={initialCustomer} businessTimeZone={ctx.workspace.timeZone} today={today(ctx)} />
    </PageContainer>
  );
}
