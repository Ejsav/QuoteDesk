import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Server-rendered pagination using plain links (works without JS, refresh-safe). */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
  noun = "results",
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
  noun?: string;
  className?: string;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  const linkClass =
    "inline-flex h-8 items-center gap-1 rounded-md border border-border bg-surface px-2.5 text-sm font-medium text-fg shadow-xs transition-colors hover:bg-surface-hover";
  const disabledClass = "inline-flex h-8 items-center gap-1 rounded-md border border-border-subtle px-2.5 text-sm font-medium text-fg-faint";
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3", className)}>
      <p className="tabular text-sm text-fg-muted">
        {start}–{end} of {total} {noun}
      </p>
      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={hrefFor(page - 1) as Route} className={linkClass} scroll>
              <ChevronLeft aria-hidden className="size-4" /> Previous
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled>
              <ChevronLeft aria-hidden className="size-4" /> Previous
            </span>
          )}
          <span className="tabular hidden text-sm text-fg-muted sm:inline">
            Page {page} of {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={hrefFor(page + 1) as Route} className={linkClass} scroll>
              Next <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span className={disabledClass} aria-disabled>
              Next <ChevronRight aria-hidden className="size-4" />
            </span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
