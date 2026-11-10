import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeadForm } from "@/components/leads/lead-form";
import { leadToFormValues } from "@/components/leads/lead-form-model";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { formatLeadNumber, leadTitle } from "@/domain/lead";
import { getContext } from "@/server/context";
import { today } from "@/server/services/context";
import { getLeadForEdit } from "@/server/services/leads";

type Params = { params: Promise<{ leadId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { leadId } = await params;
  const ctx = await getContext();
  const data = await getLeadForEdit(ctx, leadId);
  return { title: data ? `Edit ${formatLeadNumber(data.lead.number)}` : "Lead not found" };
}

export default async function EditLeadPage({ params }: Params) {
  const { leadId } = await params;
  const ctx = await getContext();
  const data = await getLeadForEdit(ctx, leadId);
  if (!data) notFound();
  const { lead, stops, customer } = data;
  const ref = formatLeadNumber(lead.number);

  return (
    <PageContainer width="narrow">
      <PageHeader
        breadcrumbs={[
          { label: "Leads", href: "/leads" },
          { label: ref, href: `/leads/${lead.id}` as never },
          { label: "Edit" },
        ]}
        title={`Edit ${leadTitle(lead)}`}
        description={`${ref} · ${customer.fullName}. Status, priority and follow-ups can also be changed from the inquiry page.`}
      />
      <LeadForm
        mode="edit"
        defaultValues={leadToFormValues(lead, stops)}
        initialCustomer={{
          id: customer.id,
          fullName: customer.fullName,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          leadCount: customer.leadCount,
        }}
        businessTimeZone={ctx.workspace.timeZone}
        today={today(ctx)}
        lead={{ id: lead.id, number: lead.number, version: lead.version, status: lead.status }}
      />
    </PageContainer>
  );
}
