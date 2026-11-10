"use client";

import { Check, ChevronDown, CircleAlert, Flag, MoreHorizontal, PencilLine, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  LEAD_PRIORITIES,
  LEAD_PRIORITY_META,
  LEAD_STATUSES,
  LEAD_STATUS_META,
  LOST_REASONS,
  LOST_REASON_LABELS,
  QUALIFICATION_FIELD_LABELS,
  describeMissing,
  formatLeadNumber,
  type LeadPriority,
  type LeadStatus,
  type LostReason,
  type QualificationField,
} from "@/domain/lead";
import { changeLeadPriorityAction, changeLeadStatusAction, deleteLeadAction } from "@/server/actions/leads";
import { removeRecent } from "@/components/shell/recent";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useAction } from "./use-action";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function StatusControl({
  leadId,
  leadNumber,
  status,
  missing,
  className,
  fullWidth,
}: {
  leadId: string;
  leadNumber: number;
  status: LeadStatus;
  missing: QualificationField[];
  className?: string;
  fullWidth?: boolean;
}) {
  const { pending, run } = useAction(changeLeadStatusAction);
  const [lostOpen, setLostOpen] = useState(false);
  const [reason, setReason] = useState<LostReason | "">("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const meta = LEAD_STATUS_META[status];

  function change(to: LeadStatus, lostReason: LostReason | null = null) {
    return run(
      { id: leadId, expectedStatus: status, status: to, lostReason },
      { success: `${formatLeadNumber(leadNumber)} moved to ${LEAD_STATUS_META[to].label}` },
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" className={cn(fullWidth && "w-full justify-between", className)} aria-label={`Status: ${meta.label}. Change status`} disabled={pending}>
            <span className={cn("inline-flex items-center gap-2", `tone-${meta.tone}`)}>
              {pending ? <Spinner className="size-3.5" /> : <span aria-hidden className="size-2 rounded-full bg-[var(--tone-dot)]" />}
              <span className="font-medium text-fg">{meta.label}</span>
            </span>
            <ChevronDown className="text-fg-muted" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Move lead to</DropdownMenuLabel>
          {LEAD_STATUSES.map((s) => {
            const m = LEAD_STATUS_META[s];
            const blocked = s === "qualified" && missing.length > 0 && status !== "qualified";
            return (
              <DropdownMenuItem
                key={s}
                disabled={blocked}
                onSelect={() => {
                  if (s === status) return;
                  if (s === "lost") {
                    setReason("");
                    setReasonError(null);
                    setLostOpen(true);
                    return;
                  }
                  void change(s);
                }}
                className="items-start py-2"
              >
                <Dot tone={m.tone} className="mt-1.5" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-fg">{m.label}</span>
                  <span className="block text-xs text-fg-muted">
                    {blocked ? `Add the ${describeMissing(missing)} to qualify` : m.description}
                  </span>
                </span>
                {s === status ? <Check className="mt-0.5 text-fg" /> : null}
              </DropdownMenuItem>
            );
          })}
          {missing.length > 0 && status !== "qualified" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/leads/${leadId}/edit` as Route}>
                  <PencilLine /> Add missing details
                </Link>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={lostOpen} onOpenChange={setLostOpen}>
        <DialogContent size="sm" title="Mark as lost" description="Record why this inquiry didn't move forward. Any open follow-up will be closed.">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reason) {
                setReasonError("Choose a reason.");
                return;
              }
              const result = await change("lost", reason);
              if (result.ok) setLostOpen(false);
            }}
          >
            <DialogBody>
              <Field label="Reason" htmlFor="lost-reason" required error={reasonError ?? undefined}>
                <Select
                  id="lost-reason"
                  value={reason}
                  aria-invalid={reasonError ? true : undefined}
                  onChange={(e) => {
                    setReason(e.target.value as LostReason);
                    setReasonError(null);
                  }}
                >
                  <option value="">Choose a reason…</option>
                  {LOST_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {LOST_REASON_LABELS[r]}
                    </option>
                  ))}
                </Select>
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setLostOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={pending}>
                Mark as lost
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function QualificationHint({ missing, leadId }: { missing: QualificationField[]; leadId: string }) {
  if (missing.length === 0) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs text-fg-muted">
      <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        To qualify, add the {missing.map((m) => QUALIFICATION_FIELD_LABELS[m]).join(", ")}.{" "}
        <Link href={`/leads/${leadId}/edit` as Route} className="font-medium text-fg underline-offset-2 hover:underline">
          Edit details
        </Link>
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export function PriorityControl({ leadId, priority }: { leadId: string; priority: LeadPriority }) {
  const { pending, run } = useAction(changeLeadPriorityAction);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" disabled={pending} aria-label={`Priority: ${LEAD_PRIORITY_META[priority].label}. Change priority`}>
          {pending ? <Spinner className="size-3.5" /> : <Flag className={cn(priority === "urgent" && "text-[var(--red-dot)]", priority === "high" && "text-[var(--orange-dot)]")} />}
          {LEAD_PRIORITY_META[priority].label}
          <ChevronDown className="text-fg-muted" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        {[...LEAD_PRIORITIES].reverse().map((p) => (
          <DropdownMenuItem
            key={p}
            onSelect={() => {
              if (p !== priority) void run({ id: leadId, expectedPriority: priority, priority: p }, { success: `Priority set to ${LEAD_PRIORITY_META[p].label}` });
            }}
          >
            <Flag className={cn(p === "urgent" && "!text-[var(--red-dot)]", p === "high" && "!text-[var(--orange-dot)]")} />
            <span className="flex-1">{LEAD_PRIORITY_META[p].label}</span>
            {p === priority ? <Check className="!text-fg" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// More (delete)
// ---------------------------------------------------------------------------

export function LeadMoreMenu({
  leadId,
  leadNumber,
  customerName,
  activityCount,
  stopCount,
}: {
  leadId: string;
  leadNumber: number;
  customerName: string;
  activityCount: number;
  stopCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pending, run } = useAction(deleteLeadAction);
  const ref = formatLeadNumber(leadNumber);
  const parts = [`${activityCount} timeline ${activityCount === 1 ? "entry" : "entries"}`];
  if (stopCount > 0) parts.unshift(`${stopCount} route ${stopCount === 1 ? "stop" : "stops"}`);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/leads/${leadId}/edit` as Route}>
              <PencilLine /> Edit details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setOpen(true)}>
            <Trash2 /> Delete inquiry…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Delete ${ref}?`}
        description={
          <>
            This permanently deletes the inquiry, its {parts.join(" and ")}. {customerName}&apos;s customer record stays, and a deletion note is
            kept on their timeline. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete inquiry"
        loading={pending}
        onConfirm={() =>
          run(
            { id: leadId },
            {
              success: `${ref} deleted`,
              onSuccess: () => {
                setOpen(false);
                removeRecent("lead", leadId);
                router.push("/leads");
              },
            },
          )
        }
      />
    </>
  );
}
