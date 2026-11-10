"use client";

import { Command } from "cmdk";
import { ChevronsUpDown, Search, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { formatPhone } from "@/domain/contact";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export interface CustomerSummary {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  leadCount: number;
}

function useCustomerSearch(query: string, enabled: boolean) {
  const [results, setResults] = useState<{ query: string; rows: CustomerSummary[] } | null>(null);
  const trimmed = query.trim();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        setResults({ query: trimmed, rows: (await res.json()) as CustomerSummary[] });
      } catch {
        if (!controller.signal.aborted) setResults({ query: trimmed, rows: [] });
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, enabled]);
  const current = results && results.query === trimmed ? results.rows : null;
  return { rows: current ?? [], loading: enabled && current === null };
}

export function CustomerSummaryCard({ customer, action }: { customer: CustomerSummary; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-xs">
      <Avatar name={customer.fullName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">
          {customer.fullName}
          {customer.companyName ? <span className="font-normal text-fg-muted"> · {customer.companyName}</span> : null}
        </p>
        <p className="truncate text-xs text-fg-muted">
          {[formatPhone(customer.phone), customer.email].filter(Boolean).join(" · ") || "No contact details"} ·{" "}
          {customer.leadCount === 0 ? "no inquiries yet" : `${customer.leadCount} ${customer.leadCount === 1 ? "inquiry" : "inquiries"}`}
        </p>
      </div>
      {action}
    </div>
  );
}

export function CustomerPicker({
  value,
  onSelect,
  onCreateNew,
  invalid,
  id,
}: {
  value: CustomerSummary | null;
  onSelect: (customer: CustomerSummary) => void;
  onCreateNew?: (prefillName: string) => void;
  invalid?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { rows, loading } = useCustomerSearch(query, open);

  const trigger = value ? (
    <CustomerSummaryCard
      customer={value}
      action={
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" type="button" id={id}>
            Change
          </Button>
        </PopoverTrigger>
      }
    />
  ) : (
    <PopoverTrigger asChild>
      <button
        type="button"
        id={id}
        aria-describedby={invalid && id ? `${id}-error` : undefined}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-border bg-surface px-3 text-left text-sm text-fg-faint shadow-xs transition-colors hover:border-border-strong",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none",
          invalid && "border-danger",
        )}
      >
        <Search aria-hidden className="size-4 text-fg-muted" />
        <span className="flex-1 truncate">Search existing customers by name, phone or email…</span>
        <ChevronsUpDown aria-hidden className="size-4 text-fg-muted" />
      </button>
    </PopoverTrigger>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      {trigger}
      <PopoverContent align="start" className="w-[min(480px,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false} label="Find a customer">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3">
            <Search aria-hidden className="size-4 text-fg-muted" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              autoFocus
              placeholder="Name, phone, email or company"
              className="h-11 flex-1 bg-transparent text-base outline-none placeholder:text-fg-faint sm:text-sm"
            />
            {loading ? <Spinner className="text-fg-muted" /> : null}
          </div>
          <Command.List className="max-h-72 overflow-y-auto p-1">
            {!loading && rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-muted">{query.trim() ? `No customers match “${query.trim()}”.` : "No customers yet."}</p>
            ) : null}
            {rows.length > 0 ? (
              <Command.Group heading={query.trim() ? "Matches" : "Recently updated"} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-fg-muted [&_[cmdk-group-heading]]:uppercase">
                {rows.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onSelect(c);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-surface-hover"
                  >
                    <Avatar name={c.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{c.fullName}</span>
                      <span className="block truncate text-xs text-fg-muted">
                        {[c.companyName, formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-fg-muted" title="Inquiries">{c.leadCount} {c.leadCount === 1 ? "inquiry" : "inquiries"}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {onCreateNew ? (
              <Command.Item
                value="__create__"
                onSelect={() => {
                  const name = query.trim();
                  setOpen(false);
                  setQuery("");
                  onCreateNew(name);
                }}
                className="mt-1 flex cursor-default items-center gap-2.5 rounded-md border-t border-border-subtle px-2 py-2.5 text-sm font-medium text-fg outline-none data-[selected=true]:bg-surface-hover"
              >
                <UserPlus aria-hidden className="size-4 text-fg-muted" />
                Create a new customer{query.trim() ? ` named “${query.trim()}”` : ""}
              </Command.Item>
            ) : null}
          </Command.List>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
