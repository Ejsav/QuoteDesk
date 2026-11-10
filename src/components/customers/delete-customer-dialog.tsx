"use client";

import { AlertTriangle, GitMerge } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { pluralize } from "@/lib/utils";
import { deleteCustomerAction } from "@/server/actions/customers";
import { removeRecent } from "@/components/shell/recent";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";

/**
 * Customers with inquiries can't be deleted (the database enforces it). When
 * we already know that, explain it and offer a merge instead of a delete
 * button that can only fail. If the data changed since the page loaded, the
 * server's rule error is shown in place — never a false success.
 */
export function DeleteCustomerDialog({
  open,
  onOpenChange,
  customer,
  onMergeInstead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: { id: string; fullName: string; leadCount: number };
  onMergeInstead: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (customer.leadCount > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent title={`${customer.fullName} can't be deleted yet`} size="sm">
          <DialogBody>
            <p className="text-sm leading-6 text-fg-secondary">
              {customer.fullName} has {pluralize(customer.leadCount, "inquiry", "inquiries")}. Customers with inquiries can&apos;t be deleted, so a trip
              request never loses its customer.
            </p>
            <p className="mt-3 text-sm leading-6 text-fg-secondary">
              Delete or reassign {customer.leadCount === 1 ? "that inquiry" : "those inquiries"} first — or, if this is a duplicate record, merge it
              into the right customer.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={onMergeInstead}>
              <GitMerge /> Merge into another customer…
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  async function confirmDelete() {
    setPending(true);
    setError(null);
    const result = await deleteCustomerAction({ id: customer.id });
    setPending(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    toast.success(`${result.data.name} deleted`);
    removeRecent("customer", customer.id);
    onOpenChange(false);
    router.push("/customers");
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title={`Delete ${customer.fullName}?`}
      description="This permanently removes the customer record and its timeline. A note of the deletion stays in your workspace activity. This can't be undone."
      confirmLabel="Delete customer"
      loading={pending}
      onConfirm={confirmDelete}
    >
      {error ? (
        <div role="alert" className="tone-red rounded-lg bg-[var(--tone-bg)] px-3 py-2.5 text-sm">
          <p className="flex gap-2 text-fg">
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
            <span>{error}</span>
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              setError(null);
              onMergeInstead();
            }}
          >
            <GitMerge /> Merge instead
          </Button>
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
