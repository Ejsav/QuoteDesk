"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowUpRight, Plus, RotateCcw, UserRoundSearch } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch, type Path, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { formatPhone, normalizeEmail, normalizePhone } from "@/domain/contact";
import { CONTACT_METHOD_LABELS, type ContactMethod } from "@/domain/customer";
import { createCustomerSchema, updateCustomerSchema } from "@/domain/schemas/customer";
import type { DuplicateMatchView } from "@/lib/action-result";
import { newRequestId } from "@/lib/ids";
import { cn, pluralize } from "@/lib/utils";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/customers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";

export interface EditableCustomer {
  id: string;
  version: number;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: ContactMethod | null;
  notes: string | null;
}

/** Form shape shared by create and edit; the resolver is the server's own schema. */
interface FormInput {
  fullName: string;
  companyName: string;
  phone: string;
  email: string;
  preferredContact: ContactMethod | null;
  notes: string;
  confirmDuplicate: boolean;
  clientRequestId?: string;
  id?: string;
  version?: number;
}

interface FormOutput {
  fullName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  preferredContact: ContactMethod | null;
  notes: string | null;
  confirmDuplicate: boolean;
  clientRequestId?: string;
  id?: string;
  version?: number;
}

const FORM_FIELDS = new Set(["fullName", "companyName", "phone", "email", "preferredContact", "notes"]);

type Banner = { kind: "conflict" | "not_found" | "error"; message: string };

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  customer?: EditableCustomer;
}) {
  const editing = !!customer;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? "Edit customer" : "New customer"}
        description={
          editing
            ? "Changes apply everywhere this customer appears, including all of their inquiries."
            : "One record per person or organization — their inquiries stay connected over time."
        }
      >
        {open ? <CustomerForm customer={customer} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function completePhone(value: string): string | null {
  const result = normalizePhone(value);
  return result.ok ? result.e164 : null;
}

function completeEmail(value: string): string | null {
  const v = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? v : null;
}

function CustomerForm({ customer, onDone }: { customer?: EditableCustomer; onDone: () => void }) {
  const router = useRouter();
  const editing = !!customer;
  // One idempotency key per open form: a double submit returns the same record.
  const [requestId] = useState(() => newRequestId());
  const [banner, setBanner] = useState<Banner | null>(null);
  const [duplicates, setDuplicates] = useState<{ matches: DuplicateMatchView[]; values: FormOutput } | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [hint, setHint] = useState<{ key: string; matches: DuplicateMatchView[] } | null>(null);

  const resolver = (editing ? zodResolver(updateCustomerSchema) : zodResolver(createCustomerSchema)) as unknown as Resolver<
    FormInput,
    unknown,
    FormOutput
  >;

  const {
    register,
    handleSubmit,
    control,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver,
    defaultValues: {
      fullName: customer?.fullName ?? "",
      companyName: customer?.companyName ?? "",
      phone: formatPhone(customer?.phone) ?? "",
      email: customer?.email ?? "",
      preferredContact: customer?.preferredContact ?? null,
      notes: customer?.notes ?? "",
      confirmDuplicate: false,
      ...(customer ? { id: customer.id, version: customer.version } : { clientRequestId: requestId }),
    },
  });

  const phone = useWatch({ control, name: "phone" }) ?? "";
  const email = useWatch({ control, name: "email" }) ?? "";

  // Live, read-only duplicate hint for complete contact details that changed.
  const hintPhone = completePhone(phone);
  const hintEmail = completeEmail(email);
  const checkPhone = hintPhone && hintPhone !== customer?.phone ? hintPhone : null;
  const checkEmail = hintEmail && hintEmail !== customer?.email ? hintEmail : null;
  const hintKey = checkPhone || checkEmail ? `${checkPhone ?? ""}|${checkEmail ?? ""}` : null;

  useEffect(() => {
    if (!hintKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      if (checkPhone) params.set("phone", checkPhone);
      if (checkEmail) params.set("email", checkEmail);
      if (customer) params.set("exclude", customer.id);
      try {
        const res = await fetch(`/api/customers/duplicates?${params}`, { signal: controller.signal });
        if (!res.ok) return;
        setHint({ key: hintKey, matches: (await res.json()) as DuplicateMatchView[] });
      } catch {
        // Hints are best-effort; the server re-checks on save.
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hintKey, checkPhone, checkEmail, customer]);

  const visibleHint = hint && hint.key === hintKey ? hint.matches : [];

  async function save(values: FormOutput, confirmDuplicate: boolean) {
    setBanner(null);
    const payload = { ...values, confirmDuplicate };
    const result = editing ? await updateCustomerAction(payload) : await createCustomerAction(payload);

    if (result.ok) {
      const data = result.data;
      if (editing) {
        toast.success("changed" in data && !data.changed ? "No changes to save" : "Customer updated");
        onDone();
      } else {
        toast.success(`${values.fullName} added to customers`);
        onDone();
        router.push(`/customers/${data.id}` as Route);
      }
      return;
    }

    const { error } = result;
    switch (error.code) {
      case "duplicate":
        setDuplicates({ matches: error.duplicates ?? [], values });
        return;
      case "validation": {
        let focused = false;
        const unmapped: string[] = [];
        for (const [key, messages] of Object.entries(error.fieldErrors ?? {})) {
          if (FORM_FIELDS.has(key)) {
            setError(key as Path<FormInput>, { type: "server", message: messages[0] });
            if (!focused) {
              setFocus(key as Path<FormInput>);
              focused = true;
            }
          } else {
            unmapped.push(...messages);
          }
        }
        setDuplicates(null);
        if (unmapped.length > 0 || !focused) setBanner({ kind: "error", message: unmapped[0] ?? error.message });
        return;
      }
      case "conflict":
        setDuplicates(null);
        setBanner({ kind: "conflict", message: error.message });
        return;
      case "not_found":
        setDuplicates(null);
        setBanner({ kind: "not_found", message: error.message });
        return;
      default:
        setDuplicates(null);
        setBanner({ kind: "error", message: error.message });
    }
  }

  const onSubmit = handleSubmit((values) => save(values, false));

  async function saveAnyway() {
    if (!duplicates) return;
    setResubmitting(true);
    try {
      await save(duplicates.values, true);
    } finally {
      setResubmitting(false);
    }
  }

  const pending = isSubmitting || resubmitting;
  const phoneFilled = phone.trim() !== "";
  const emailFilled = email.trim() !== "";
  const contactError = errors.phone?.message;

  if (duplicates) {
    const single = duplicates.matches.length === 1 ? duplicates.matches[0] : null;
    return (
      <>
        <DialogBody>
          <div role="alert" className="tone-amber flex gap-3 rounded-lg border border-[var(--tone-dot)]/35 bg-[var(--tone-bg)] p-3.5">
            <UserRoundSearch aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
            <div className="text-sm">
              <p className="font-semibold text-fg">Possible duplicate</p>
              <p className="mt-0.5 text-fg-secondary">
                {single ? "An existing customer" : `${duplicates.matches.length} existing customers`} share these contact details. Two records for
                one person splits their inquiry history — check before {editing ? "saving" : "creating a second record"}.
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-border-subtle rounded-lg border border-border">
            {duplicates.matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={m.fullName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-fg">
                    {m.fullName}
                    {m.companyName ? <span className="font-normal text-fg-muted"> · {m.companyName}</span> : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {[formatPhone(m.phone), m.email].filter(Boolean).join(" · ")} · {pluralize(m.leadCount, "inquiry", "inquiries")}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.matchedOn.map((field) => (
                      <Badge key={field} tone="amber" size="sm">
                        Same {field}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/customers/${m.id}` as Route} onClick={onDone}>
                    Open <ArrowUpRight />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
          {banner ? <FormBanner banner={banner} /> : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setDuplicates(null)} disabled={pending} className="sm:mr-auto">
            Back to editing
          </Button>
          {single && !editing ? (
            <Button variant="secondary" disabled={pending} onClick={() => (onDone(), router.push(`/customers/${single.id}` as Route))}>
              Use existing customer
            </Button>
          ) : null}
          <Button variant="primary" loading={resubmitting} disabled={pending} onClick={saveAnyway}>
            {editing ? "Save anyway" : "Create anyway"}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="space-y-4">
        {banner ? <FormBanner banner={banner} onReload={() => (router.refresh(), onDone())} /> : null}

        <Field label="Full name" htmlFor="customer-fullName" required error={errors.fullName?.message}>
          <Input
            {...register("fullName")}
            {...fieldAria("customer-fullName", errors.fullName?.message)}
            autoComplete="off"
            autoFocus
            placeholder="e.g. Sarah Chen"
          />
        </Field>

        <Field label="Company" htmlFor="customer-companyName" optional error={errors.companyName?.message}>
          <Input
            {...register("companyName")}
            {...fieldAria("customer-companyName", errors.companyName?.message)}
            autoComplete="off"
            placeholder="For corporate clients, planners and venues"
          />
        </Field>

        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="customer-phone" error={contactError}>
              <Input
                {...register("phone")}
                {...fieldAria("customer-phone", contactError, true)}
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(312) 555-0147"
              />
            </Field>
            <Field label="Email" htmlFor="customer-email" error={errors.email?.message}>
              <Input
                {...register("email")}
                {...fieldAria("customer-email", errors.email?.message)}
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="name@example.com"
              />
            </Field>
          </div>
          {!contactError ? (
            <p id="customer-phone-hint" className="mt-1.5 text-xs text-fg-muted">
              Add at least one way to reach them. Phone numbers are saved in a standard format so duplicates can be spotted.
            </p>
          ) : null}
          {visibleHint.length > 0 ? (
            <div aria-live="polite" className="mt-2.5 rounded-lg border border-border bg-surface-sunken px-3 py-2.5 text-sm">
              <p className="flex items-center gap-1.5 font-medium text-fg">
                <UserRoundSearch aria-hidden className="size-3.5 text-[var(--amber-fg)]" />
                {visibleHint.length === 1 ? "Possible match" : `${visibleHint.length} possible matches`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {visibleHint.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 text-fg-secondary">
                    <span className="min-w-0 truncate">
                      {m.fullName}
                      <span className="text-fg-muted"> — same {m.matchedOn.join(" & ")}</span>
                    </span>
                    <Link
                      href={`/customers/${m.id}` as Route}
                      onClick={onDone}
                      className="shrink-0 text-xs font-medium text-fg underline-offset-2 hover:underline"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <Field
          label="Preferred contact"
          htmlFor="customer-preferredContact"
          optional
          error={errors.preferredContact?.message}
          hint={!phoneFilled && !emailFilled ? "Add a phone number or email to choose a preference." : undefined}
        >
          <Select
            {...register("preferredContact", { setValueAs: (v: string) => (v === "" ? null : v) })}
            {...fieldAria("customer-preferredContact", errors.preferredContact?.message, !phoneFilled && !emailFilled)}
          >
            <option value="">No preference</option>
            <option value="phone" disabled={!phoneFilled}>
              {CONTACT_METHOD_LABELS.phone}
            </option>
            <option value="text" disabled={!phoneFilled}>
              {CONTACT_METHOD_LABELS.text}
            </option>
            <option value="email" disabled={!emailFilled}>
              {CONTACT_METHOD_LABELS.email}
            </option>
          </Select>
        </Field>

        <Field label="Notes" htmlFor="customer-notes" optional error={errors.notes?.message} hint="Internal only — preferences, billing contacts, VIP details.">
          <Textarea {...register("notes")} {...fieldAria("customer-notes", errors.notes?.message, true)} rows={3} />
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {editing ? "Save changes" : "Create customer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function FormBanner({ banner, onReload }: { banner: Banner; onReload?: () => void }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-2.5 rounded-lg border p-3 text-sm",
        banner.kind === "error" ? "tone-red border-[var(--tone-dot)]/30 bg-[var(--tone-bg)]" : "tone-amber border-[var(--tone-dot)]/35 bg-[var(--tone-bg)]",
      )}
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
      <div className="min-w-0 flex-1">
        <p className="text-fg">{banner.message}</p>
        {banner.kind === "conflict" && onReload ? (
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={onReload}>
            <RotateCcw /> Reload latest
          </Button>
        ) : null}
        {banner.kind === "not_found" ? (
          <Link href="/customers" className="mt-1 inline-block text-sm font-medium text-fg underline underline-offset-2">
            Back to customers
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * "New customer" button. Also opens when the page is reached via
 * `/customers?new=1` (the command palette). The param is consumed as soon as
 * the dialog opens, so a refresh or back-navigation never reopens it and
 * closing the dialog never races a navigation to the new profile.
 */
export function NewCustomerButton({ autoOpen = false, closeHref }: { autoOpen?: boolean; closeHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [seenAutoOpen, setSeenAutoOpen] = useState(false);

  // Adjust state when the URL asks for the dialog (works even if this page is already mounted).
  if (autoOpen && !seenAutoOpen) {
    setSeenAutoOpen(true);
    setOpen(true);
  } else if (!autoOpen && seenAutoOpen) {
    setSeenAutoOpen(false);
  }

  useEffect(() => {
    if (autoOpen) router.replace(closeHref as Route, { scroll: false });
  }, [autoOpen, closeHref, router]);

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Plus /> New customer
      </Button>
      <CustomerFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
