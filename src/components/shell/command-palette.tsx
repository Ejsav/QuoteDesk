"use client";

import { Command } from "cmdk";
import {
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CircleDot,
  CornerDownLeft,
  History,
  Inbox,
  LayoutDashboard,
  Monitor,
  Moon,
  Plus,
  Search,
  Sun,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { formatPhone } from "@/domain/contact";
import { formatPlainDate } from "@/domain/dates";
import { LEAD_STATUS_META, formatLeadNumber } from "@/domain/lead";
import { leadsHref } from "@/domain/lead-query";
import { OPERATOR_STATUS_META } from "@/domain/operator";
import type { SearchResults } from "@/server/services/search";
import { Dot } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useRecentItems, type RecentItem } from "./recent";

interface PaletteCommand {
  id: string;
  label: string;
  group: "Actions" | "Go to" | "Lead views" | "Theme";
  icon: LucideIcon;
  keywords?: string;
  run: (ctx: { go: (href: Route) => void; setTheme: (t: string) => void }) => void;
}

const COMMANDS: PaletteCommand[] = [
  { id: "new-lead", label: "New inquiry", group: "Actions", icon: Plus, keywords: "create lead request trip", run: ({ go }) => go("/leads/new") },
  { id: "new-customer", label: "New customer", group: "Actions", icon: UserPlus, keywords: "create client contact", run: ({ go }) => go("/customers?new=1" as Route) },
  { id: "new-operator", label: "New operator", group: "Actions", icon: Building2, keywords: "create provider partner fleet", run: ({ go }) => go("/operators/new") },
  { id: "go-home", label: "Command Center", group: "Go to", icon: LayoutDashboard, keywords: "dashboard home", run: ({ go }) => go("/") },
  { id: "go-leads", label: "Leads", group: "Go to", icon: Inbox, keywords: "inquiries pipeline", run: ({ go }) => go("/leads") },
  { id: "go-customers", label: "Customers", group: "Go to", icon: Users, keywords: "clients directory", run: ({ go }) => go("/customers") },
  { id: "go-operators", label: "Operators", group: "Go to", icon: Building2, keywords: "network fleet providers", run: ({ go }) => go("/operators") },
  { id: "view-attention", label: "Leads needing attention", group: "Lead views", icon: Bell, keywords: "urgent overdue", run: ({ go }) => go(leadsHref({ view: "attention" }) as Route) },
  { id: "view-followups", label: "Follow-ups due", group: "Lead views", icon: CalendarClock, keywords: "overdue today", run: ({ go }) => go(leadsHref({ view: "follow_up" }) as Route) },
  { id: "view-upcoming", label: "Upcoming trips", group: "Lead views", icon: ArrowRight, keywords: "next 14 days soon", run: ({ go }) => go(leadsHref({ view: "upcoming" }) as Route) },
  { id: "view-new", label: "New inquiries", group: "Lead views", icon: CircleDot, keywords: "uncontacted awaiting", run: ({ go }) => go(leadsHref({ view: "new" }) as Route) },
  { id: "theme-light", label: "Light theme", group: "Theme", icon: Sun, keywords: "appearance mode", run: ({ setTheme }) => setTheme("light") },
  { id: "theme-dark", label: "Dark theme", group: "Theme", icon: Moon, keywords: "appearance mode night", run: ({ setTheme }) => setTheme("dark") },
  { id: "theme-system", label: "System theme", group: "Theme", icon: Monitor, keywords: "appearance mode auto", run: ({ setTheme }) => setTheme("system") },
];

const groupClass =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-fg-muted [&_[cmdk-group-heading]]:uppercase";

function Item({
  value,
  onSelect,
  icon,
  children,
  meta,
}: {
  value: string;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex min-h-10 cursor-default items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[selected=true]:bg-surface-hover"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-surface-sunken text-fg-muted group-data-[selected=true]:text-fg [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
      {meta ? <span className="shrink-0 text-xs text-fg-muted">{meta}</span> : null}
      <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-fg-faint opacity-0 group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}

function recentIcon(type: RecentItem["type"]) {
  return type === "lead" ? <Inbox /> : type === "customer" ? <Users /> : <Building2 />;
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const recents = useRecentItems();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        setResults((await res.json()) as SearchResults);
      } catch {
        if (!controller.signal.aborted) setResults({ query: trimmed, leads: [], customers: [], operators: [] });
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const current = trimmed && results?.query === trimmed ? results : null;
  const pending = trimmed.length > 0 && !current;

  const matchingCommands = useMemo(() => {
    if (!trimmed) return COMMANDS;
    const q = trimmed.toLowerCase();
    return COMMANDS.filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q));
  }, [trimmed]);

  function close() {
    onOpenChange(false);
    setQuery("");
  }

  function go(href: Route) {
    close();
    router.push(href);
  }

  const runCommand = (command: PaletteCommand) => {
    command.run({ go, setTheme: (t) => (close(), setTheme(t)) });
  };

  const totalResults = current ? current.leads.length + current.customers.length + current.operators.length : 0;
  const groups = ["Actions", "Go to", "Lead views", "Theme"] as const;

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery("");
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-surface-raised text-fg shadow-lg outline-none",
            "inset-0 sm:inset-auto sm:top-[12vh] sm:left-1/2 sm:w-[calc(100vw-2rem)] sm:max-w-[640px] sm:-translate-x-1/2 sm:rounded-xl sm:border sm:border-border",
            "data-[state=open]:animate-scale-in",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search and commands</DialogPrimitive.Title>
          <Command shouldFilter={false} loop label="Search and commands" className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-3 border-b border-border-subtle px-4">
              <Search aria-hidden className="size-4 shrink-0 text-fg-muted" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search leads, customers, operators — or type a command"
                className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fg-faint sm:text-md"
              />
              {pending ? <Spinner className="text-fg-muted" label="Searching" /> : null}
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-xs font-medium text-fg-muted hover:bg-surface-hover sm:hidden"
              >
                Cancel
              </button>
              <Kbd className="hidden sm:inline-flex">esc</Kbd>
            </div>

            <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 sm:max-h-[min(60vh,460px)]">
              {trimmed && current && totalResults === 0 && matchingCommands.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-sm font-medium text-fg">No matches for “{trimmed}”</p>
                  <p className="mt-1 text-sm text-fg-muted">Try a name, phone number, lead number like L-1042, or a location.</p>
                </div>
              ) : null}

              {!trimmed && recents.length > 0 ? (
                <Command.Group heading="Recently viewed" className={groupClass}>
                  {recents.map((r) => (
                    <Item key={`${r.type}-${r.id}`} value={`recent-${r.type}-${r.id}`} onSelect={() => go(r.href as Route)} icon={recentIcon(r.type)}>
                      <span className="block truncate font-medium text-fg">{r.label}</span>
                      {r.sublabel ? <span className="block truncate text-xs text-fg-muted">{r.sublabel}</span> : null}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {current && current.leads.length > 0 ? (
                <Command.Group heading="Leads" className={groupClass}>
                  {current.leads.map((l) => (
                    <Item
                      key={l.id}
                      value={`lead-${l.id}`}
                      onSelect={() => go(`/leads/${l.id}` as Route)}
                      icon={<Inbox />}
                      meta={l.tripDate ? formatPlainDate(l.tripDate, "medium") : "No date"}
                    >
                      <span className="flex items-center gap-2">
                        <span className="tabular shrink-0 text-xs font-medium text-fg-muted">{formatLeadNumber(l.number)}</span>
                        <span className="truncate font-medium text-fg">{l.title}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-fg-muted">
                        <Dot tone={LEAD_STATUS_META[l.status].tone} className="size-1.5" />
                        {LEAD_STATUS_META[l.status].label} · {l.customerName}
                      </span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {current && current.customers.length > 0 ? (
                <Command.Group heading="Customers" className={groupClass}>
                  {current.customers.map((c) => (
                    <Item
                      key={c.id}
                      value={`customer-${c.id}`}
                      onSelect={() => go(`/customers/${c.id}` as Route)}
                      icon={<Users />}
                      meta={`${c.leadCount} ${c.leadCount === 1 ? "inquiry" : "inquiries"}`}
                    >
                      <span className="block truncate font-medium text-fg">
                        {c.fullName}
                        {c.companyName ? <span className="font-normal text-fg-muted"> · {c.companyName}</span> : null}
                      </span>
                      <span className="block truncate text-xs text-fg-muted">{[formatPhone(c.phone), c.email].filter(Boolean).join(" · ")}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {current && current.operators.length > 0 ? (
                <Command.Group heading="Operators" className={groupClass}>
                  {current.operators.map((o) => (
                    <Item
                      key={o.id}
                      value={`operator-${o.id}`}
                      onSelect={() => go(`/operators/${o.id}` as Route)}
                      icon={<Building2 />}
                      meta={OPERATOR_STATUS_META[o.status].label}
                    >
                      <span className="block truncate font-medium text-fg">{o.companyName}</span>
                      <span className="block truncate text-xs text-fg-muted">{[o.baseLocation, o.serviceAreas.slice(0, 3).join(", ")].filter(Boolean).join(" · ")}</span>
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              {groups.map((group) => {
                const items = matchingCommands.filter((c) => c.group === group);
                if (items.length === 0) return null;
                return (
                  <Command.Group key={group} heading={trimmed ? `${group}` : group} className={groupClass}>
                    {items.map((command) => (
                      <Item key={command.id} value={command.id} onSelect={() => runCommand(command)} icon={<command.icon />}>
                        <span className="font-medium text-fg">{command.label}</span>
                      </Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>

            <div className="hidden items-center gap-4 border-t border-border-subtle px-4 py-2.5 text-xs text-fg-muted sm:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd>↵</Kbd> open
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <History className="size-3.5" /> Recent items are stored in this browser
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
