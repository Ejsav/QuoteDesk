"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteOperatorAction } from "@/server/actions/operators";
import { removeRecent } from "@/components/shell/recent";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { pluralize } from "@/lib/utils";

export function OperatorHeaderActions({
  operatorId,
  name,
  vehicleCount,
  recordCount,
}: {
  operatorId: string;
  name: string;
  vehicleCount: number;
  recordCount: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteOperatorAction({ id: operatorId });
      if (result.ok) {
        removeRecent("operator", operatorId);
        toast.success(`${name} was deleted`);
        router.replace("/operators");
      } else {
        toast.error(result.error.message);
        setConfirmOpen(false);
        if (result.error.code === "not_found") router.replace("/operators");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="secondary">
        <Link href={`/operators/${operatorId}/edit` as Route}>
          <Pencil /> Edit
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem destructive onSelect={() => setConfirmOpen(true)}>
            <Trash2 /> Delete operator
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !isPending && setConfirmOpen(open)}
        title={`Delete ${name}?`}
        description={
          <>
            This permanently removes the operator, its {pluralize(vehicleCount, "vehicle record")} and{" "}
            {pluralize(recordCount, "verification record")}, and this operator&apos;s activity timeline. A deletion entry stays in your workspace
            activity. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete operator"
        loading={isPending}
        onConfirm={remove}
      >
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs leading-5 text-fg-muted">
          No inquiries reference operators yet, so no leads are affected. If you may work with them again, consider setting the relationship to
          Paused or Do not use instead.
        </p>
      </ConfirmDialog>
    </div>
  );
}
