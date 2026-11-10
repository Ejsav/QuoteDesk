import { CircleAlert } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  className?: string;
  /** Rendered beside the label, e.g. a toggle link. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Label + control + hint/error. Errors are announced and linked to the
 * control via ids `${htmlFor}-error` / `${htmlFor}-hint`.
 */
export function Field({ label, htmlFor, required, optional, hint, error, className, aside, children }: FieldProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
          {label}
          {required ? (
            <span className="ml-0.5 text-danger" aria-hidden>
              *
            </span>
          ) : null}
          {optional ? <span className="ml-1.5 text-xs font-normal text-fg-faint">Optional</span> : null}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="flex items-start gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs leading-4 text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** aria props wiring a control to its Field's hint/error. */
export function fieldAria(id: string, error?: string, hasHint?: boolean) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
  } as const;
}
