"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, RotateCcw } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { formatPhone } from "@/domain/contact";
import { OPERATOR_STATUSES, OPERATOR_STATUS_META, type OperatorStatus } from "@/domain/operator";
import { createOperatorSchema, updateOperatorSchema } from "@/domain/schemas/operator";
import type { OperatorRow } from "@/server/db/schema";
import { createOperatorAction, updateOperatorAction } from "@/server/actions/operators";
import { Dot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { TagInput } from "@/components/ui/tag-input";
import { newRequestId } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-helpers";

interface OperatorFormValues {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  baseLocation: string;
  serviceAreas: string[];
  status: OperatorStatus;
  notes: string;
}

const FIELDS = ["companyName", "contactName", "phone", "email", "website", "baseLocation", "serviceAreas", "status", "notes"] as const;

/** Client-side copy of the server contract (minus ids), so errors read the same in both places. */
const createFormSchema = createOperatorSchema.omit({ clientRequestId: true });
const editFormSchema = updateOperatorSchema.omit({ id: true, version: true });
type CreateOutput = z.output<typeof createFormSchema>;
type EditOutput = z.output<typeof editFormSchema>;

type EditableOperator = Pick<
  OperatorRow,
  "id" | "version" | "companyName" | "contactName" | "phone" | "email" | "website" | "baseLocation" | "serviceAreas" | "status" | "notes"
>;

export function OperatorForm({
  mode,
  operator,
  suggestedAreas,
}: {
  mode: "create" | "edit";
  operator?: EditableOperator;
  suggestedAreas: string[];
}) {
  const router = useRouter();
  const [requestId] = useState(() => newRequestId());
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OperatorFormValues, unknown, CreateOutput | EditOutput>({
    resolver: zodResolver(mode === "create" ? createFormSchema : editFormSchema) as unknown as Resolver<
      OperatorFormValues,
      unknown,
      CreateOutput | EditOutput
    >,
    defaultValues: {
      companyName: operator?.companyName ?? "",
      contactName: operator?.contactName ?? "",
      phone: operator?.phone ? formatPhone(operator.phone) : "",
      email: operator?.email ?? "",
      website: operator?.website ?? "",
      baseLocation: operator?.baseLocation ?? "",
      serviceAreas: operator?.serviceAreas ?? [],
      status: operator?.status ?? "prospect",
      notes: operator?.notes ?? "",
    },
  });
  const areas = useWatch({ control, name: "serviceAreas" });
  const status = useWatch({ control, name: "status" });
  const remainingSuggestions = suggestedAreas.filter((s) => !areas.some((a) => a.toLowerCase() === s.toLowerCase())).slice(0, 8);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setConflict(false);
    const result =
      mode === "create"
        ? await createOperatorAction({ ...values, clientRequestId: requestId })
        : await updateOperatorAction({ ...values, id: operator!.id, version: operator!.version });

    if (result.ok) {
      const id = result.data.id;
      if (mode === "create") toast.success(`${values.companyName} added to your network`);
      else toast.success("changed" in result.data && !result.data.changed ? "No changes to save" : "Operator updated");
      router.push(`/operators/${id}` as Route);
      return;
    }
    switch (result.error.code) {
      case "validation": {
        const unmapped = applyServerErrors(result.error, setError, FIELDS, (key) => (key.startsWith("serviceAreas") ? "serviceAreas" : key));
        if (unmapped.length) setFormError(unmapped[0]!);
        break;
      }
      case "conflict":
        setConflict(true);
        break;
      case "not_found":
        toast.error(result.error.message);
        router.push("/operators");
        break;
      default:
        setFormError(result.error.message);
    }
  });

  function cancel() {
    if (window.history.length > 1) router.back();
    else router.push((operator ? `/operators/${operator.id}` : "/operators") as Route);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {conflict ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[var(--amber-dot)]/50 bg-[var(--amber-bg)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--amber-fg)]" />
            <div>
              <p className="text-sm font-medium text-fg">This operator changed after you opened it</p>
              <p className="mt-0.5 text-sm text-fg-secondary">Your edits haven&apos;t been saved. Reload to see the latest details, then make your changes again.</p>
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => router.refresh()} className="shrink-0">
            <RotateCcw /> Reload latest
          </Button>
        </div>
      ) : null}
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--red-bg)] bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          {formError}
        </p>
      ) : null}

      <Card>
        <CardHeader title="Company" description="How the operator appears across QuoteDesk." />
        <CardBody className="grid gap-4 pt-0 sm:grid-cols-2">
          <Field label="Company name" htmlFor="op-company" required error={errors.companyName?.message} className="sm:col-span-2">
            <Input autoFocus={mode === "create"} {...register("companyName")} {...fieldAria("op-company", errors.companyName?.message)} placeholder="e.g. Northgate Coach & Livery" />
          </Field>
          <Field label="Base location" htmlFor="op-base" optional hint="Where their garage or office is." error={errors.baseLocation?.message}>
            <Input {...register("baseLocation")} {...fieldAria("op-base", errors.baseLocation?.message, true)} placeholder="Elk Grove Village, IL" />
          </Field>
          <Field label="Website" htmlFor="op-website" optional error={errors.website?.message}>
            <Input inputMode="url" {...register("website")} {...fieldAria("op-website", errors.website?.message)} placeholder="northgatecoach.example" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Primary contact" description="Who you call to request vehicles." />
        <CardBody className="grid gap-4 pt-0 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="op-contact" optional error={errors.contactName?.message} className="sm:col-span-2">
            <Input autoComplete="off" {...register("contactName")} {...fieldAria("op-contact", errors.contactName?.message)} placeholder="Dispatch lead or owner" />
          </Field>
          <Field label="Phone" htmlFor="op-phone" optional error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" autoComplete="off" {...register("phone")} {...fieldAria("op-phone", errors.phone?.message)} placeholder="(312) 555-0134" />
          </Field>
          <Field label="Email" htmlFor="op-email" optional error={errors.email?.message}>
            <Input type="email" inputMode="email" autoComplete="off" {...register("email")} {...fieldAria("op-email", errors.email?.message)} placeholder="dispatch@operator.example" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Coverage" description="Areas they say they serve — used to find operators for a trip." />
        <CardBody className="pt-0">
          <Field
            label="Service areas"
            htmlFor="op-areas"
            optional
            hint="Press Enter or type a comma after each area. Airports and suburbs work well as separate areas."
            error={errors.serviceAreas?.message}
          >
            <Controller
              control={control}
              name="serviceAreas"
              render={({ field }) => (
                <TagInput
                  id="op-areas"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Chicago, O'Hare (ORD), North Shore…"
                  invalid={!!errors.serviceAreas}
                  describedBy={errors.serviceAreas ? "op-areas-error" : "op-areas-hint"}
                />
              )}
            />
          </Field>
          {remainingSuggestions.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-fg-muted">Used in your network:</span>
              {remainingSuggestions.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setValue("serviceAreas", [...getValues("serviceAreas"), area], { shouldDirty: true, shouldValidate: true })}
                  className="inline-flex h-6 items-center rounded-full border border-dashed border-border-strong px-2 text-xs text-fg-secondary transition-colors hover:border-solid hover:bg-surface-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
                >
                  + {area}
                </button>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Relationship" description={mode === "create" ? "Where things stand with this operator today." : "Change the status from the operator's page."} />
        <CardBody className="space-y-4 pt-0">
          {mode === "create" ? (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">Status</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {OPERATOR_STATUSES.map((s) => {
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
                      <input type="radio" value={s} className="sr-only" {...register("status")} />
                      <Dot tone={OPERATOR_STATUS_META[s].tone} className="mt-1.5" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-fg">{OPERATOR_STATUS_META[s].label}</span>
                        <span className="block text-xs leading-4 text-fg-muted">{OPERATOR_STATUS_META[s].description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}
          <Field
            label="Relationship notes"
            htmlFor="op-notes"
            optional
            hint="Internal only. How they communicate, what they're great at, anything to watch for."
            error={errors.notes?.message}
          >
            <Textarea rows={4} {...register("notes")} {...fieldAria("op-notes", errors.notes?.message, true)} />
          </Field>
        </CardBody>
      </Card>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-raised/95 px-4 py-3 shadow-md backdrop-blur lg:bottom-4">
        <p className="hidden text-sm text-fg-muted sm:block">
          {mode === "create" ? "Fleet and verification records can be added after saving." : isDirty ? "You have unsaved changes." : "No changes yet."}
        </p>
        <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
          <Button type="button" variant="secondary" onClick={cancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {mode === "create" ? "Add operator" : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
