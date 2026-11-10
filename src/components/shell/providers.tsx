"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/menu";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      offset={20}
      mobileOffset={{ bottom: 84 }}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-surface-raised !text-fg !shadow-lg !font-sans !text-sm !gap-2.5 !py-3 !px-3.5",
          description: "!text-fg-muted !text-sm",
          actionButton: "!bg-primary !text-fg-on-primary !rounded-md !font-medium",
          cancelButton: "!bg-surface-hover !text-fg !rounded-md",
          success: "[&_[data-icon]]:!text-[var(--green-dot)]",
          error: "[&_[data-icon]]:!text-danger",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={350} skipDelayDuration={150}>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
