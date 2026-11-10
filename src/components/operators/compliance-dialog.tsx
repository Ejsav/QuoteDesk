"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isPlainDate, type PlainDate } from "@/domain/dates";
import {
  COMPLIANCE_KINDS,
  COMPLIANCE_KIND_META,
  COMPLIANCE_STATUSES,
  COMPLIANCE_STATUS_META,
  type ComplianceKind,
  type ComplianceStatus,
} from "@/domain/operator";
import type { OperatorComplianceRow } from "@/server/db/schema";
import { upsertComplianceAction } from "@/server/actions/operators";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-helpers";

export type ComplianceRecord = Pick<
  OperatorComplianceRow,
  "id" | "kind" | "label" | "status" | "reference" | "expiresOn" | "verifiedOn" | "evidenceNote" | "updatedAt"
> & { verifiedByName: string | null };

interface ComplianceFormValues {
  kind: ComplianceKind;
  label: string;
  status: ComplianceStatus | "";
  reference: string;
  expiresOn: string;
  verifiedOn: string;
  evidenceNote: string;
}

const FIELDS = ["kind", "label", "status", "reference", "expiresOn", "verifiedOn", "evidenceNote"] as const;

function formSchema(today: PlainDate) {
  const optionalDate = z.string().refine((v) => v === "" || isPlainDate(v), "Enter a valid date.");
  return z
    .object({
      kind: z.enum(COMPLIANCE_KINDS),
      label: z.string().max(80, "Keep this under 80 characters."),
      status: z.string().refine((v) => (COMPLIANCE_STATUSES as readonly string[]).includes(v), "Choose what you have on file."),
      reference: z.string().max(80, "Keep this under 80 characters."),
      expiresOn: optionalDate,
      verifiedOn: optionalDate,
      evidenceNote: z.string().max(1000, "Keep this under 1,000 characters."),
    })
    .superRefine((v, ctx) => {
      if (v.kind === "other" && !v.label.trim()) {
        ctx.addIssue({ code: "custom", path: ["label"], message: "Name the document." });
      }
      if (v.status === "verified") {
        if (!v.verifiedOn) ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Verified records need the date you confirmed them." });
        else if (v.verifiedOn > today) ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Verification can't be dated in the future." });
        if (v.evidenceNote.trim().length < 10) {
          ctx.addIssue({
            code: "custom",
            path: ["evidenceNote"],
            message: "Describe the evidence you reviewed — e.g. “COI from agent, limits confirmed by phone.”",
          });
        }
      }
    });
}

export function ComplianceDialog({
  operatorId,
  record,
  kind,
  today,
  userName,
  onClose,
}: {
  operatorId: string;
  /** Existing record to update, or null to add one. */
  record: ComplianceRecord | null;
  /** Kind to add when `record` is null. */
  kind: ComplianceKind;
  today: PlainDate;
  userName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ComplianceFormValues>({
    resolver: zodResolver(formSchema(today)) as unknown as Resolver<ComplianceFormValues>,
    defaultValues: {
      kind: record?.kind ?? kind,
      label: record?.label ?? "",
      status: record?.status ?? "",
      reference: record?.reference ?? "",
      expiresOn: record?.expiresOn ?? "",
      verifiedOn: record?.verifiedOn ?? "",
      evidenceNote: record?.evidenceNote ?? "",
    },
  });
  const status = useWatch({ control, name: "status" });
  const currentKind = useWatch({ control, name: "kind" });
  const meta = COMPLIANCE_KIND_META[currentKind];
  const isOther = currentKind === "other";

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await upsertComplianceAction({
      operatorId,
      recordId: record?.id ?? null,
      kind: values.kind,
      label: isOther ? values.label.trim() : null,
      status: values.status,
      reference: values.reference.trim() || null,
      expiresOn: values.expiresOn || null,
      verifiedOn: values.status === "verified" ? values.verifiedOn : null,
      evidenceNote: values.evidenceNote.trim() || null,
    });
    if (result.ok) {
      toast.success(result.data.changed ? `${isOther ? values.label.trim() : meta.label} saved` : "No changes to save");
      onClose();
      return;
    }
    if (result.error.code === "validation") {
      const unmapped = applyServerErrors(result.error, setError, FIELDS);
      setFormError(unmapped[0] ?? null);
    } else if (result.error.code === "not_found") {
      toast.error(result.error.message);
      onClose();
      router.refresh();
    } else {
      setFormError(result.error.message);
    }
  });

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        size="lg"
        title={record ? `Update ${isOther ? (record.label ?? "document") : meta.label.toLowerCase()}` : isOther ? "Add a document" : `Record ${meta.label.toLowerCase()}`}
        description={isOther ? "Any other supporting document you keep on this operator." : `Typical evidence: ${meta.evidence.toLowerCase()}.`}
      >
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {formError ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--red-bg)] bg-danger-soft px-3 py-2 text-sm text-danger">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {formError}
              </p>
            ) : null}

            {isOther ? (
              <Field label="Document name" htmlFor="compliance-label" required error={errors.label?.message}>
                <Input {...register("label")} {...fieldAria("compliance-label", errors.label?.message)} placeholder="e.g. Workers' comp certificate" />
              </Field>
            ) : record ? null : (
              <Field label="Record type" htmlFor="compliance-kind" hint="Each operator has one record per standard check.">
                <Select id="compliance-kind" disabled value={currentKind}>
                  <option value={currentKind}>{meta.label}</option>
                </Select>
              </Field>
            )}

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">
                What do you have on file?<span className="ml-0.5 text-danger" aria-hidden>*</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-invalid={errors.status ? true : undefined}>
                {COMPLIANCE_STATUSES.map((s) => {
                  const sMeta = COMPLIANCE_STATUS_META[s];
                  const checked = status === s;
                  return (
                    <label
                      key={s}
                      className={cn(
                        "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors",
                        "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                        checked ? "border-accent-line bg-accent-soft" : "border-border hover:border-border-strong",
                      )}
                    >
                      <input
                        type="radio"
                        value={s}
                        className="sr-only"
                        {...register("status", {
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            if (e.target.value === "verified" && !getValues("verifiedOn")) setValue("verifiedOn", today);
                          },
                        })}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          checked ? "border-fg bg-fg" : "border-border-strong bg-surface",
                        )}
                      >
                        {checked ? <span className="size-1.5 rounded-full bg-surface" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                          <Dot tone={sMeta.tone} />
                          {sMeta.label}
                        </span>
                        <span className="mt-0.5 block text-xs leading-4 text-fg-muted">{sMeta.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.status?.message ? (
                <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-danger">
                  <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                  {errors.status.message}
                </p>
              ) : null}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Reference"
                htmlFor="compliance-reference"
                optional
                hint="Policy, permit or registration number."
                error={errors.reference?.message}
              >
                <Input {...register("reference")} {...fieldAria("compliance-reference", errors.reference?.message, true)} placeholder="e.g. POL-4418823" />
              </Field>
              <Field
                label="Expires on"
                htmlFor="compliance-expires"
                optional
                hint={meta.expires ? "Add it so QuoteDesk can flag the record before it lapses." : "Leave blank if it doesn't expire."}
                error={errors.expiresOn?.message}
              >
                <Input type="date" {...register("expiresOn")} {...fieldAria("compliance-expires", errors.expiresOn?.message, true)} />
              </Field>
            </div>

            {status === "verified" ? (
              <div className="rounded-lg border border-[var(--green-dot)]/40 bg-[var(--green-bg)]/40 p-3.5">
                <p className="mb-3 flex items-start gap-2 text-xs leading-5 text-fg-secondary">
                  <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--green-fg)]" />
                  Verified means someone on your team independently confirmed this record. It will be attributed to {userName}, with the date and
                  evidence below.
                </p>
                <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <Field label="Verified on" htmlFor="compliance-verified-on" required error={errors.verifiedOn?.message}>
                    <Input type="date" max={today} {...register("verifiedOn")} {...fieldAria("compliance-verified-on", errors.verifiedOn?.message)} />
                  </Field>
                  <Field label="Evidence reviewed" htmlFor="compliance-evidence" required error={errors.evidenceNote?.message}>
                    <Textarea
                      rows={2}
                      {...register("evidenceNote")}
                      {...fieldAria("compliance-evidence", errors.evidenceNote?.message)}
                      placeholder="COI received from their agent; limits and policy period confirmed by phone."
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <Field
                label="Notes"
                htmlFor="compliance-evidence"
                optional
                hint="What you were told or received, and anything still outstanding."
                error={errors.evidenceNote?.message}
              >
                <Textarea
                  rows={2}
                  {...register("evidenceNote")}
                  {...fieldAria("compliance-evidence", errors.evidenceNote?.message, true)}
                  placeholder="Owner said the policy renews in March; COI requested."
                />
              </Field>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {record ? "Save record" : "Add record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
