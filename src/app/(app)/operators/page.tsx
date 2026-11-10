import { Building2, Plus, SearchX } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ListNavigationProvider, PendingFrame } from "@/components/operators/list-navigation";
import { OperatorFilters } from "@/components/operators/operator-filters";
import { OPERATOR_PAGE_SIZE, hasAnyOperatorFilter, operatorsHref, parseOperatorQuery } from "@/components/operators/operator-query";
import { OperatorPagination, OperatorTable } from "@/components/operators/operator-table";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { getContext } from "@/server/context";
import { countOperators, listOperators, listServiceAreas } from "@/server/services/operators";

export const metadata: Metadata = { title: "Operators" };

export default async function OperatorsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await getContext();
  const query = parseOperatorQuery(await searchParams);
  const [page, areas] = await Promise.all([
    listOperators(ctx, { ...query, pageSize: OPERATOR_PAGE_SIZE }),
    listServiceAreas(ctx),
  ]);
  if (page.total > 0 && query.page > page.pageCount) redirect(operatorsHref({ ...query, page: page.pageCount }) as Route);
  const networkSize = countOperators(ctx);
  const filtered = hasAnyOperatorFilter(query);

  return (
    <PageContainer>
      <ListNavigationProvider>
        <PageHeader
          title="Operators"
          description={
            networkSize === 0
              ? "The independent transportation providers you broker trips to."
              : `${networkSize} independent ${networkSize === 1 ? "provider" : "providers"} in your network. Fleet and compliance details are operator-reported unless marked verified.`
          }
          actions={
            <Button asChild variant="primary">
              <Link href="/operators/new">
                <Plus /> New operator
              </Link>
            </Button>
          }
        />
        {networkSize > 0 ? <OperatorFilters query={query} areas={areas} total={page.total} /> : null}
        <PendingFrame>
          {page.rows.length > 0 ? (
            <>
              <OperatorTable rows={page.rows} />
              <OperatorPagination query={query} page={page.page} pageCount={page.pageCount} pageSize={page.pageSize} total={page.total} />
            </>
          ) : networkSize === 0 ? (
            <div className="rounded-xl border border-dashed border-border-strong bg-surface">
              <EmptyState
                icon={<Building2 />}
                title="No operators yet"
                description="Add the providers you work with — their fleets, service areas and the documents you've checked — so matching a trip to a vehicle takes seconds."
                action={
                  <Button asChild variant="primary">
                    <Link href="/operators/new">
                      <Plus /> Add your first operator
                    </Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface shadow-xs">
              <EmptyState
                icon={<SearchX />}
                title={filtered ? "No operators match these filters" : "No operators on this page"}
                description={
                  filtered
                    ? "Try removing a filter or broadening the search. Capacity filters use operator-reported seat counts."
                    : "Go back to the first page of results."
                }
                action={
                  <Button asChild variant="secondary">
                    <Link href={operatorsHref({ sort: query.sort }) as Route}>Clear filters</Link>
                  </Button>
                }
              />
            </div>
          )}
        </PendingFrame>
      </ListNavigationProvider>
    </PageContainer>
  );
}
