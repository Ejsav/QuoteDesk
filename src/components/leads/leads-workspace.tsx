"use client";

import { ArrowUpDown, Check, ListFilter, Search, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from "react";
import {
  LEAD_PRIORITIES,
  LEAD_PRIORITY_META,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  LEAD_STATUSES,
  LEAD_STATUS_META,
  OCCASIONS,
  OCCASION_LABELS,
} from "@/domain/lead";
import {
  FOLLOW_UP_FILTERS,
  FOLLOW_UP_FILTER_LABELS,
  LEAD_SORTS,
  LEAD_SORT_LABELS,
  LEAD_VIEW_META,
  RECEIVED_WINDOWS,
  RECEIVED_WINDOW_LABELS,
  TRIP_WINDOWS,
  TRIP_WINDOW_LABELS,
  activeFilterCount,
  effectiveSort,
  leadsHref,
  type LeadQuery,
  type LeadView,
} from "@/domain/lead-query";
import { VEHICLE_PREFERENCES, vehiclePreferenceLabel } from "@/domain/vehicle";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/menu";
import type { Tone } from "@/domain/tone";
import { cn } from "@/lib/utils";

type Counts = Record<LeadView, number>;

const ListContext = createContext<{ pending: boolean }>({ pending: false });

const VIEW_ORDER: LeadView[] = ["open", "attention", "new", "follow_up", "upcoming", "qualified", "on_hold", "lost", "all"];

/**
 * Client frame for the leads list: owns navigation (URL is the state) and
 * keeps the previous results visible, dimmed, while the next page renders.
 */
export function LeadsWorkspace({ query, counts, children }: { query: LeadQuery; counts: Counts; children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const navigate = useCallback(
    (next: LeadQuery) => startTransition(() => router.replace(leadsHref(next) as Route, { scroll: false })),
    [router],
  );

  return (
    <ListContext.Provider value={{ pending }}>
      <ViewTabs query={query} counts={counts} />
      <Toolbar query={query} navigate={navigate} pending={pending} />
      <div aria-busy={pending} className={cn("transition-opacity duration-200", pending && "pointer-events-none opacity-55")}>
        {children}
      </div>
    </ListContext.Provider>
  );
}

export function useLeadsListPending() {
  return useContext(ListContext).pending;
}

function ViewTabs({ query, counts }: { query: LeadQuery; counts: Counts }) {
  return (
    <div className="-mx-4 mb-4 overflow-x-auto border-b border-border px-4 scrollbar-none sm:mx-0 sm:px-0">
      <nav aria-label="Lead views" className="flex min-w-max gap-1">
        {VIEW_ORDER.map((view) => {
          const active = query.view === view;
          return (
            <Link
              key={view}
              href={leadsHref({ view, q: query.q }) as Route}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cn(
                "relative flex h-10 items-center gap-2 rounded-t-md px-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {LEAD_VIEW_META[view].label}
              <span
                className={cn(
                  "tabular rounded-full px-1.5 py-px text-2xs font-semibold",
                  active ? "bg-accent-soft text-accent-strong" : "bg-surface-hover text-fg-muted",
                )}
              >
                {counts[view]}
              </span>
              {active ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function Toolbar({ query, navigate, pending }: { query: LeadQuery; navigate: (q: LeadQuery) => void; pending: boolean }) {
  const [search, setSearch] = useState(query.q);
  const [syncedQ, setSyncedQ] = useState(query.q);
  if (query.q !== syncedQ) {
    // URL changed elsewhere (tab switch, "Clear all"): adopt it.
    setSyncedQ(query.q);
    setSearch(query.q);
  }

  // Debounced search; `lastSent` stops repeat navigations while one is in flight.
  const lastSent = useRef(query.q.trim());
  useEffect(() => {
    lastSent.current = query.q.trim();
  }, [query.q]);
  useEffect(() => {
    const next = search.trim();
    if (next === query.q.trim() || next === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = next;
      navigate({ ...query, q: next, page: 1 });
    }, 280);
    return () => clearTimeout(timer);
  }, [search, query, navigate]);

  const filterCount = activeFilterCount(query);
  const sort = effectiveSort(query);
  const sorts = LEAD_SORTS.filter((s) => s !== "attention" || query.view === "attention");

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, L-1042, location…"
            aria-label="Search leads"
            leading={<Search />}
            trailing={
              search ? (
                <button type="button" onClick={() => setSearch("")} className="rounded p-0.5 text-fg-muted hover:text-fg" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              ) : null
            }
          />
        </div>

        {/* Desktop: popover; phones: bottom sheet. Same panel. */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary" className="hidden sm:inline-flex">
              <ListFilter /> Filters
              {filterCount > 0 ? <CountPill count={filterCount} /> : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-[70dvh] w-[min(640px,calc(100vw-2rem))] overflow-y-auto p-4">
            <FilterPanel query={query} navigate={navigate} />
          </PopoverContent>
        </Popover>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" className="sm:hidden" aria-label="Filters">
              <ListFilter /> {filterCount > 0 ? <CountPill count={filterCount} /> : "Filters"}
            </Button>
          </DialogTrigger>
          <DialogContent title="Filter leads" description="Results update as you choose.">
            <DialogBody>
              <FilterPanel query={query} navigate={navigate} />
            </DialogBody>
            <DialogFooter>
              <DialogTriggerClose />
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary">
              <ArrowUpDown /> <span className="hidden md:inline">{LEAD_SORT_LABELS[sort]}</span>
              <span className="md:hidden">Sort</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sort} onValueChange={(v) => navigate({ ...query, sort: v as LeadQuery["sort"], page: 1 })}>
              {sorts.map((s) => (
                <DropdownMenuRadioItem key={s} value={s}>
                  {LEAD_SORT_LABELS[s]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {pending ? <span className="text-xs text-fg-muted">Updating…</span> : null}
      </div>

      <ActiveFilters query={query} navigate={navigate} />
    </div>
  );
}

function DialogTriggerClose() {
  return (
    <DialogClose asChild>
      <Button variant="primary" className="w-full sm:w-auto">
        Show results
      </Button>
    </DialogClose>
  );
}

function CountPill({ count }: { count: number }) {
  return <span className="tabular rounded-full bg-primary px-1.5 text-2xs leading-4 font-semibold text-fg-on-primary">{count}</span>;
}

type MultiKey = "status" | "priority" | "source" | "occasion" | "vehicle";

function Chip({
  pressed,
  onClick,
  children,
  tone,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        pressed ? "border-primary bg-primary text-fg-on-primary" : "border-border bg-surface text-fg-secondary hover:border-border-strong hover:text-fg",
      )}
    >
      {tone ? <Dot tone={tone} className="size-1.5" /> : null}
      {children}
      {pressed ? <Check aria-hidden className="size-3" /> : null}
    </button>
  );
}

function FacetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-2xs font-semibold tracking-[0.08em] text-fg-muted uppercase">{title}</legend>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function FilterPanel({ query, navigate }: { query: LeadQuery; navigate: (q: LeadQuery) => void }) {
  function toggle<K extends MultiKey>(key: K, value: LeadQuery[K][number]) {
    const list = query[key] as string[];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    navigate({ ...query, [key]: next, page: 1 });
  }
  function single<K extends "trip" | "received" | "followUp">(key: K, value: NonNullable<LeadQuery[K]>) {
    navigate({ ...query, [key]: query[key] === value ? null : value, page: 1 });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FacetSection title="Status">
          {LEAD_STATUSES.map((s) => (
            <Chip key={s} pressed={query.status.includes(s)} onClick={() => toggle("status", s)} tone={LEAD_STATUS_META[s].tone}>
              {LEAD_STATUS_META[s].label}
            </Chip>
          ))}
        </FacetSection>
        <FacetSection title="Priority">
          {LEAD_PRIORITIES.map((p) => (
            <Chip key={p} pressed={query.priority.includes(p)} onClick={() => toggle("priority", p)}>
              {LEAD_PRIORITY_META[p].label}
            </Chip>
          ))}
        </FacetSection>
        <FacetSection title="Trip date">
          {TRIP_WINDOWS.map((t) => (
            <Chip key={t} pressed={query.trip === t} onClick={() => single("trip", t)}>
              {TRIP_WINDOW_LABELS[t]}
            </Chip>
          ))}
        </FacetSection>
        <FacetSection title="Follow-up">
          {FOLLOW_UP_FILTERS.map((f) => (
            <Chip key={f} pressed={query.followUp === f} onClick={() => single("followUp", f)}>
              {FOLLOW_UP_FILTER_LABELS[f]}
            </Chip>
          ))}
        </FacetSection>
        <FacetSection title="Received">
          {RECEIVED_WINDOWS.map((r) => (
            <Chip key={r} pressed={query.received === r} onClick={() => single("received", r)}>
              {RECEIVED_WINDOW_LABELS[r]}
            </Chip>
          ))}
        </FacetSection>
        <FacetSection title="Source">
          {LEAD_SOURCES.map((s) => (
            <Chip key={s} pressed={query.source.includes(s)} onClick={() => toggle("source", s)}>
              {LEAD_SOURCE_LABELS[s]}
            </Chip>
          ))}
        </FacetSection>
      </div>
      <FacetSection title="Occasion">
        {OCCASIONS.map((o) => (
          <Chip key={o} pressed={query.occasion.includes(o)} onClick={() => toggle("occasion", o)}>
            {OCCASION_LABELS[o]}
          </Chip>
        ))}
      </FacetSection>
      <FacetSection title="Vehicle preference">
        {VEHICLE_PREFERENCES.map((v) => (
          <Chip key={v} pressed={query.vehicle.includes(v)} onClick={() => toggle("vehicle", v)}>
            {vehiclePreferenceLabel(v)}
          </Chip>
        ))}
      </FacetSection>
    </div>
  );
}

function ActiveFilters({ query, navigate }: { query: LeadQuery; navigate: (q: LeadQuery) => void }) {
  const chips: Array<{ key: string; label: string; remove: () => void }> = [];
  const without = <K extends MultiKey>(key: K, value: string) => navigate({ ...query, [key]: (query[key] as string[]).filter((v) => v !== value), page: 1 });
  for (const s of query.status) chips.push({ key: `status-${s}`, label: `Status: ${LEAD_STATUS_META[s].label}`, remove: () => without("status", s) });
  for (const p of query.priority) chips.push({ key: `priority-${p}`, label: `Priority: ${LEAD_PRIORITY_META[p].label}`, remove: () => without("priority", p) });
  for (const s of query.source) chips.push({ key: `source-${s}`, label: LEAD_SOURCE_LABELS[s], remove: () => without("source", s) });
  for (const o of query.occasion) chips.push({ key: `occasion-${o}`, label: OCCASION_LABELS[o], remove: () => without("occasion", o) });
  for (const v of query.vehicle) chips.push({ key: `vehicle-${v}`, label: vehiclePreferenceLabel(v), remove: () => without("vehicle", v) });
  if (query.trip) chips.push({ key: "trip", label: `Trip: ${TRIP_WINDOW_LABELS[query.trip]}`, remove: () => navigate({ ...query, trip: null, page: 1 }) });
  if (query.received)
    chips.push({ key: "received", label: `Received: ${RECEIVED_WINDOW_LABELS[query.received]}`, remove: () => navigate({ ...query, received: null, page: 1 }) });
  if (query.followUp)
    chips.push({ key: "followUp", label: `Follow-up: ${FOLLOW_UP_FILTER_LABELS[query.followUp]}`, remove: () => navigate({ ...query, followUp: null, page: 1 }) });
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface pr-1 pl-2.5 text-xs font-medium text-fg-secondary">
          {chip.label}
          <button type="button" onClick={chip.remove} className="rounded-full p-0.5 text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label={`Remove filter ${chip.label}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => navigate({ ...query, status: [], priority: [], source: [], occasion: [], vehicle: [], trip: null, received: null, followUp: null, page: 1 })}
        className="ml-1 text-xs font-medium text-fg-muted underline-offset-2 hover:text-fg hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}
