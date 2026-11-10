"use client";

import { ArrowUpDown, Search, X } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { CustomerFilter, CustomerSort } from "@/server/services/customers";
import {
  CUSTOMER_FILTER_LABELS,
  CUSTOMER_FILTER_OPTIONS,
  CUSTOMER_SORT_LABELS,
  CUSTOMER_SORT_OPTIONS,
  customersHref,
  type CustomerQuery,
} from "./customer-query";

/**
 * Search, filter and sort live in the URL. Navigation uses `replace` so
 * typing doesn't flood history; nothing here ever writes to a record.
 */
export function CustomerFilters({ query }: { query: CustomerQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(query.q);
  // The URL value we last reconciled with, and the last value we pushed
  // ourselves — so our own debounced navigation never clobbers fresh typing.
  const [syncedQ, setSyncedQ] = useState(query.q);
  const [pushedQ, setPushedQ] = useState<string | null>(null);

  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    if (query.q !== pushedQ) setText(query.q);
  }

  function navigate(next: Partial<CustomerQuery>) {
    startTransition(() => {
      router.replace(customersHref({ ...query, page: 1, ...next }) as Route, { scroll: false });
    });
  }

  useEffect(() => {
    const value = text.trim();
    if (value === query.q.trim()) return;
    const timer = setTimeout(() => {
      setPushedQ(value);
      startTransition(() => {
        router.replace(customersHref({ ...query, q: value, page: 1 }) as Route, { scroll: false });
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [text, query, router]);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="relative w-full lg:max-w-sm">
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && text) {
              e.preventDefault();
              setText("");
            }
          }}
          placeholder="Search name, company, phone or email"
          aria-label="Search customers"
          leading={<Search />}
          trailing={
            isPending ? (
              <Spinner className="size-3.5 text-fg-muted" label="Updating results" />
            ) : text ? (
              <button
                type="button"
                onClick={() => setText("")}
                aria-label="Clear search"
                className="flex size-6 items-center justify-center rounded-md text-fg-muted hover:bg-surface-hover hover:text-fg"
              >
                <X className="size-3.5" />
              </button>
            ) : null
          }
          className="[&::-webkit-search-cancel-button]:hidden"
        />
      </div>

      <div className="flex min-w-0 items-center gap-2">
        {/* Phones get the native picker; the segmented control needs ~420px. */}
        <div className="min-w-0 flex-1 sm:hidden">
          <Select aria-label="Show customers" value={query.filter} onChange={(e) => navigate({ filter: e.target.value as CustomerFilter })}>
            {CUSTOMER_FILTER_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {CUSTOMER_FILTER_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="hidden sm:block">
          <Segmented<CustomerFilter>
            ariaLabel="Show customers"
            value={query.filter}
            onChange={(filter) => navigate({ filter })}
            options={CUSTOMER_FILTER_OPTIONS.map((value) => ({ value, label: CUSTOMER_FILTER_LABELS[value] }))}
            className="flex-nowrap"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" className="shrink-0 sm:ml-auto lg:ml-0" aria-label={`Sort: ${CUSTOMER_SORT_LABELS[query.sort]}`}>
              <ArrowUpDown />
              <span className="hidden sm:inline">{CUSTOMER_SORT_LABELS[query.sort]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={query.sort} onValueChange={(sort) => navigate({ sort: sort as CustomerSort })}>
              {CUSTOMER_SORT_OPTIONS.map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {CUSTOMER_SORT_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
