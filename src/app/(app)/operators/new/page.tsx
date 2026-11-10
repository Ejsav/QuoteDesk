import type { Metadata } from "next";
import { OperatorForm } from "@/components/operators/operator-form";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { getContext } from "@/server/context";
import { listServiceAreas } from "@/server/services/operators";

export const metadata: Metadata = { title: "New operator" };

export default async function NewOperatorPage() {
  const ctx = await getContext();
  const areas = await listServiceAreas(ctx);
  return (
    <PageContainer width="narrow">
      <div className="mx-auto max-w-3xl">
        <PageHeader
          breadcrumbs={[{ label: "Operators", href: "/operators" }, { label: "New operator" }]}
          title="Add an operator"
          description="An independent provider you can broker trips to. Everything here is what they've told you until your team verifies it."
        />
        <OperatorForm mode="create" suggestedAreas={areas.map((a) => a.area)} />
      </div>
    </PageContainer>
  );
}
