import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium select-none",
    "transition-[background-color,border-color,color,box-shadow,opacity] duration-150 ease-out",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-fg-on-primary shadow-xs hover:bg-primary-hover active:bg-primary-active",
        secondary:
          "border border-border bg-surface text-fg shadow-xs hover:border-border-strong hover:bg-surface-hover active:bg-surface-active",
        ghost: "text-fg-secondary hover:bg-surface-hover hover:text-fg active:bg-surface-active",
        subtle: "bg-surface-hover text-fg hover:bg-surface-active",
        danger: "bg-danger text-white shadow-xs hover:bg-danger-hover",
        "danger-ghost": "text-danger hover:bg-danger-soft",
        link: "h-auto px-0 text-fg underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-6 rounded-sm px-2 text-xs [&_svg]:size-3.5",
        sm: "h-7 rounded-md px-2.5 text-sm [&_svg]:size-3.5",
        md: "h-8 rounded-md px-3 text-sm [&_svg]:size-4",
        lg: "h-10 rounded-lg px-4 text-base [&_svg]:size-4",
        "icon-xs": "size-6 rounded-sm [&_svg]:size-3.5",
        "icon-sm": "size-7 rounded-md [&_svg]:size-4",
        icon: "size-8 rounded-md [&_svg]:size-4",
        "icon-lg": "size-10 rounded-lg [&_svg]:size-5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner className="absolute" /> : null}
          <span className={cn("inline-flex items-center gap-1.5", loading && "invisible")}>{children}</span>
        </>
      )}
    </Comp>
  );
}
