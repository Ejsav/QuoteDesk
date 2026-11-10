import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { fieldControl } from "./input";

/**
 * Native select, styled. Chosen deliberately: it is fully accessible, works
 * with every keyboard/screen reader and gives phones their native picker.
 */
export function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(fieldControl, "h-9 appearance-none pr-8 pl-3 text-base sm:h-8 sm:text-sm", className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted" />
    </div>
  );
}
