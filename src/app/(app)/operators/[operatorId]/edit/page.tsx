import type { Metadata, Route } from "next";
import { notFound } from "next/navigation";
import { OperatorForm } from "@/components/operators/operator-form";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { getContext } from "@/server/context";
import { getOperator, listServiceAreas } from "@/server/services/operators";

type Params = { params: Promise<{ operatorId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { operatorId } = await params;
  const ctx = await getContext();
  const detail = await getOperator(ctx, operatorId);
  return { title: detail ? `Edit ${detail.operator.companyName}` : "Operator not found" };
}

export default async function EditOperatorPage({ params }: Params) {
  const { operatorId } = await params;
  const ctx = await getContext();
  const [detail, areas] = await Promise.all([getOperator(ctx, operatorId), listServiceAreas(ctx)]);
  if (!detail) notFound();
  const { operator } = detail;
  return (
    <PageContainer width="narrow">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          breadcrumbs={[
            { label: "Operators", href: "/operators" },
            { label: operator.companyName, href: `/operators/${operator.id}` as Route },
            { label: "Edit" },
          ]}
          title={`Edit ${operator.companyName}`}
          description="Fleet and verification records are managed on the operator's page."
        />
        {/* Remount on a new version so "Reload latest" shows fresh values. */}
        <OperatorForm key={operator.version} mode="edit" operator={operator} suggestedAreas={areas.map((a) => a.area)} />
      </div>
    </PageContainer>
  );
}
