"use client";

import { ArrowDownUp, ChevronDown, MapPin, Search, ShieldCheck, Users, X } from "lucide-react";
import { useEffect, useState } from "react";
import { OPERATOR_STATUSES, OPERATOR_STATUS_META, type OperatorStatus } from "@/domain/operator";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META, type VehicleCategory } from "@/domain/vehicle";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useListNavigation } from "./list-navigation";
import {
  CAPACITY_PRESETS,
  OPERATOR_SORT_LABELS,
  OPERATOR_SORT_OPTIONS,
  VERIFICATION_FILTER_LABELS,
  VERIFICATION_FILTER_OPTIONS,
  activeOperatorFilterCount,
  operatorsHref,
  type OperatorQuery,
} from "./operator-query";

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterButton({
  label,
  active,
  count,
  icon,
  ...props
}: React.ComponentProps<"button"> & { label: string; active: boolean; count?: number; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-sm font-medium whitespace-nowrap shadow-xs transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-accent-line bg-accent-soft text-fg"
          : "border-border bg-surface text-fg-secondary hover:border-border-strong hover:text-fg",
        "[&_svg]:size-3.5 [&_svg]:shrink-0",
      )}
      {...props}
    >
      {icon}
      {label}
      {count ? <span className="tabular rounded-full bg-surface px-1.5 text-2xs font-semibold text-fg-secondary">{count}</span> : null}
      <ChevronDown aria-hidden className="text-fg-muted" />
    </button>
  );
}

function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface pr-1 pl-2.5 text-xs text-fg-secondary shadow-xs">
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="flex size-5 items-center justify-center rounded-full text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

export function OperatorFilters({
  query,
  areas,
  total,
}: {
  query: OperatorQuery;
  areas: Array<{ area: string; count: number }>;
  total: number;
}) {
  const { navigate } = useListNavigation();

  // Search text is local while typing and pushed to the URL after a pause.
  // Incoming URL changes override it — unless they are the echo of our own push.
  const [q, setQ] = useState(query.q);
  const [syncedQ, setSyncedQ] = useState(query.q);
  const [pushedQ, setPushedQ] = useState<string | null>(null);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    if (query.q !== pushedQ) setQ(query.q);
  }

  useEffect(() => {
    const next = q.trim();
    if (next === query.q.trim()) return;
    const timer = setTimeout(() => {
      setPushedQ(next);
      navigate(operatorsHref({ ...query, q: next, page: 1 }));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, query, navigate]);

  const update = (patch: Partial<OperatorQuery>) => navigate(operatorsHref({ ...query, q: q.trim(), ...patch, page: 1 }));

  const capacityOptions = [...CAPACITY_PRESETS] as number[];
  if (query.minCapacity && !capacityOptions.includes(query.minCapacity)) {
    capacityOptions.push(query.minCapacity);
    capacityOptions.sort((a, b) => a - b);
  }
  const areaOptions = [...areas];
  if (query.area && !areaOptions.some((a) => a.area.toLowerCase() === query.area.toLowerCase())) {
    areaOptions.unshift({ area: query.area, count: 0 });
  }
  const filterCount = activeOperatorFilterCount(query);
  const keepOpen = (event: Event) => event.preventDefault();

  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
        <div className="w-full md:w-72">
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, contact, area…"
            aria-label="Search operators"
            leading={<Search />}
          />
        </div>

        <div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 pb-0.5 scrollbar-none md:mx-0 md:overflow-visible md:px-0 md:pb-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterButton label="Status" active={query.status.length > 0} count={query.status.length} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Relationship status</DropdownMenuLabel>
              {OPERATOR_STATUSES.map((s) => (
                <DropdownMenuCheckboxItem
                  key={s}
                  checked={query.status.includes(s)}
                  onSelect={keepOpen}
                  onCheckedChange={() => update({ status: toggle<OperatorStatus>(query.status, s) })}
                >
                  <Dot tone={OPERATOR_STATUS_META[s].tone} />
                  {OPERATOR_STATUS_META[s].label}
                </DropdownMenuCheckboxItem>
              ))}
              {query.status.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => update({ status: [] })}>Clear status</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterButton label="Vehicle" active={query.category.length > 0} count={query.category.length} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>Has a vehicle of type</DropdownMenuLabel>
              {VEHICLE_CATEGORIES.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c}
                  checked={query.category.includes(c)}
                  onSelect={keepOpen}
                  onCheckedChange={() => update({ category: toggle<VehicleCategory>(query.category, c) })}
                >
                  {VEHICLE_CATEGORY_META[c].label}
                </DropdownMenuCheckboxItem>
              ))}
              {query.category.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => update({ category: [] })}>Clear vehicle types</DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterButton
                label={query.minCapacity ? `${query.minCapacity}+ seats` : "Capacity"}
                active={!!query.minCapacity}
                icon={<Users aria-hidden />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60">
              <DropdownMenuLabel>{query.category.length ? "Matching vehicle seats at least" : "Any vehicle seats at least"}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={query.minCapacity ? String(query.minCapacity) : "any"}
                onValueChange={(v) => update({ minCapacity: v === "any" ? null : Number(v) })}
              >
                <DropdownMenuRadioItem value="any">Any size</DropdownMenuRadioItem>
                {capacityOptions.map((n) => (
                  <DropdownMenuRadioItem key={n} value={String(n)}>
                    {n}+ passengers
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <p className="px-2 pt-1 pb-1.5 text-xs leading-4 text-fg-muted">Based on operator-reported capacity.</p>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterButton label={query.area || "Service area"} active={!!query.area} icon={<MapPin aria-hidden />} />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Serves</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={query.area || "any"} onValueChange={(v) => update({ area: v === "any" ? "" : v })}>
                <DropdownMenuRadioItem value="any">Any area</DropdownMenuRadioItem>
                {areaOptions.map((a) => (
                  <DropdownMenuRadioItem key={a.area} value={a.area}>
                    <span className="min-w-0 flex-1 truncate">{a.area}</span>
                    {a.count > 0 ? <span className="tabular text-xs text-fg-muted">{a.count}</span> : null}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterButton
                label={query.verification ? VERIFICATION_FILTER_LABELS[query.verification] : "Verification"}
                active={!!query.verification}
                icon={<ShieldCheck aria-hidden />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64">
              <DropdownMenuLabel>Verification records</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={query.verification ?? "any"} onValueChange={(v) => update({ verification: v === "any" ? null : (v as OperatorQuery["verification"]) })}>
                <DropdownMenuRadioItem value="any">Any</DropdownMenuRadioItem>
                {VERIFICATION_FILTER_OPTIONS.map((v) => (
                  <DropdownMenuRadioItem key={v} value={v}>
                    {VERIFICATION_FILTER_LABELS[v]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <p className="px-2 pt-1 pb-1.5 text-xs leading-4 text-fg-muted">Recorded manually by your team.</p>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto pl-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-fg-secondary">
                  <ArrowDownUp aria-hidden />
                  <span className="hidden sm:inline">Sort:</span> {OPERATOR_SORT_LABELS[query.sort]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={query.sort} onValueChange={(v) => update({ sort: v as OperatorQuery["sort"] })}>
                  {OPERATOR_SORT_OPTIONS.map((s) => (
                    <DropdownMenuRadioItem key={s} value={s}>
                      {OPERATOR_SORT_LABELS[s]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {filterCount > 0 || query.q ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-sm text-fg-muted">
            {total} {total === 1 ? "match" : "matches"}
          </span>
          {query.q ? (
            <Chip label={`Search “${query.q}”`} onRemove={() => update({ q: "" })}>
              Search: “{query.q}”
            </Chip>
          ) : null}
          {query.status.map((s) => (
            <Chip key={s} label={OPERATOR_STATUS_META[s].label} onRemove={() => update({ status: query.status.filter((x) => x !== s) })}>
              {OPERATOR_STATUS_META[s].label}
            </Chip>
          ))}
          {query.category.map((c) => (
            <Chip key={c} label={VEHICLE_CATEGORY_META[c].label} onRemove={() => update({ category: query.category.filter((x) => x !== c) })}>
              {VEHICLE_CATEGORY_META[c].label}
            </Chip>
          ))}
          {query.minCapacity ? (
            <Chip label={`${query.minCapacity}+ seats`} onRemove={() => update({ minCapacity: null })}>
              {query.minCapacity}+ seats
            </Chip>
          ) : null}
          {query.area ? (
            <Chip label={`Serves ${query.area}`} onRemove={() => update({ area: "" })}>
              Serves {query.area}
            </Chip>
          ) : null}
          {query.verification ? (
            <Chip label={VERIFICATION_FILTER_LABELS[query.verification]} onRemove={() => update({ verification: null })}>
              {VERIFICATION_FILTER_LABELS[query.verification]}
            </Chip>
          ) : null}
          <Button
            variant="link"
            size="sm"
            className="ml-1 text-fg-muted"
            onClick={() => {
              setQ("");
              navigate(operatorsHref({ sort: query.sort }));
            }}
          >
            Clear all
          </Button>
        </div>
      ) : null}
    </div>
  );
}
