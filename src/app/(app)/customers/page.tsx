import { SearchX, Users } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { CustomerFilters } from "@/components/customers/customer-filters";
import { NewCustomerButton } from "@/components/customers/customer-form-dialog";
import { CustomerCards, CustomerPagination, CustomerTable } from "@/components/customers/customer-list";
import { CUSTOMER_FILTER_LABELS, customersHref, parseCustomerQuery } from "@/components/customers/customer-query";
import { PageContainer, PageHeader } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { pluralize } from "@/lib/utils";
import { getContext } from "@/server/context";
import { countCustomers, listCustomers } from "@/server/services/customers";

export const metadata: Metadata = { title: "Customers" };

const PAGE_SIZE = 25;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = parseCustomerQuery(params);
  const autoOpenNew = params.new === "1";

  const ctx = await getContext();
  const [result, workspaceTotal] = await Promise.all([
    listCustomers(ctx, { ...query, pageSize: PAGE_SIZE }),
    Promise.resolve(countCustomers(ctx)),
  ]);
  const refined = query.q.trim() !== "" || query.filter !== "all";
  const closeHref = customersHref(query);

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description={
          workspaceTotal === 0
            ? "One profile per person or organization, with every inquiry connected."
            : `${pluralize(workspaceTotal, "customer")} · one profile per person or organization, with every inquiry connected`
        }
        actions={<NewCustomerButton autoOpen={autoOpenNew} closeHref={closeHref} />}
      />

      {workspaceTotal === 0 ? (
        <div className="rounded-xl border border-border bg-surface shadow-xs">
          <EmptyState
            icon={<Users />}
            title="No customers yet"
            description="Customers are created when you log an inquiry, or you can add one directly. Each person keeps a single profile across every trip they request."
            action={<NewCustomerButton closeHref={closeHref} />}
          />
        </div>
      ) : (
        <>
          <CustomerFilters query={query} />
          <div className="mt-4">
            {result.rows.length === 0 ? (
              <div className="rounded-xl border border-border bg-surface shadow-xs">
                {result.total > 0 ? (
                  <EmptyState
                    icon={<SearchX />}
                    title="Nothing on this page"
                    description={`There are only ${result.pageCount} ${result.pageCount === 1 ? "page" : "pages"} of results.`}
                    action={
                      <Button asChild variant="secondary">
                        <Link href={customersHref({ ...query, page: 1 }) as Route}>Go to the first page</Link>
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={<SearchX />}
                    title="No customers match"
                    description={
                      query.q.trim()
                        ? `Nothing matches “${query.q.trim()}”${query.filter !== "all" ? ` in ${CUSTOMER_FILTER_LABELS[query.filter].toLowerCase()}` : ""}. Try a phone number, email or company name.`
                        : `No customers in ${CUSTOMER_FILTER_LABELS[query.filter].toLowerCase()} yet.`
                    }
                    action={
                      refined ? (
                        <Button asChild variant="secondary">
                          <Link href="/customers">Clear search and filters</Link>
                        </Button>
                      ) : null
                    }
                  />
                )}
              </div>
            ) : (
              <>
                <CustomerTable rows={result.rows} timeZone={ctx.workspace.timeZone} />
                <CustomerCards rows={result.rows} />
              </>
            )}
            <CustomerPagination query={query} page={result.page} pageCount={result.pageCount} pageSize={result.pageSize} total={result.total} />
          </div>
        </>
      )}
    </PageContainer>
  );
}
