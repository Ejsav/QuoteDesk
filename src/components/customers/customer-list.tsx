import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatPhone } from "@/domain/contact";
import { formatInstant, formatPlainDate } from "@/domain/dates";
import { leadTitle } from "@/domain/lead";
import type { CustomerListRow } from "@/server/services/customers";
import { LeadStatusBadge } from "@/components/leads/lead-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { pluralize } from "@/lib/utils";
import { customersHref, type CustomerQuery } from "./customer-query";

const rowLink =
  "block truncate font-medium text-fg after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring";

export function CustomerTable({ rows, timeZone }: { rows: CustomerListRow[]; timeZone: string }) {
  return (
    <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">Customers</caption>
        <colgroup>
          <col className="w-[30%]" />
          <col className="w-[24%] xl:w-[22%]" />
          <col className="w-[13%] xl:w-[11%]" />
          <col />
          <col className="hidden w-[13%] xl:table-column" />
        </colgroup>
        <thead className="border-b border-border bg-surface-sunken/70">
          <tr className="text-left text-xs text-fg-muted">
            <th scope="col" className="px-4 py-2.5 font-medium">
              Customer
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Contact
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Inquiries
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Latest inquiry
            </th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium xl:table-cell">
              Customer since
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {rows.map((row) => (
            <tr key={row.id} className="relative transition-colors hover:bg-surface-hover">
              <td className="px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={row.fullName} size="md" />
                  <div className="min-w-0">
                    <Link href={`/customers/${row.id}` as Route} className={rowLink}>
                      {row.fullName}
                    </Link>
                    <p className="truncate text-xs text-fg-muted">{row.companyName ?? "Individual"}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="tabular truncate text-fg-secondary">{formatPhone(row.phone) || <span className="text-fg-faint">No phone</span>}</p>
                <p className="truncate text-xs text-fg-muted">{row.email ?? "No email"}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tabular font-medium text-fg">{row.leadCount}</span>
                  {row.openLeadCount > 0 ? (
                    <Badge tone="gray" size="sm">
                      {row.openLeadCount} open
                    </Badge>
                  ) : null}
                </div>
              </td>
              <td className="px-4 py-3">
                {row.latestLead ? (
                  <div className="min-w-0">
                    <Link
                      href={`/leads/${row.latestLead.id}` as Route}
                      className="relative z-[1] block truncate text-fg-secondary hover:text-fg hover:underline"
                    >
                      {leadTitle(row.latestLead)}
                    </Link>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <LeadStatusBadge status={row.latestLead.status} size="sm" />
                      <span className="truncate text-xs text-fg-muted">
                        {row.latestLead.tripDate ? `Trip ${formatPlainDate(row.latestLead.tripDate, "medium")}` : "No trip date yet"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span className="text-fg-faint">No inquiries yet</span>
                )}
              </td>
              <td className="hidden px-4 py-3 text-fg-secondary xl:table-cell">{formatInstant(row.createdAt, timeZone, "date")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CustomerCards({ rows }: { rows: CustomerListRow[] }) {
  return (
    <ul className="space-y-2 md:hidden">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/customers/${row.id}` as Route}
            className="block rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors active:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex items-start gap-3">
              <Avatar name={row.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-fg">{row.fullName}</p>
                <p className="truncate text-xs text-fg-muted">
                  {[row.companyName, formatPhone(row.phone) || row.email].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="tabular shrink-0 text-xs text-fg-muted">
                {pluralize(row.leadCount, "inquiry", "inquiries")}
              </span>
            </div>
            {row.latestLead ? (
              <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-border-subtle pt-3">
                <LeadStatusBadge status={row.latestLead.status} size="sm" />
                <span className="min-w-0 truncate text-sm text-fg-secondary">{leadTitle(row.latestLead)}</span>
                <span className="ml-auto shrink-0 text-xs text-fg-muted">
                  {row.latestLead.tripDate ? formatPlainDate(row.latestLead.tripDate, "short") : "No date"}
                </span>
              </div>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CustomerPagination({
  query,
  page,
  pageCount,
  pageSize,
  total,
}: {
  query: CustomerQuery;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}) {
  if (total === 0) return null;
  const start = Math.min(total, (page - 1) * pageSize + 1);
  const end = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-fg-muted">
        Showing{" "}
        <span className="tabular font-medium text-fg">
          {start}–{end}
        </span>{" "}
        of <span className="tabular font-medium text-fg">{total}</span>
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <span className="hidden text-fg-muted sm:inline">
            Page {page} of {pageCount}
          </span>
          {page > 1 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={customersHref({ ...query, page: page - 1 }) as Route} rel="prev" scroll={false}>
                <ChevronLeft /> Previous
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <ChevronLeft /> Previous
            </Button>
          )}
          {page < pageCount ? (
            <Button asChild variant="secondary" size="sm">
              <Link href={customersHref({ ...query, page: page + 1 }) as Route} rel="next" scroll={false}>
                Next <ChevronRight />
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              Next <ChevronRight />
            </Button>
          )}
        </div>
      ) : null}
    </nav>
  );
}
