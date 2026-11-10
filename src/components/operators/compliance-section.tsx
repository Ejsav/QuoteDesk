"use client";

import { CircleDashed, FileText, Info, MessageSquareQuote, MoreHorizontal, Pencil, Plus, ShieldAlert, ShieldCheck, Trash2, type LucideIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { daysBetween, formatPlainDate, type PlainDate } from "@/domain/dates";
import {
  COMPLIANCE_KIND_META,
  STANDARD_COMPLIANCE_KINDS,
  effectiveCompliance,
  type ComplianceKind,
  type EffectiveComplianceStatus,
  type VerificationSummary,
} from "@/domain/operator";
import { deleteComplianceAction } from "@/server/actions/operators";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { ComplianceDialog, type ComplianceRecord } from "./compliance-dialog";
import { ComplianceStatusBadge } from "./operator-display";

const STATUS_ICON: Record<EffectiveComplianceStatus, { icon: LucideIcon; className: string }> = {
  verified: { icon: ShieldCheck, className: "text-[var(--green-fg)] bg-[var(--green-bg)]" },
  received: { icon: FileText, className: "text-[var(--blue-fg)] bg-[var(--blue-bg)]" },
  reported: { icon: MessageSquareQuote, className: "text-fg-muted bg-surface-hover" },
  issue: { icon: ShieldAlert, className: "text-[var(--red-fg)] bg-[var(--red-bg)]" },
  expired: { icon: ShieldAlert, className: "text-[var(--red-fg)] bg-[var(--red-bg)]" },
  missing: { icon: CircleDashed, className: "text-fg-faint bg-surface-sunken" },
};

function summarySentence(summary: VerificationSummary): string {
  const parts = [`${summary.verified} of ${summary.tracked} standard checks verified`];
  if (summary.expired) parts.push(`${summary.expired} expired`);
  if (summary.issues) parts.push(`${summary.issues} with an issue`);
  if (summary.expiringSoon) parts.push(`${summary.expiringSoon} expiring soon`);
  if (summary.missing) parts.push(`${summary.missing} not on file`);
  return parts.join(" · ");
}

function ExpiryLine({ expiresOn, today }: { expiresOn: PlainDate; today: PlainDate }) {
  const days = daysBetween(today, expiresOn);
  if (days < 0) {
    return (
      <span className="font-medium text-[var(--red-fg)]">
        Expired {formatPlainDate(expiresOn, "medium")} · {-days} {days === -1 ? "day" : "days"} ago
      </span>
    );
  }
  return (
    <span className={cn(days <= 30 && "font-medium text-[var(--amber-fg)]")}>
      Expires {formatPlainDate(expiresOn, "medium")} · {days === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}
    </span>
  );
}

function RecordRow({
  title,
  hint,
  record,
  today,
  onEdit,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  record: ComplianceRecord | null;
  today: PlainDate;
  onEdit: () => void;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const effective = effectiveCompliance(record, today);
  const { icon: Icon, className: iconClass } = STATUS_ICON[effective.status];
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span aria-hidden className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg", iconClass)}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="text-sm font-medium text-fg">{title}</p>
          <ComplianceStatusBadge effective={effective} />
        </div>
        {record ? (
          <div className="mt-1 space-y-1 text-xs text-fg-muted">
            {record.reference || record.expiresOn ? (
              <p className="flex flex-wrap gap-x-3 gap-y-0.5">
                {record.reference ? (
                  <span>
                    Ref <span className="font-medium text-fg-secondary">{record.reference}</span>
                  </span>
                ) : null}
                {record.expiresOn ? <ExpiryLine expiresOn={record.expiresOn} today={today} /> : null}
              </p>
            ) : null}
            {record.status === "verified" && record.verifiedOn ? (
              <p className="text-fg-secondary">
                Verified {formatPlainDate(record.verifiedOn, "medium")}
                {record.verifiedByName ? ` by ${record.verifiedByName}` : ""}
              </p>
            ) : null}
            {record.evidenceNote ? (
              <p className="rounded-md border border-border-subtle bg-surface-sunken px-2.5 py-1.5 leading-5 whitespace-pre-line text-fg-secondary">
                <span className="font-medium text-fg-muted">{record.status === "verified" ? "Evidence: " : "Note: "}</span>
                {record.evidenceNote}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-0.5 text-xs leading-5 text-fg-muted">{hint}</p>
        )}
      </div>
      {record ? (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="sm" onClick={onEdit} className="hidden sm:inline-flex">
            Update
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Update record
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={onRemove}>
                <Trash2 /> Remove record
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={onAdd} aria-label={`Add ${title} record`}>
          <Plus /> Add
        </Button>
      )}
    </li>
  );
}

type DialogState = { record: ComplianceRecord | null; kind: ComplianceKind } | null;

export function ComplianceSection({
  operatorId,
  records,
  summary,
  today,
  userName,
  className,
}: {
  operatorId: string;
  records: ComplianceRecord[];
  summary: VerificationSummary;
  today: PlainDate;
  userName: string;
  className?: string;
}) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [removing, setRemoving] = useState<{ record: ComplianceRecord; title: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const others = records.filter((r) => r.kind === "other");

  function remove(target: { record: ComplianceRecord; title: string }) {
    startTransition(async () => {
      const result = await deleteComplianceAction({ operatorId, recordId: target.record.id });
      if (result.ok) toast.success(`${target.title} record removed`);
      else toast.error(result.error.message);
      setRemoving(null);
    });
  }

  return (
    <Card className={className}>
      <CardHeader title="Verification & compliance" description={summarySentence(summary)} />
      <div className="mx-4 mb-3 flex items-start gap-2.5 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2.5 sm:mx-5">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-fg-muted" />
        <p className="text-xs leading-5 text-fg-secondary">
          Recorded manually by your team. QuoteDesk doesn&apos;t verify documents or check availability automatically — a record is only
          &ldquo;Verified&rdquo; when someone logged the date and the evidence they reviewed.
        </p>
      </div>
      <ul className="divide-y divide-border-subtle border-t border-border-subtle">
        {STANDARD_COMPLIANCE_KINDS.map((kind) => {
          const record = records.find((r) => r.kind === kind) ?? null;
          const title = COMPLIANCE_KIND_META[kind].label;
          return (
            <RecordRow
              key={kind}
              title={title}
              hint={COMPLIANCE_KIND_META[kind].evidence}
              record={record}
              today={today}
              onAdd={() => setDialog({ record: null, kind })}
              onEdit={() => record && setDialog({ record, kind })}
              onRemove={() => record && setRemoving({ record, title })}
            />
          );
        })}
      </ul>
      <div className="border-t border-border-subtle">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2 sm:px-5">
          <p className="text-sm font-medium text-fg">Other documents</p>
          <Button variant="ghost" size="sm" onClick={() => setDialog({ record: null, kind: "other" })}>
            <Plus /> Add document
          </Button>
        </div>
        {others.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-fg-muted sm:px-5">Workers&apos; comp, safety ratings, contracts — anything else you keep on file.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {others.map((record) => (
              <RecordRow
                key={record.id}
                title={record.label ?? "Document"}
                hint=""
                record={record}
                today={today}
                onAdd={() => undefined}
                onEdit={() => setDialog({ record, kind: "other" })}
                onRemove={() => setRemoving({ record, title: record.label ?? "Document" })}
              />
            ))}
          </ul>
        )}
      </div>

      {dialog ? (
        <ComplianceDialog
          key={dialog.record?.id ?? `new-${dialog.kind}`}
          operatorId={operatorId}
          record={dialog.record}
          kind={dialog.kind}
          today={today}
          userName={userName}
          onClose={() => setDialog(null)}
        />
      ) : null}

      <ConfirmDialog
        open={removing != null}
        onOpenChange={(open) => !open && !isPending && setRemoving(null)}
        title="Remove this record?"
        description={
          removing
            ? `The ${removing.title.toLowerCase()} record and its notes will be removed. The removal is recorded in the operator's activity, and the check will show as "Not on file".`
            : ""
        }
        confirmLabel="Remove record"
        loading={isPending}
        onConfirm={() => removing && remove(removing)}
      />
    </Card>
  );
}
