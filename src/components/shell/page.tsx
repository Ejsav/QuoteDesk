import { ChevronRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type * as React from "react";
import { cn } from "@/lib/utils";

export function PageContainer({ className, children, width = "default" }: { className?: string; children: React.ReactNode; width?: "default" | "narrow" }) {
  return (
    <div className={cn("mx-auto w-full px-4 pt-5 pb-10 sm:px-6 sm:pt-7 lg:px-8", width === "narrow" ? "max-w-[1080px]" : "max-w-[1440px]", className)}>
      {children}
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: Route;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex min-w-0 items-center gap-1 text-sm text-fg-muted">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight aria-hidden className="size-3.5 shrink-0 text-fg-faint" /> : null}
            {item.href ? (
              <Link href={item.href} className="truncate rounded-sm transition-colors hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-fg-secondary">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  breadcrumbs?: Crumb[];
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-[-0.025em] text-balance text-fg">{title}</h1>
        {description ? <div className="mt-1 text-sm text-fg-muted">{description}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
