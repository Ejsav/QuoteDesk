import type * as React from "react";
import type { Tone } from "@/domain/tone";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<Tone, string> = {
  blue: "tone-blue",
  violet: "tone-violet",
  magenta: "tone-magenta",
  green: "tone-green",
  amber: "tone-amber",
  red: "tone-red",
  orange: "tone-orange",
  gray: "tone-gray",
  champagne: "tone-champagne",
  teal: "tone-teal",
};

export function toneClass(tone: Tone): string {
  return TONE_CLASS[tone];
}

export interface BadgeProps extends React.ComponentProps<"span"> {
  tone?: Tone;
  dot?: boolean;
  size?: "sm" | "md";
  variant?: "soft" | "outline";
}

export function Badge({ tone = "gray", dot, size = "md", variant = "soft", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        TONE_CLASS[tone],
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full font-medium whitespace-nowrap text-[var(--tone-fg)]",
        variant === "soft" ? "bg-[var(--tone-bg)]" : "border border-border bg-surface",
        size === "sm" ? "h-5 px-1.5 text-2xs" : "h-6 px-2 text-xs",
        className,
      )}
      {...props}
    >
      {dot ? <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-[var(--tone-dot)]" /> : null}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Dot({ tone = "gray", className }: { tone?: Tone; className?: string }) {
  return <span aria-hidden className={cn(TONE_CLASS[tone], "inline-block size-2 shrink-0 rounded-full bg-[var(--tone-dot)]", className)} />;
}
