import type * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"section">) {
  return <section className={cn("rounded-xl border border-border bg-surface shadow-xs", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
  titleAs: Title = "h2",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  titleAs?: "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-4 pb-3 sm:px-5", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-fg-muted [&_svg]:size-4">{icon}</span> : null}
        <div className="min-w-0">
          <Title className="text-md leading-6 font-semibold tracking-[-0.01em] text-fg">{title}</Title>
          {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-4 pb-4 sm:px-5 sm:pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3 sm:px-5", className)} {...props} />;
}

/** Definition-list row used in detail cards. */
export function DetailRow({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-baseline gap-3 py-2", className)}>
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 text-sm text-fg">{children}</dd>
    </div>
  );
}

export function Unknown({ children = "Not provided" }: { children?: React.ReactNode }) {
  return <span className="text-fg-faint italic">{children}</span>;
}
