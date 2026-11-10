"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Single-choice segmented control (radio semantics via Radix ToggleGroup). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
  size = "md",
  id,
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
  id?: string;
}) {
  return (
    <ToggleGroup.Root
      id={id}
      type="single"
      value={value ?? ""}
      onValueChange={(v) => {
        if (v) onChange(v as T);
      }}
      aria-label={ariaLabel}
      className={cn("inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-border bg-surface-sunken p-0.5", className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "rounded-md px-2.5 font-medium whitespace-nowrap text-fg-muted transition-colors duration-150",
            "hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
            "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-xs data-[disabled]:opacity-40",
            size === "sm" ? "h-6 text-xs" : "h-7 text-sm",
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
