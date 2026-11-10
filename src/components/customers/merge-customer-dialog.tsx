"use client";

import { AlertTriangle, Check, GitMerge, Search } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatPhone } from "@/domain/contact";
import { cn, pluralize } from "@/lib/utils";
import { mergeCustomersAction } from "@/server/actions/customers";
import type { CustomerPickerRow } from "@/server/services/customers";
import { removeRecent } from "@/components/shell/recent";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Spinner } from "@/components/ui/spinner";

export interface MergeSource {
  id: string;
  fullName: string;
  leadCount: number;
  hasNotes: boolean;
}

export function MergeCustomerDialog({
  open,
  onOpenChange,
  source,
  initialTarget,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: MergeSource;
  initialTarget: CustomerPickerRow | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={`Merge ${source.fullName} into another customer`}
        description="Use this when two records are the same person or organization."
      >
        {open ? <MergeForm source={source} initialTarget={initialTarget} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function firstName(name: string) {
  return name.split(/\s+/)[0] ?? name;
}

function MergeForm({ source, initialTarget, onDone }: { source: MergeSource; initialTarget: CustomerPickerRow | null; onDone: () => void }) {
  const router = useRouter();
  const [target, setTarget] = useState<CustomerPickerRow | null>(initialTarget);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; rows: CustomerPickerRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (target) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/customers?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
          if (!res.ok) throw new Error(String(res.status));
          setResults({ q: trimmed, rows: (await res.json()) as CustomerPickerRow[] });
        } catch {
          if (!controller.signal.aborted) setResults({ q: trimmed, rows: [] });
        }
      },
      trimmed ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, target]);

  const current = results && results.q === trimmed ? results.rows.filter((r) => r.id !== source.id) : null;

  async function merge() {
    if (!target) return;
    setPending(true);
    setError(null);
    const result = await mergeCustomersAction({ sourceId: source.id, targetId: target.id });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(`Merged into ${target.fullName}`, {
      description:
        result.data.leadsMoved > 0
          ? `${pluralize(result.data.leadsMoved, "inquiry", "inquiries")} moved. ${source.fullName}'s record was removed.`
          : `${source.fullName}'s record was removed.`,
    });
    removeRecent("customer", source.id);
    onDone();
    router.push(`/customers/${result.data.targetId}` as Route);
  }

  return (
    <>
      <DialogBody className="space-y-4">
        {target ? (
          <div>
            <p className="mb-2 text-sm font-medium text-fg">Merge into</p>
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <Avatar name={target.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-fg">
                  {target.fullName}
                  {target.companyName ? <span className="font-normal text-fg-muted"> · {target.companyName}</span> : null}
                </p>
                <p className="truncate text-xs text-fg-muted">
                  {[formatPhone(target.phone), target.email].filter(Boolean).join(" · ")} · {pluralize(target.leadCount, "inquiry", "inquiries")}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)} disabled={pending}>
                Change
              </Button>
            </div>

            <div className="mt-4 rounded-lg border border-border-subtle bg-surface-sunken p-3.5 text-sm">
              <p className="font-medium text-fg">What happens</p>
              <ul className="mt-2 space-y-1.5 text-fg-secondary">
                <li className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
                  <span>
                    {source.leadCount === 0
                      ? `${source.fullName} has no inquiries to move.`
                      : `${pluralize(source.leadCount, "inquiry moves", "inquiries move")} to ${target.fullName}, each with its full history.`}
                  </span>
                </li>
                <li className="flex gap-2">
                  <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
                  <span>
                    {firstName(target.fullName)}&apos;s contact details are kept. Anything missing — company, phone, email or preferred contact — is filled
                    in from this record.
                  </span>
                </li>
                {source.hasNotes ? (
                  <li className="flex gap-2">
                    <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-fg-muted" />
                    <span>Notes from this record are appended to {firstName(target.fullName)}&apos;s notes.</span>
                  </li>
                ) : null}
                <li className="flex gap-2">
                  <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-[var(--amber-fg)]" />
                  <span>
                    The record for <strong className="font-medium text-fg">{source.fullName}</strong> is deleted. This can&apos;t be undone.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-fg-muted">
                To keep this record instead, open {target.fullName}&apos;s profile and merge from there.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <label htmlFor="merge-search" className="mb-2 block text-sm font-medium text-fg">
              Find the customer to keep
            </label>
            <Input
              id="merge-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, company, phone or email"
              leading={<Search />}
              trailing={!current ? <Spinner className="size-3.5 text-fg-muted" label="Searching" /> : null}
              autoFocus
            />
            <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border">
              {current && current.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-fg-muted">
                  {trimmed ? `No other customers match “${trimmed}”.` : "No other customers yet."}
                </p>
              ) : (
                <ul aria-label="Matching customers" className="divide-y divide-border-subtle">
                  {(current ?? []).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => setTarget(row)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
                          "focus-visible:bg-surface-hover focus-visible:outline-none",
                        )}
                      >
                        <Avatar name={row.fullName} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-fg">
                            {row.fullName}
                            {row.companyName ? <span className="font-normal text-fg-muted"> · {row.companyName}</span> : null}
                          </span>
                          <span className="block truncate text-xs text-fg-muted">
                            {[formatPhone(row.phone), row.email].filter(Boolean).join(" · ") || "No contact details"}
                          </span>
                        </span>
                        <span className="tabular shrink-0 text-xs text-fg-muted">{pluralize(row.leadCount, "inquiry", "inquiries")}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {error ? (
          <p role="alert" className="tone-red flex gap-2 rounded-lg bg-[var(--tone-bg)] px-3 py-2.5 text-sm text-fg">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
            {error}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={merge} disabled={!target} loading={pending}>
          <GitMerge /> {target ? `Merge into ${firstName(target.fullName)}` : "Choose a customer"}
        </Button>
      </DialogFooter>
    </>
  );
}
