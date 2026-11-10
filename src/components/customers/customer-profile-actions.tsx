"use client";

import { GitMerge, MoreHorizontal, PencilLine, Plus, Trash2, UserRoundSearch } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { createContext, useContext, useState } from "react";
import type { DuplicateMatchView } from "@/lib/action-result";
import type { CustomerPickerRow } from "@/server/services/customers";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { CustomerFormDialog, type EditableCustomer } from "./customer-form-dialog";
import { DeleteCustomerDialog } from "./delete-customer-dialog";
import { MergeCustomerDialog } from "./merge-customer-dialog";

export interface ProfileCustomer extends EditableCustomer {
  leadCount: number;
}

type OpenDialog = { kind: "edit" } | { kind: "merge"; target: CustomerPickerRow | null } | { kind: "delete" } | null;

interface DialogApi {
  openEdit: () => void;
  openMerge: (target?: CustomerPickerRow | null) => void;
  openDelete: () => void;
}

const DialogContext = createContext<DialogApi | null>(null);

function useCustomerDialogs(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useCustomerDialogs must be used inside CustomerProfileProvider");
  return ctx;
}

/** Owns the profile's dialogs so header actions, banners and cards can open them. */
export function CustomerProfileProvider({ customer, children }: { customer: ProfileCustomer; children: React.ReactNode }) {
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const api: DialogApi = {
    openEdit: () => setDialog({ kind: "edit" }),
    openMerge: (target = null) => setDialog({ kind: "merge", target }),
    openDelete: () => setDialog({ kind: "delete" }),
  };
  const close = (open: boolean) => {
    if (!open) setDialog(null);
  };
  return (
    <DialogContext.Provider value={api}>
      {children}
      <CustomerFormDialog open={dialog?.kind === "edit"} onOpenChange={close} customer={customer} />
      <MergeCustomerDialog
        open={dialog?.kind === "merge"}
        onOpenChange={close}
        source={{ id: customer.id, fullName: customer.fullName, leadCount: customer.leadCount, hasNotes: !!customer.notes }}
        initialTarget={dialog?.kind === "merge" ? dialog.target : null}
      />
      <DeleteCustomerDialog
        open={dialog?.kind === "delete"}
        onOpenChange={close}
        customer={{ id: customer.id, fullName: customer.fullName, leadCount: customer.leadCount }}
        onMergeInstead={() => setDialog({ kind: "merge", target: null })}
      />
    </DialogContext.Provider>
  );
}

export function CustomerHeaderActions({ customerId }: { customerId: string }) {
  const { openEdit, openMerge, openDelete } = useCustomerDialogs();
  return (
    <>
      <Button asChild variant="primary">
        <Link href={`/leads/new?customerId=${customerId}` as Route}>
          <Plus /> New inquiry
        </Link>
      </Button>
      <Button variant="secondary" onClick={openEdit}>
        <PencilLine /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More customer actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openMerge()}>
            <GitMerge /> Merge into another customer…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={openDelete}>
            <Trash2 /> Delete customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function EditCustomerButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const { openEdit } = useCustomerDialogs();
  return (
    <Button variant="secondary" size="sm" onClick={openEdit} className={className}>
      {children}
    </Button>
  );
}

/** Surfaces records sharing this customer's phone or email — never merged automatically. */
export function DuplicatesBanner({ matches, className }: { matches: DuplicateMatchView[]; className?: string }) {
  const { openMerge } = useCustomerDialogs();
  if (matches.length === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        "tone-amber flex flex-col gap-3 rounded-xl border border-[var(--tone-dot)]/35 bg-[var(--tone-bg)] p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <UserRoundSearch aria-hidden className="size-5 shrink-0 text-[var(--tone-fg)]" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-fg">{matches.length === 1 ? "Possible duplicate record" : `${matches.length} possible duplicate records`}</p>
        <p className="mt-0.5 text-fg-secondary">
          {matches.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? "; " : ""}
              <Link href={`/customers/${m.id}` as Route} className="font-medium text-fg underline underline-offset-2">
                {m.fullName}
              </Link>{" "}
              has the same {m.matchedOn.join(" and ")}
            </span>
          ))}
          . If it&apos;s the same customer, merge the records so every inquiry lives on one profile.
        </p>
      </div>
      <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => openMerge(matches[0] ?? null)}>
        <GitMerge /> Review &amp; merge
      </Button>
    </div>
  );
}
