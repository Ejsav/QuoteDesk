"use client";

import { Info, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from "@/components/ui/menu";
import { Avatar, Kbd, Overline } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { LogoMark, Wordmark } from "./logo";
import { NAV_SECTIONS, type NavItem } from "./nav";
import { ThemeToggle } from "./theme-toggle";

const PaletteContext = createContext<{ openPalette: () => void }>({ openPalette: () => {} });

export function usePalette() {
  return useContext(PaletteContext);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface ShellProps {
  workspaceName: string;
  userName: string;
  attentionCount: number;
  children: React.ReactNode;
}

const DEMO_NOTICE =
  "Local demonstration environment: no sign-in, a single workspace, and data stored in a SQLite file on this machine. Not a secure multi-user deployment.";

export function AppShell({ workspaceName, userName, attentionCount, children }: ShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      } else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const openPalette = () => setPaletteOpen(true);

  return (
    <PaletteContext.Provider value={{ openPalette }}>
      <a
        href="#main"
        className="sr-only z-[60] rounded-md bg-primary px-3 py-2 text-sm font-medium text-fg-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Sidebar workspaceName={workspaceName} userName={userName} attentionCount={attentionCount} onSearch={openPalette} />
      <MobileTopBar workspaceName={workspaceName} userName={userName} onSearch={openPalette} />
      <main id="main" tabIndex={-1} className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] outline-none lg:pb-0 lg:pl-[248px]">
        {children}
      </main>
      <MobileTabBar attentionCount={attentionCount} />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </PaletteContext.Provider>
  );
}

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="tabular ml-auto rounded-full bg-surface-active px-1.5 py-px text-2xs font-semibold text-fg-secondary">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({ item, active, attentionCount }: { item: NavItem; active: boolean; attentionCount: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm font-medium transition-colors duration-150",
        active ? "bg-surface text-fg shadow-xs dark:bg-surface-hover" : "text-fg-secondary hover:bg-surface-hover hover:text-fg",
      )}
    >
      {active ? <span aria-hidden className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r-full bg-accent" /> : null}
      <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-accent-strong" : "text-fg-muted group-hover:text-fg-secondary")} />
      <span className="truncate">{item.label}</span>
      {item.badge === "attention" ? (
        <Tooltip content={`${attentionCount} ${attentionCount === 1 ? "lead needs" : "leads need"} attention`} side="right">
          <span className="ml-auto">
            <NavBadge count={attentionCount} />
          </span>
        </Tooltip>
      ) : null}
    </Link>
  );
}

function Sidebar({ workspaceName, userName, attentionCount, onSearch }: Omit<ShellProps, "children"> & { onSearch: () => void }) {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-border bg-sidebar lg:flex">
      <div className="flex h-14 shrink-0 items-center px-4">
        <Link href="/" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <Wordmark />
        </Link>
      </div>

      <div className="px-3">
        <div className="rounded-lg border border-border bg-surface px-3 py-2.5 shadow-xs">
          <p className="truncate text-sm font-semibold text-fg" title={workspaceName}>
            {workspaceName}
          </p>
          <Tooltip content={DEMO_NOTICE} side="right">
            <button type="button" className="mt-0.5 inline-flex cursor-help items-center gap-1 rounded text-xs text-accent-strong">
              <Info aria-hidden className="size-3" />
              Local demo environment
            </button>
          </Tooltip>
        </div>

        <div className="mt-3 flex gap-1.5">
          <button
            type="button"
            onClick={onSearch}
            className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-sm text-fg-muted shadow-xs transition-colors hover:border-border-strong hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Search…</span>
            <Kbd>⌘K</Kbd>
          </button>
          <Tooltip content="New inquiry" side="right">
            <Button asChild variant="primary" size="icon" aria-label="New inquiry">
              <Link href="/leads/new">
                <Plus />
              </Link>
            </Button>
          </Tooltip>
        </div>
      </div>

      <nav aria-label="Primary" className="mt-6 flex-1 overflow-y-auto px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <Overline className="mb-1.5 px-2">{section.label}</Overline>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} active={item.match(pathname)} attentionCount={attentionCount} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-3 border-t border-border p-3">
        <div className="flex items-center gap-2.5 px-1">
          <Avatar name={userName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{userName}</p>
            <p className="text-xs text-fg-muted">Owner</p>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  );
}

function MobileTopBar({ workspaceName, userName, onSearch }: { workspaceName: string; userName: string; onSearch: () => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-border bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
      <Link href="/" aria-label="Command Center" className="rounded-md">
        <LogoMark />
      </Link>
      <span className="min-w-0 truncate text-sm font-semibold text-fg">{workspaceName}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onSearch} aria-label="Search">
          <Search />
        </Button>
        <Button asChild variant="primary" size="icon" aria-label="New inquiry">
          <Link href="/leads/new">
            <Plus />
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Account and appearance" className="ml-1 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Avatar name={userName} size="md" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>{userName} · Owner</DropdownMenuLabel>
            <p className="px-2 pb-2 text-xs leading-[18px] text-fg-muted">{DEMO_NOTICE}</p>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Appearance</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function MobileTabBar({ attentionCount }: { attentionCount: number }) {
  const pathname = usePathname();
  const items = NAV_SECTIONS.flatMap((s) => s.items).filter((i) => i.mobile);
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-fg" : "text-fg-muted",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className={cn("size-5", active && "text-accent-strong")} />
                  {item.badge === "attention" && attentionCount > 0 ? (
                    <span className="tabular absolute -top-1.5 -right-3 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-semibold text-fg-on-primary">
                      {attentionCount > 99 ? "99+" : attentionCount}
                    </span>
                  ) : null}
                </span>
                {item.href === "/" ? "Home" : item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
