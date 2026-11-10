import { ChevronLeft, ChevronRight, MapPin, Phone } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { formatPhone } from "@/domain/contact";
import type { OperatorListRow } from "@/server/services/operators";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FleetChips, OperatorMonogram, OperatorStatusBadge, VerificationSummaryInline } from "./operator-display";
import { operatorsHref, type OperatorQuery } from "./operator-query";

function AreasSummary({ areas }: { areas: string[] }) {
  if (areas.length === 0) return <span className="text-sm text-fg-faint italic">Not recorded</span>;
  const shown = areas.slice(0, 2);
  return (
    <span className="block truncate text-sm text-fg-secondary" title={areas.join(", ")}>
      {shown.join(", ")}
      {areas.length > shown.length ? <span className="text-fg-muted"> +{areas.length - shown.length}</span> : null}
    </span>
  );
}

function MaxCapacity({ value }: { value: number | null }) {
  return value ? (
    <span className="text-xs text-fg-muted">
      Largest seats <span className="tabular font-medium text-fg-secondary">{value}</span>
    </span>
  ) : (
    <span className="text-xs text-fg-faint">Capacity not reported</span>
  );
}

export function OperatorTable({ rows }: { rows: OperatorListRow[] }) {
  return (
    <>
      {/* Desktop: table with a stretched link per row */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-xs md:block">
        <table className="w-full table-fixed text-left">
          <thead className="border-b border-border bg-surface-sunken/70">
            <tr className="text-2xs font-semibold tracking-[0.06em] text-fg-muted uppercase">
              <th scope="col" className="w-[26%] py-2.5 pr-3 pl-5 font-semibold">
                Operator
              </th>
              <th scope="col" className="hidden w-[15%] px-3 py-2.5 font-semibold xl:table-cell">
                Contact
              </th>
              <th scope="col" className="hidden w-[15%] px-3 py-2.5 font-semibold lg:table-cell">
                Service areas
              </th>
              <th scope="col" className="w-[22%] px-3 py-2.5 font-semibold">
                Fleet
              </th>
              <th scope="col" className="w-[14%] px-3 py-2.5 font-semibold">
                Verification
              </th>
              <th scope="col" className="w-[118px] py-2.5 pr-5 pl-3 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((op) => (
              <tr key={op.id} className="group relative align-top transition-colors hover:bg-surface-hover">
                <td className="py-3.5 pr-3 pl-5">
                  <div className="flex min-w-0 items-start gap-3">
                    <OperatorMonogram name={op.companyName} />
                    <div className="min-w-0">
                      <Link
                        href={`/operators/${op.id}` as Route}
                        className="block truncate text-sm font-medium text-fg after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline"
                      >
                        {op.companyName}
                      </Link>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-fg-muted">
                        <MapPin aria-hidden className="size-3 shrink-0" />
                        <span className="truncate">{op.baseLocation ?? "Base not recorded"}</span>
                      </span>
                    </div>
                  </div>
                </td>
                <td className="hidden px-3 py-3.5 xl:table-cell">
                  <span className="block truncate text-sm text-fg-secondary">{op.contactName ?? <span className="text-fg-faint italic">No contact</span>}</span>
                  {op.phone ? <span className="tabular mt-0.5 block truncate text-xs text-fg-muted">{formatPhone(op.phone)}</span> : null}
                </td>
                <td className="hidden px-3 py-3.5 lg:table-cell">
                  <AreasSummary areas={op.serviceAreas} />
                </td>
                <td className="px-3 py-3.5">
                  <FleetChips fleet={op.fleet} max={2} />
                  <div className="mt-1">
                    <MaxCapacity value={op.fleet.maxCapacity} />
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <VerificationSummaryInline summary={op.verification} />
                </td>
                <td className="py-3.5 pr-5 pl-3">
                  <OperatorStatusBadge status={op.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-2.5 md:hidden">
        {rows.map((op) => (
          <li key={op.id}>
            <Link
              href={`/operators/${op.id}` as Route}
              className="block rounded-xl border border-border bg-surface p-4 shadow-xs transition-colors active:bg-surface-hover"
            >
              <div className="flex items-start gap-3">
                <OperatorMonogram name={op.companyName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm leading-5 font-semibold text-fg">{op.companyName}</p>
                    <OperatorStatusBadge status={op.status} size="sm" />
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                    <MapPin aria-hidden className="size-3 shrink-0" />
                    <span className="truncate">{op.baseLocation ?? "Base not recorded"}</span>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <FleetChips fleet={op.fleet} max={3} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 border-t border-border-subtle pt-3">
                <VerificationSummaryInline summary={op.verification} />
                <div className="min-w-0 text-right">
                  <MaxCapacity value={op.fleet.maxCapacity} />
                  {op.phone ? (
                    <span className="tabular mt-0.5 flex items-center justify-end gap-1 text-xs text-fg-muted">
                      <Phone aria-hidden className="size-3" />
                      {formatPhone(op.phone)}
                    </span>
                  ) : null}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function OperatorPagination({
  query,
  page,
  pageCount,
  pageSize,
  total,
}: {
  query: OperatorQuery;
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const prev = page > 1 ? operatorsHref({ ...query, page: page - 1 }) : null;
  const next = page < pageCount ? operatorsHref({ ...query, page: page + 1 }) : null;
  const linkClass = buttonVariants({ variant: "secondary", size: "sm" });
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      <p className="tabular text-sm text-fg-muted">
        Showing {from}–{to} of {total}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-1.5">
          {prev ? (
            <Link href={prev as Route} className={linkClass} scroll={false}>
              <ChevronLeft aria-hidden /> Previous
            </Link>
          ) : (
            <span aria-disabled className={cn(linkClass, "pointer-events-none opacity-45")}>
              <ChevronLeft aria-hidden /> Previous
            </span>
          )}
          <span className="tabular px-2 text-sm text-fg-muted">
            {page} / {pageCount}
          </span>
          {next ? (
            <Link href={next as Route} className={linkClass} scroll={false}>
              Next <ChevronRight aria-hidden />
            </Link>
          ) : (
            <span aria-disabled className={cn(linkClass, "pointer-events-none opacity-45")}>
              Next <ChevronRight aria-hidden />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
