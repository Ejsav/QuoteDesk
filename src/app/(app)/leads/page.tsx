import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LeadsTable, leadsHasRefinements } from "@/components/leads/leads-table";
import { LeadsWorkspace } from "@/components/leads/leads-workspace";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Pager } from "@/components/shell/pager";
import { Button } from "@/components/ui/button";
import { LEAD_VIEW_META, leadsHref, parseLeadQuery } from "@/domain/lead-query";
import { getContext } from "@/server/context";
import { today } from "@/server/services/context";
import { getLeadViewCounts, listLeads } from "@/server/services/leads";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = parseLeadQuery(await searchParams);
  const ctx = await getContext();
  const [result, counts] = await Promise.all([listLeads(ctx, query), getLeadViewCounts(ctx)]);
  const view = LEAD_VIEW_META[query.view];

  return (
    <PageContainer>
      <PageHeader
        title="Leads"
        description={`${view.label} — ${view.description.charAt(0).toLowerCase()}${view.description.slice(1)}.`}
        actions={
          <Button asChild variant="primary">
            <Link href="/leads/new">
              <Plus /> New inquiry
            </Link>
          </Button>
        }
      />
      <LeadsWorkspace query={query} counts={counts}>
        <LeadsTable
          rows={result.rows}
          query={query}
          timeZone={ctx.workspace.timeZone}
          today={today(ctx)}
          now={ctx.now()}
          hasRefinements={leadsHasRefinements(query)}
        />
        <Pager
          className="mt-4"
          page={result.page}
          pageCount={result.pageCount}
          total={result.total}
          pageSize={result.pageSize}
          noun={result.total === 1 ? "lead" : "leads"}
          hrefFor={(page) => leadsHref({ ...query, page })}
        />
      </LeadsWorkspace>
    </PageContainer>
  );
}
