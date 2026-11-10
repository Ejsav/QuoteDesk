"use client";

import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, CircleDashed, History, Plus, Trash2, TriangleAlert, UserRoundSearch, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch, type FieldErrors, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { formatPhone } from "@/domain/contact";
import { CONTACT_METHODS, CONTACT_METHOD_LABELS } from "@/domain/customer";
import { COMMON_TIME_ZONES, timeZoneLabel, type PlainDate } from "@/domain/dates";
import {
  LEAD_PRIORITIES,
  LEAD_PRIORITY_META,
  LEAD_SOURCES,
  LEAD_SOURCE_LABELS,
  OCCASIONS,
  OCCASION_LABELS,
  SERVICE_TYPES,
  SERVICE_TYPE_META,
  evaluateReadiness,
  followUpPresets,
  formatLeadNumber,
  type LeadStatus,
} from "@/domain/lead";
import { VEHICLE_CATEGORIES, VEHICLE_CATEGORY_META } from "@/domain/vehicle";
import type { DuplicateMatchView } from "@/lib/action-result";
import { newRequestId } from "@/lib/ids";
import { cn } from "@/lib/utils";
import { createLeadAction, updateLeadAction } from "@/server/actions/leads";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { CustomerPicker, CustomerSummaryCard, type CustomerSummary } from "./customer-picker";
import { FIELD_ORDER, buildLeadInput, mapServerFieldErrors, type FormErrors, type LeadFormValues } from "./lead-form-model";

const DRAFT_KEY = "quotedesk:draft:new-lead:v1";

interface LeadFormProps {
  mode: "create" | "edit";
  defaultValues: LeadFormValues;
  initialCustomer: CustomerSummary | null;
  businessTimeZone: string;
  today: PlainDate;
  lead?: { id: string; number: number; version: number; status: LeadStatus };
}

function toRhfErrors(flat: FormErrors): FieldErrors<LeadFormValues> {
  const out: Record<string, unknown> = {};
  for (const [path, message] of Object.entries(flat)) {
    const parts = path.split(".");
    let node = out as Record<string | number, unknown>;
    parts.forEach((part, i) => {
      const key = /^\d+$/.test(part) ? Number(part) : part;
      if (i === parts.length - 1) {
        node[key] = { type: "validate", message };
      } else {
        if (!node[key]) node[key] = /^\d+$/.test(parts[i + 1] ?? "") ? [] : {};
        node = node[key] as Record<string | number, unknown>;
      }
    });
  }
  return out as FieldErrors<LeadFormValues>;
}

function errorAt(errors: FieldErrors<LeadFormValues>, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split(".")) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node && typeof node === "object" && "message" in node ? String((node as { message?: unknown }).message ?? "") || undefined : undefined;
}

function Section({ title, description, children, id }: { title: string; description?: string; children: React.ReactNode; id?: string }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} />
      <CardBody className="grid gap-4 sm:grid-cols-2">{children}</CardBody>
    </Card>
  );
}

export function LeadForm({ mode, defaultValues, initialCustomer, businessTimeZone, today, lead }: LeadFormProps) {
  const router = useRouter();
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [customer, setCustomer] = useState<CustomerSummary | null>(initialCustomer);
  const [duplicates, setDuplicates] = useState<DuplicateMatchView[] | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [showZone, setShowZone] = useState(defaultValues.timeZone !== businessTimeZone);
  const [done, setDone] = useState(false);
  const qualified = lead?.status === "qualified";

  const resolver = useCallback<Resolver<LeadFormValues>>(
    async (values) => {
      const result = buildLeadInput(values, {
        mode,
        clientRequestId: requestId,
        leadId: lead?.id,
        version: lead?.version,
      });
      return result.ok ? { values, errors: {} } : { values: {}, errors: toRhfErrors(result.errors) };
    },
    [mode, requestId, lead?.id, lead?.version],
  );

  const form = useForm<LeadFormValues>({ defaultValues, resolver, mode: "onSubmit", reValidateMode: "onChange" });
  const { register, control, setValue, setError, setFocus, handleSubmit, reset, formState } = form;
  const errors = formState.errors;
  const stops = useFieldArray({ control, name: "stops" });
  const values = useWatch({ control }) as LeadFormValues;

  // ---- Draft persistence (new inquiries only) -------------------------------
  const restoredOnce = useRef(false);
  useEffect(() => {
    if (mode !== "create" || restoredOnce.current) return;
    restoredOnce.current = true;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { values?: LeadFormValues; requestId?: string; customer?: CustomerSummary | null };
      if (!draft.values || !draft.requestId) return;
      const prefilled = initialCustomer && draft.values.customerId !== initialCustomer.id;
      if (prefilled) return; // a fresh "New inquiry for X" wins over an unrelated draft
      reset({ ...defaultValues, ...draft.values });
      queueMicrotask(() => {
        setRequestId(draft.requestId!);
        setCustomer(draft.customer ?? null);
        setDraftRestored(true);
        if (draft.values!.timeZone !== businessTimeZone) setShowZone(true);
      });
    } catch {
      // Unreadable draft — ignore it.
    }
  }, [mode, reset, defaultValues, initialCustomer, businessTimeZone]);

  useEffect(() => {
    if (mode !== "create" || done) return;
    const timer = setTimeout(() => {
      try {
        if (formState.isDirty) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ values, requestId, customer, savedAt: Date.now() }));
      } catch {
        // Storage full or blocked — drafts are a convenience.
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [mode, values, requestId, customer, formState.isDirty, done]);

  function discardDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
    reset(defaultValues);
    setCustomer(initialCustomer);
    setRequestId(newRequestId());
    setDraftRestored(false);
  }

  // ---- Unsaved-changes guard (edit) -----------------------------------------
  useEffect(() => {
    if (mode !== "edit" || !formState.isDirty || done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mode, formState.isDirty, done]);

  // ---- Live duplicate hints for a new customer ------------------------------
  const [hints, setHints] = useState<{ key: string; rows: DuplicateMatchView[] } | null>(null);
  const hintKey = values.customerMode === "new" ? `${values.newCustomer?.phone ?? ""}|${values.newCustomer?.email ?? ""}` : "";
  useEffect(() => {
    if (!hintKey || hintKey === "|") return;
    const [phone, email] = hintKey.split("|");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ phone: phone ?? "", email: email ?? "" });
        const res = await fetch(`/api/customers/duplicates?${qs}`, { signal: controller.signal });
        if (res.ok) setHints({ key: hintKey, rows: (await res.json()) as DuplicateMatchView[] });
      } catch {
        // Hints are best-effort; the server re-checks on submit.
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [hintKey]);
  const liveMatches = hints && hints.key === hintKey ? hints.rows : [];

  // ---- Customer selection ---------------------------------------------------
  function chooseCustomer(c: CustomerSummary) {
    setCustomer(c);
    setValue("customerMode", "existing", { shouldDirty: true });
    setValue("customerId", c.id, { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }

  function startNewCustomer(prefillName = "") {
    setValue("customerMode", "new", { shouldDirty: true });
    if (prefillName) setValue("newCustomer.fullName", prefillName, { shouldDirty: true });
    setTimeout(() => setFocus("newCustomer.fullName"), 0);
  }

  // ---- Submit ---------------------------------------------------------------
  const applyErrors = useCallback(
    (flat: FormErrors) => {
      const entries = Object.entries(flat);
      for (const [path, message] of entries) setError(path as never, { type: "server", message });
      const first = FIELD_ORDER.find((f) => flat[f]) ?? entries[0]?.[0];
      if (first) {
        try {
          setFocus(first as never);
        } catch {
          document.getElementById(first)?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
    },
    [setError, setFocus],
  );

  async function submitValues(v: LeadFormValues, confirmDuplicate = false) {
    setFormMessage(null);
    const built = buildLeadInput(v, { mode, clientRequestId: requestId, confirmDuplicate, leadId: lead?.id, version: lead?.version });
    if (!built.ok) {
      applyErrors(built.errors);
      return;
    }
    if (mode === "create") {
      const result = await createLeadAction(built.input);
      if (result.ok) {
        setDone(true);
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
        const ref = formatLeadNumber(result.data.number);
        toast.success(result.data.created ? `Inquiry ${ref} created` : `${ref} was already saved — opening it`);
        router.push(`/leads/${result.data.id}` as Route);
        return;
      }
      handleError(result.error, v);
      return;
    }
    const result = await updateLeadAction(built.input);
    if (result.ok) {
      setDone(true);
      toast.success(result.data.changed ? "Changes saved" : "No changes to save");
      router.push(`/leads/${lead!.id}` as Route);
      return;
    }
    handleError(result.error, v);
  }

  function handleError(error: { code: string; message: string; fieldErrors?: Record<string, string[]>; duplicates?: DuplicateMatchView[] }, v: LeadFormValues) {
    switch (error.code) {
      case "duplicate":
        setDuplicates(error.duplicates ?? []);
        return;
      case "conflict":
        setConflict(error.message);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      case "validation":
        if (error.fieldErrors && Object.keys(error.fieldErrors).length > 0) {
          applyErrors(mapServerFieldErrors(error.fieldErrors, v));
          setFormMessage(error.message);
        } else {
          setFormMessage(error.message);
        }
        return;
      default:
        setFormMessage(error.message);
        toast.error(error.message);
    }
  }

  const onSubmit = handleSubmit((v) => submitValues(v));
  const submitting = formState.isSubmitting || done;

  // ---- Derived --------------------------------------------------------------
  const readiness = useMemo(() => {
    const exact = values.passengersMode === "exact" && /^\d+$/.test(values.passengersExact ?? "");
    const range = values.passengersMode === "range" && /^\d+$/.test(values.passengersMin ?? "");
    return evaluateReadiness({
      tripDate: values.tripDate || null,
      pickupLocation: values.pickupLocation?.trim() || null,
      passengersMin: exact || range ? 1 : null,
      pickupTime: values.pickupTime || null,
      destination: values.destination?.trim() || null,
      serviceType: values.serviceType || null,
      vehicleCategory: values.vehicleCategory || null,
      durationMinutes: values.durationHours?.trim() ? 1 : null,
    });
  }, [values]);

  const err = (path: string) => errorAt(errors, path);
  const pastTrip = values.tripDate && values.tripDate < today;
  const zoneOptions = COMMON_TIME_ZONES.some((z) => z.id === values.timeZone)
    ? COMMON_TIME_ZONES
    : [...COMMON_TIME_ZONES, { id: values.timeZone, label: timeZoneLabel(values.timeZone) }];

  const submitLabel = mode === "create" ? "Create inquiry" : "Save changes";
  const cancelHref = (mode === "edit" && lead ? `/leads/${lead.id}` : "/leads") as Route;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
      <div className="min-w-0 space-y-5">
        {draftRestored ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-xs">
            <p className="flex items-center gap-2 text-fg-secondary">
              <History aria-hidden className="size-4 text-fg-muted" />
              Restored your unsaved draft from this browser session.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={discardDraft}>
              Discard draft
            </Button>
          </div>
        ) : null}
        {conflict ? (
          <div role="alert" className="tone-amber flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[var(--tone-bg)] px-4 py-3 text-sm">
            <p className="flex items-start gap-2 text-fg">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-[var(--tone-fg)]" />
              <span>
                <span className="font-semibold">{conflict}</span>
                <span className="block text-fg-secondary">Copy anything you need from this form first — reloading replaces it with the latest version.</span>
              </span>
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload latest
            </Button>
          </div>
        ) : null}

        {/* Customer ------------------------------------------------------- */}
        <Section
          title="Customer"
          description={mode === "create" ? "Who's asking? Pick an existing customer or add a new one." : "Reassigning moves this inquiry to another customer's record."}
        >
          <div className="sm:col-span-2">
            {values.customerMode === "new" && mode === "create" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-fg">New customer</p>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue("customerMode", "existing", { shouldDirty: true })}>
                    <UserRoundSearch /> Choose existing instead
                  </Button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="newCustomer.fullName" required error={err("newCustomer.fullName")}>
                    <Input autoComplete="off" {...register("newCustomer.fullName")} {...fieldAria("newCustomer.fullName", err("newCustomer.fullName"))} />
                  </Field>
                  <Field label="Company or organization" htmlFor="newCustomer.companyName" optional error={err("newCustomer.companyName")}>
                    <Input autoComplete="off" {...register("newCustomer.companyName")} {...fieldAria("newCustomer.companyName", err("newCustomer.companyName"))} />
                  </Field>
                  <Field label="Phone" htmlFor="newCustomer.phone" error={err("newCustomer.phone")} hint="US numbers in any format, or +country code">
                    <Input type="tel" inputMode="tel" autoComplete="off" placeholder="(312) 555-0147" {...register("newCustomer.phone")} {...fieldAria("newCustomer.phone", err("newCustomer.phone"), true)} />
                  </Field>
                  <Field label="Email" htmlFor="newCustomer.email" error={err("newCustomer.email")}>
                    <Input type="email" inputMode="email" autoComplete="off" placeholder="name@example.com" {...register("newCustomer.email")} {...fieldAria("newCustomer.email", err("newCustomer.email"))} />
                  </Field>
                  <Field label="Preferred contact" htmlFor="newCustomer.preferredContact" optional error={err("newCustomer.preferredContact")}>
                    <Select {...register("newCustomer.preferredContact")} {...fieldAria("newCustomer.preferredContact", err("newCustomer.preferredContact"))}>
                      <option value="">No preference recorded</option>
                      {CONTACT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {CONTACT_METHOD_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="self-end text-xs leading-5 text-fg-muted sm:pb-2">A phone number or an email is required. Possible duplicates are flagged before anything is saved.</p>
                </div>
                {liveMatches.length > 0 ? (
                  <div className="tone-amber rounded-lg bg-[var(--tone-bg)] p-3">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--tone-fg)]">
                      <CircleAlert aria-hidden className="size-4" />
                      {liveMatches.length === 1 ? "This might be an existing customer" : "These might be existing customers"}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {liveMatches.map((m) => (
                        <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface px-3 py-2">
                          <span className="min-w-0 text-sm">
                            <span className="font-medium text-fg">{m.fullName}</span>
                            <span className="text-fg-muted">
                              {" "}
                              · same {m.matchedOn.join(" & ")} · {m.leadCount} {m.leadCount === 1 ? "inquiry" : "inquiries"}
                            </span>
                          </span>
                          <Button
                            type="button"
                            size="xs"
                            variant="secondary"
                            onClick={() => chooseCustomer({ id: m.id, fullName: m.fullName, companyName: m.companyName, email: m.email, phone: m.phone, leadCount: m.leadCount })}
                          >
                            Use this customer
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <Field label={mode === "create" ? "Customer" : "Customer"} htmlFor="customerId" required error={err("customerId")}>
                <CustomerPicker
                  id="customerId"
                  value={customer}
                  invalid={!!err("customerId")}
                  onSelect={chooseCustomer}
                  onCreateNew={mode === "create" ? startNewCustomer : undefined}
                />
                {mode === "create" && !customer ? (
                  <button type="button" onClick={() => startNewCustomer()} className="mt-1 self-start text-sm font-medium text-fg-secondary underline-offset-2 hover:text-fg hover:underline">
                    + New customer
                  </button>
                ) : null}
              </Field>
            )}
          </div>
        </Section>

        {/* Trip ----------------------------------------------------------- */}
        <Section title="Trip" description="Record only what the customer has told you — leave the rest blank.">
          <Field label="Occasion" htmlFor="occasion" optional error={err("occasion")}>
            <Select {...register("occasion")} {...fieldAria("occasion", err("occasion"))}>
              <option value="">Not specified</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Event name" htmlFor="eventName" optional error={err("eventName")}>
            <Input placeholder="e.g. Chen–Alvarez Wedding" {...register("eventName")} {...fieldAria("eventName", err("eventName"))} />
          </Field>
          <Field label="Service type" htmlFor="serviceType" className="sm:col-span-2" error={err("serviceType")}>
            <Segmented
              id="serviceType"
              ariaLabel="Service type"
              value={values.serviceType || "unknown"}
              onChange={(v) => setValue("serviceType", v === "unknown" ? "" : (v as LeadFormValues["serviceType"]), { shouldDirty: true })}
              options={[...SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_TYPE_META[s].label })), { value: "unknown", label: "Not sure yet" }]}
            />
          </Field>
          <Field
            label="Trip date"
            htmlFor="tripDate"
            required={qualified}
            optional={!qualified}
            error={err("tripDate")}
            hint={pastTrip ? "This date has passed — fine if you're recording an older inquiry." : "Leave blank if the customer hasn't picked a date."}
          >
            <Input type="date" {...register("tripDate")} {...fieldAria("tripDate", err("tripDate"), true)} />
          </Field>
          <Field label="Pickup time" htmlFor="pickupTime" optional error={err("pickupTime")} hint={`Local time at pickup · ${timeZoneLabel(values.timeZone)}`}>
            <Input type="time" step={300} {...register("pickupTime")} {...fieldAria("pickupTime", err("pickupTime"), true)} />
          </Field>
          <div className="sm:col-span-2">
            {showZone ? (
              <Field label="Trip time zone" htmlFor="timeZone" error={err("timeZone")} hint="Times are stored exactly as requested, in this zone.">
                <Select {...register("timeZone")} {...fieldAria("timeZone", err("timeZone"), true)}>
                  {zoneOptions.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.label} ({z.id})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="text-xs text-fg-muted">
                Times are local to <span className="font-medium text-fg-secondary">{timeZoneLabel(values.timeZone)}</span>.{" "}
                <button type="button" onClick={() => setShowZone(true)} className="font-medium text-fg-secondary underline-offset-2 hover:text-fg hover:underline">
                  Trip in another time zone?
                </button>
              </p>
            )}
          </div>
          <Field
            label="Duration"
            htmlFor="durationHours"
            optional
            error={err("durationHours")}
            hint={values.serviceType === "hourly" ? "Hours of service the customer wants" : "Approximate — if known"}
          >
            <Input type="text" inputMode="decimal" placeholder="e.g. 5" trailing={<span className="pr-1 text-xs">hours</span>} {...register("durationHours")} {...fieldAria("durationHours", err("durationHours"), true)} />
          </Field>
        </Section>

        {/* Route ---------------------------------------------------------- */}
        <Section title="Route">
          <Field label="Pickup location" htmlFor="pickupLocation" required={qualified} optional={!qualified} className="sm:col-span-2" error={err("pickupLocation")}>
            <Input placeholder="Address, venue, hotel or airport" {...register("pickupLocation")} {...fieldAria("pickupLocation", err("pickupLocation"))} />
          </Field>
          {stops.fields.length > 0 ? (
            <div className="space-y-2 sm:col-span-2">
              {stops.fields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-2 rounded-lg border border-border-subtle bg-surface-sunken/60 p-2.5">
                  <span className="mt-2 w-12 shrink-0 text-xs font-medium text-fg-muted">Stop {index + 1}</span>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div>
                      <label htmlFor={`stops.${index}.location`} className="sr-only">
                        Stop {index + 1} location
                      </label>
                      <Input
                        placeholder="Location"
                        {...register(`stops.${index}.location` as const)}
                        {...fieldAria(`stops.${index}.location`, err(`stops.${index}.location`))}
                      />
                      {err(`stops.${index}.location`) ? (
                        <p id={`stops.${index}.location-error`} className="mt-1 text-xs text-danger">
                          {err(`stops.${index}.location`)}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <label htmlFor={`stops.${index}.note`} className="sr-only">
                        Stop {index + 1} note
                      </label>
                      <Input id={`stops.${index}.note`} placeholder="Note (optional)" {...register(`stops.${index}.note` as const)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5 sm:flex-row">
                    <Button type="button" variant="ghost" size="icon-sm" aria-label={`Move stop ${index + 1} up`} disabled={index === 0} onClick={() => stops.move(index, index - 1)}>
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move stop ${index + 1} down`}
                      disabled={index === stops.fields.length - 1}
                      onClick={() => stops.move(index, index + 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button type="button" variant="danger-ghost" size="icon-sm" aria-label={`Remove stop ${index + 1}`} onClick={() => stops.remove(index)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="button" variant="secondary" size="sm" disabled={stops.fields.length >= 10} onClick={() => stops.append({ location: "", note: "" })}>
              <Plus /> Add a stop
            </Button>
          </div>
          <Field
            label="Destination"
            htmlFor="destination"
            optional
            className="sm:col-span-2"
            error={err("destination")}
            hint={values.serviceType === "hourly" ? "Optional for hourly charters that run as directed." : undefined}
          >
            <Input placeholder="Address, venue, hotel or airport" {...register("destination")} {...fieldAria("destination", err("destination"), values.serviceType === "hourly")} />
          </Field>
        </Section>

        {/* Group & vehicle ------------------------------------------------ */}
        <Section title="Group & vehicle">
          <Field
            label="Passengers"
            htmlFor="passengersMode"
            required={qualified}
            optional={!qualified}
            className="sm:col-span-2"
            error={err("passengersExact") ?? err("passengersMin") ?? err("passengersMax")}
            hint="Use a range when the group size isn't final."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                id="passengersMode"
                ariaLabel="How many passengers are known"
                value={values.passengersMode}
                onChange={(v) => setValue("passengersMode", v, { shouldDirty: true })}
                options={[
                  { value: "exact", label: "Exact" },
                  { value: "range", label: "Range" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
              {values.passengersMode === "exact" ? (
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="18"
                  className="w-24"
                  aria-label="Exact passenger count"
                  {...register("passengersExact")}
                  {...fieldAria("passengersExact", err("passengersExact"))}
                />
              ) : values.passengersMode === "range" ? (
                <div className="flex items-center gap-2">
                  <Input type="text" inputMode="numeric" placeholder="20" className="w-20" aria-label="Fewest passengers" {...register("passengersMin")} {...fieldAria("passengersMin", err("passengersMin"))} />
                  <span className="text-sm text-fg-muted">to</span>
                  <Input type="text" inputMode="numeric" placeholder="25" className="w-20" aria-label="Most passengers" {...register("passengersMax")} {...fieldAria("passengersMax", err("passengersMax"))} />
                </div>
              ) : (
                <span className="text-sm text-fg-muted">The customer doesn&apos;t know yet</span>
              )}
            </div>
          </Field>
          <Field label="Vehicle preference" htmlFor="vehicleCategory" optional error={err("vehicleCategory")}>
            <Select {...register("vehicleCategory")} {...fieldAria("vehicleCategory", err("vehicleCategory"))}>
              <option value="">Not discussed yet</option>
              <option value="no_preference">No preference</option>
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {VEHICLE_CATEGORY_META[c].label} · {VEHICLE_CATEGORY_META[c].typicalCapacity.join("–")} pax
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stated budget" htmlFor="budget" optional error={err("budget")} hint="The customer's figure — not a price or quote.">
            <Input type="text" inputMode="decimal" placeholder="1,500" leading="$" {...register("budget")} {...fieldAria("budget", err("budget"), true)} />
          </Field>
        </Section>

        {/* Lead details --------------------------------------------------- */}
        <Section title="Lead details">
          <Field label="Source" htmlFor="source" required error={err("source")}>
            <Select {...register("source")} {...fieldAria("source", err("source"))}>
              <option value="">How did this inquiry come in?</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="priority">
            <Segmented
              id="priority"
              ariaLabel="Priority"
              value={values.priority}
              onChange={(v) => setValue("priority", v, { shouldDirty: true })}
              options={[...LEAD_PRIORITIES].map((p) => ({ value: p, label: LEAD_PRIORITY_META[p].label }))}
            />
          </Field>
          {mode === "create" ? (
            <Field
              label="Starting status"
              htmlFor="initialStatus"
              className="sm:col-span-2"
              error={err("initialStatus")}
              hint="Already spoke with them? Start as Contacted. Qualified needs a trip date, pickup and passenger count."
            >
              <Segmented
                id="initialStatus"
                ariaLabel="Starting status"
                value={values.initialStatus}
                onChange={(v) => setValue("initialStatus", v, { shouldDirty: true })}
                options={[
                  { value: "new", label: "New" },
                  { value: "contacted", label: "Contacted" },
                  { value: "qualified", label: "Qualified" },
                ]}
              />
            </Field>
          ) : null}
        </Section>

        {/* Follow-up & notes ---------------------------------------------- */}
        <Section title="Follow-up & notes" id="notes">
          <Field label="Follow-up date" htmlFor="followUpDate" optional error={err("followUpDate")}>
            <Input type="date" min={values.followUpDate && values.followUpDate < today ? undefined : today} {...register("followUpDate")} {...fieldAria("followUpDate", err("followUpDate"))} />
          </Field>
          <Field label="Next step" htmlFor="followUpNote" optional error={err("followUpNote")}>
            <Input placeholder="e.g. Send vehicle options" {...register("followUpNote")} {...fieldAria("followUpNote", err("followUpNote"))} />
          </Field>
          <div className="-mt-1 flex flex-wrap gap-1.5 sm:col-span-2">
            {followUpPresets(today).map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setValue("followUpDate", p.date, { shouldDirty: true, shouldValidate: formState.isSubmitted })}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  values.followUpDate === p.date ? "border-primary bg-primary text-fg-on-primary" : "border-border bg-surface text-fg-secondary hover:border-border-strong",
                )}
              >
                {p.label}
              </button>
            ))}
            {values.followUpDate ? (
              <button type="button" onClick={() => setValue("followUpDate", "", { shouldDirty: true })} className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-fg-muted hover:text-fg">
                <X className="size-3" /> Clear
              </button>
            ) : null}
          </div>
          <Field label="Internal notes" htmlFor="notes" optional className="sm:col-span-2" error={err("notes")} hint="Standing requirements and context for your team. Never shown to customers.">
            <Textarea rows={4} placeholder="e.g. Bride wants a champagne-colored Sprinter for the bridal party; groom's side ~14 in a party bus." {...register("notes")} {...fieldAria("notes", err("notes"), true)} />
          </Field>
        </Section>
      </div>

      {/* Summary rail (desktop) ------------------------------------------- */}
      <aside className="hidden xl:block">
        <div className="sticky top-6 space-y-4">
          <ReadinessPanel readiness={readiness} />
          {formMessage ? <FormMessage message={formMessage} /> : null}
          <div className="flex flex-col gap-2">
            <Button type="submit" variant="primary" size="lg" loading={submitting}>
              {submitLabel}
            </Button>
            <Button asChild variant="ghost">
              <Link href={cancelHref}>Cancel</Link>
            </Button>
          </div>
          {mode === "create" ? <p className="text-xs leading-5 text-fg-muted">Drafts are kept in this browser tab until you create the inquiry.</p> : null}
        </div>
      </aside>

      {/* Action bar (tablet & phone) --------------------------------------- */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 -mx-4 border-t border-border bg-canvas/92 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:bottom-0 xl:hidden">
        {formMessage ? <FormMessage message={formMessage} className="mb-2" /> : null}
        <div className="flex items-center justify-between gap-3">
          <p className="tabular text-xs text-fg-muted">
            Quote readiness {readiness.completed}/{readiness.total}
          </p>
          <div className="flex gap-2">
            <Button asChild variant="ghost">
              <Link href={cancelHref}>Cancel</Link>
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>

      <DuplicateDialog
        matches={duplicates}
        pending={submitting}
        onClose={() => setDuplicates(null)}
        onUseExisting={(m) => {
          setDuplicates(null);
          chooseCustomer({ id: m.id, fullName: m.fullName, companyName: m.companyName, email: m.email, phone: m.phone, leadCount: m.leadCount });
          toast.message(`Using ${m.fullName}. Review and create the inquiry when ready.`);
        }}
        onCreateAnyway={async () => {
          const v = form.getValues();
          await submitValues(v, true);
          setDuplicates(null);
        }}
      />
    </form>
  );
}

function FormMessage({ message, className }: { message: string; className?: string }) {
  return (
    <p role="alert" className={cn("flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger", className)}>
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}

function ReadinessPanel({ readiness }: { readiness: ReturnType<typeof evaluateReadiness> }) {
  const pct = Math.round((readiness.completed / readiness.total) * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-xs">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-fg">Quote readiness</p>
        <p className="tabular text-sm font-semibold text-fg">
          {readiness.completed}/{readiness.total}
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-active">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1.5">
        {readiness.items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-sm">
            {item.complete ? (
              <CircleCheck aria-hidden className="size-4 shrink-0 text-[var(--green-dot)]" />
            ) : (
              <CircleDashed aria-hidden className={cn("size-4 shrink-0", item.essential ? "text-[var(--amber-dot)]" : "text-fg-faint")} />
            )}
            <span className={item.complete ? "text-fg-secondary" : "text-fg"}>{item.label}</span>
            {item.essential && !item.complete ? <span className="ml-auto text-2xs font-semibold text-[var(--amber-fg)]">Essential</span> : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-5 text-fg-muted">Nothing here is required to save. Essentials are needed before the lead can be qualified.</p>
    </div>
  );
}

function DuplicateDialog({
  matches,
  pending,
  onClose,
  onUseExisting,
  onCreateAnyway,
}: {
  matches: DuplicateMatchView[] | null;
  pending: boolean;
  onClose: () => void;
  onUseExisting: (m: DuplicateMatchView) => void;
  onCreateAnyway: () => void;
}) {
  return (
    <Dialog open={matches != null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent
        title="Is this an existing customer?"
        description="We found customers with the same contact details. Records are never merged automatically — choose what's right."
      >
        <DialogBody className="space-y-2">
          {(matches ?? []).map((m) => (
            <CustomerSummaryCard
              key={m.id}
              customer={{ id: m.id, fullName: m.fullName, companyName: m.companyName, email: m.email, phone: m.phone, leadCount: m.leadCount }}
              action={
                <Button type="button" size="sm" variant="secondary" onClick={() => onUseExisting(m)}>
                  Use
                </Button>
              }
            />
          ))}
          <p className="pt-1 text-xs text-fg-muted">
            Matched on {[...new Set((matches ?? []).flatMap((m) => m.matchedOn))].join(" and ")}
            {matches?.some((m) => m.phone) ? ` · ${formatPhone(matches.find((m) => m.phone)?.phone)}` : ""}. Colleagues sometimes share an office line or inbox, so
            a separate record can be correct.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Go back
          </Button>
          <Button type="button" variant="primary" loading={pending} onClick={onCreateAnyway}>
            Create a new customer anyway
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

