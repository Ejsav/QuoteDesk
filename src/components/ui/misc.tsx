import type * as React from "react";
import { initials } from "@/domain/contact";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div aria-hidden className={cn("animate-shimmer rounded-md bg-surface-active", className)} {...props} />;
}

export function Kbd({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-sunken px-1 font-sans text-2xs font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-accent-line/60 bg-accent-soft font-semibold tracking-[0.02em] text-accent-strong",
        size === "sm" && "size-6 text-2xs",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-10 text-sm",
        size === "xl" && "size-14 text-lg",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full bg-border-subtle", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-xl border border-border bg-surface-sunken text-fg-muted [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <p className="text-md font-semibold text-fg">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-balance text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Small uppercase section label. */
export function Overline({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-2xs font-semibold tracking-[0.08em] text-fg-muted uppercase", className)}>{children}</p>;
}
