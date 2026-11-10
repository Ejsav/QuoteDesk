"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { OPERATOR_STATUSES, OPERATOR_STATUS_META, type OperatorStatus } from "@/domain/operator";
import { changeOperatorStatusAction } from "@/server/actions/operators";
import { Dot } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { OperatorStatusBadge } from "./operator-display";

/** Relationship status picker. Compare-and-set against the status this page loaded with. */
export function OperatorStatusMenu({ operatorId, status }: { operatorId: string; status: OperatorStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(status);

  function change(next: OperatorStatus) {
    if (next === status) return;
    startTransition(async () => {
      setShown(next);
      const result = await changeOperatorStatusAction({ id: operatorId, expectedStatus: status, status: next });
      if (result.ok) {
        toast.success(`Relationship set to ${OPERATOR_STATUS_META[next].label}`, { description: OPERATOR_STATUS_META[next].description });
      } else {
        toast.error(result.error.message);
        if (result.error.code === "conflict" || result.error.code === "not_found") router.refresh();
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          aria-label={`Relationship status: ${OPERATOR_STATUS_META[shown].label}. Change status`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-0.5 transition-colors hover:bg-surface-hover",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-70",
          )}
        >
          <OperatorStatusBadge status={shown} />
          {isPending ? <Spinner className="size-3.5 text-fg-muted" label="Saving status" /> : <ChevronDown aria-hidden className="size-3.5 text-fg-muted" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Relationship status</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={shown} onValueChange={(v) => change(v as OperatorStatus)}>
          {OPERATOR_STATUSES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s} className="items-start py-2">
              <Dot tone={OPERATOR_STATUS_META[s].tone} className="mt-1.5" />
              <span className="min-w-0">
                <span className="block font-medium text-fg">{OPERATOR_STATUS_META[s].label}</span>
                <span className="block text-xs text-fg-muted">{OPERATOR_STATUS_META[s].description}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
