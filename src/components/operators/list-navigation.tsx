"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";
import { cn } from "@/lib/utils";

interface ListNavigation {
  isPending: boolean;
  navigate: (href: string) => void;
}

const ListNavigationContext = createContext<ListNavigation>({ isPending: false, navigate: () => {} });

/**
 * Wraps a URL-driven list: filter changes navigate inside a transition, and
 * the results keep their previous render (dimmed) until the new page arrives —
 * no skeleton flash, no layout jump.
 */
export function ListNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.replace(href as Route, { scroll: false });
      });
    },
    [router],
  );
  const value = useMemo(() => ({ isPending, navigate }), [isPending, navigate]);
  return <ListNavigationContext.Provider value={value}>{children}</ListNavigationContext.Provider>;
}

export function useListNavigation() {
  return useContext(ListNavigationContext);
}

export function PendingFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const { isPending } = useListNavigation();
  return (
    <div aria-busy={isPending || undefined} className={cn("transition-opacity duration-200", isPending && "pointer-events-none opacity-55", className)}>
      {children}
    </div>
  );
}
