import type * as React from "react";
import { cn } from "@/lib/utils";

export const fieldControl = [
  "w-full rounded-md border border-border bg-surface text-fg shadow-xs",
  "placeholder:text-fg-faint",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-border-strong",
  "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20",
].join(" ");

export interface InputProps extends React.ComponentProps<"input"> {
  /** Small adornment rendered inside the left edge, e.g. "$". */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function Input({ className, leading, trailing, type = "text", ...props }: InputProps) {
  if (leading || trailing) {
    return (
      <div className="relative flex items-center">
        {leading ? (
          <span className="pointer-events-none absolute left-2.5 flex items-center text-sm text-fg-muted [&_svg]:size-4">{leading}</span>
        ) : null}
        <input
          type={type}
          className={cn(fieldControl, "h-9 px-3 text-base sm:h-8 sm:text-sm", leading && "pl-8", trailing && "pr-9", className)}
          {...props}
        />
        {trailing ? <span className="absolute right-2 flex items-center text-fg-muted">{trailing}</span> : null}
      </div>
    );
  }
  return <input type={type} className={cn(fieldControl, "h-9 px-3 text-base sm:h-8 sm:text-sm", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldControl, "min-h-20 resize-y px-3 py-2 text-base leading-6 sm:text-sm sm:leading-5", className)}
      {...props}
    />
  );
}
