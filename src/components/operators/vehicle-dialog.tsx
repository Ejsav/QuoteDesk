"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { isPlainDate, type PlainDate } from "@/domain/dates";
import {
  VEHICLE_AMENITIES,
  VEHICLE_AMENITY_LABELS,
  VEHICLE_CATEGORIES,
  VEHICLE_CATEGORY_META,
  type VehicleAmenity,
  type VehicleCategory,
} from "@/domain/vehicle";
import type { OperatorVehicleRow } from "@/server/db/schema";
import { upsertVehicleAction } from "@/server/actions/operators";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, fieldAria } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { applyServerErrors } from "./form-helpers";

export type VehicleRecord = Pick<
  OperatorVehicleRow,
  "id" | "category" | "label" | "quantity" | "capacity" | "amenities" | "notes" | "verifiedOn" | "verificationNote"
>;

interface VehicleFormValues {
  category: VehicleCategory | "";
  label: string;
  quantity: string;
  capacity: string;
  amenities: VehicleAmenity[];
  notes: string;
  verified: boolean;
  verifiedOn: string;
  verificationNote: string;
}

const FIELDS = ["category", "label", "quantity", "capacity", "amenities", "notes", "verifiedOn", "verificationNote"] as const;

function formSchema(today: PlainDate) {
  return z
    .object({
      category: z.string().refine((v) => (VEHICLE_CATEGORIES as readonly string[]).includes(v), "Choose a vehicle category."),
      label: z.string().max(120, "Keep this under 120 characters."),
      quantity: z
        .string()
        .trim()
        .min(1, "Enter how many of this vehicle they run.")
        .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 200, "Quantity must be a whole number from 1 to 200."),
      capacity: z
        .string()
        .trim()
        .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90), "Capacity must be a whole number from 1 to 90."),
      amenities: z.array(z.enum(VEHICLE_AMENITIES)),
      notes: z.string().max(1000, "Keep notes under 1,000 characters."),
      verified: z.boolean(),
      verifiedOn: z.string(),
      verificationNote: z.string().max(500, "Keep this under 500 characters."),
    })
    .superRefine((v, ctx) => {
      if (!v.verified) return;
      if (!isPlainDate(v.verifiedOn)) {
        ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Add the date it was verified." });
      } else if (v.verifiedOn > today) {
        ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Verification can't be dated in the future." });
      }
      if (!v.verificationNote.trim()) {
        ctx.addIssue({ code: "custom", path: ["verificationNote"], message: "Describe how this vehicle was verified (e.g. inspected at the garage)." });
      }
    });
}

function defaults(vehicle: VehicleRecord | null): VehicleFormValues {
  return {
    category: vehicle?.category ?? "",
    label: vehicle?.label ?? "",
    quantity: String(vehicle?.quantity ?? 1),
    capacity: vehicle?.capacity != null ? String(vehicle.capacity) : "",
    amenities: vehicle?.amenities ?? [],
    notes: vehicle?.notes ?? "",
    verified: !!vehicle?.verifiedOn,
    verifiedOn: vehicle?.verifiedOn ?? "",
    verificationNote: vehicle?.verificationNote ?? "",
  };
}

export function VehicleDialog({
  operatorId,
  vehicle,
  today,
  onClose,
}: {
  operatorId: string;
  vehicle: VehicleRecord | null;
  today: PlainDate;
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
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(formSchema(today)) as unknown as Resolver<VehicleFormValues>,
    defaultValues: defaults(vehicle),
  });
  const verified = useWatch({ control, name: "verified" });
  const category = useWatch({ control, name: "category" });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await upsertVehicleAction({
      operatorId,
      vehicleId: vehicle?.id ?? null,
      category: values.category,
      label: values.label.trim() || null,
      quantity: Number(values.quantity),
      capacity: values.capacity.trim() ? Number(values.capacity) : null,
      amenities: values.amenities,
      notes: values.notes.trim() || null,
      verifiedOn: values.verified ? values.verifiedOn : null,
      verificationNote: values.verified ? values.verificationNote.trim() : null,
    });
    if (result.ok) {
      toast.success(!vehicle ? "Vehicle added to the fleet" : result.data.changed ? "Vehicle updated" : "No changes to save");
      onClose();
      return;
    }
    if (result.error.code === "validation") {
      const unmapped = applyServerErrors(result.error, setError, FIELDS);
      setFormError(unmapped[0] ?? (unmapped.length === 0 ? null : result.error.message));
    } else if (result.error.code === "not_found") {
      toast.error(result.error.message);
      onClose();
      router.refresh();
    } else {
      setFormError(result.error.message);
    }
  });

  const typical = category ? VEHICLE_CATEGORY_META[category].typicalCapacity : null;

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent
        size="lg"
        title={vehicle ? "Edit vehicle" : "Add vehicle"}
        description="Record what the operator runs. Details stay marked as operator-reported until your team verifies them."
      >
        <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4">
            {formError ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--red-bg)] bg-danger-soft px-3 py-2 text-sm text-danger">
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                {formError}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="vehicle-category" required error={errors.category?.message}>
                <Select {...register("category")} {...fieldAria("vehicle-category", errors.category?.message)}>
                  <option value="">Choose a category…</option>
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {VEHICLE_CATEGORY_META[c].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Description" htmlFor="vehicle-label" optional hint="Make, model or trim, e.g. “2024 Sprinter Limo”." error={errors.label?.message}>
                <Input {...register("label")} {...fieldAria("vehicle-label", errors.label?.message, true)} placeholder="2024 Mercedes-Benz Sprinter" />
              </Field>
              <Field label="Quantity" htmlFor="vehicle-quantity" required hint="How many of this vehicle they run." error={errors.quantity?.message}>
                <Input type="number" inputMode="numeric" min={1} max={200} {...register("quantity")} {...fieldAria("vehicle-quantity", errors.quantity?.message, true)} />
              </Field>
              <Field
                label="Seated passengers"
                htmlFor="vehicle-capacity"
                optional
                hint={typical ? `Typical for this category: ${typical[0]}–${typical[1]}.` : "Leave blank if the operator hasn't told you."}
                error={errors.capacity?.message}
              >
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  {...register("capacity")}
                  {...fieldAria("vehicle-capacity", errors.capacity?.message, true)}
                  placeholder="e.g. 30"
                />
              </Field>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-fg">
                Amenities <span className="ml-1 text-xs font-normal text-fg-faint">Optional</span>
              </legend>
              <Controller
                control={control}
                name="amenities"
                render={({ field }) => (
                  <div className="flex flex-wrap gap-1.5">
                    {VEHICLE_AMENITIES.map((a) => {
                      const on = field.value.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={on}
                          onClick={() => field.onChange(on ? field.value.filter((x) => x !== a) : [...field.value, a])}
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors",
                            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            on ? "border-accent-line bg-accent-soft text-fg" : "border-border bg-surface text-fg-secondary hover:border-border-strong hover:text-fg",
                          )}
                        >
                          {on ? <Check aria-hidden className="size-3" /> : null}
                          {VEHICLE_AMENITY_LABELS[a]}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
            </fieldset>

            <Field label="Notes" htmlFor="vehicle-notes" optional error={errors.notes?.message}>
              <Textarea
                rows={2}
                {...register("notes")}
                {...fieldAria("vehicle-notes", errors.notes?.message)}
                placeholder="Condition, color, restrictions — anything a quote should account for."
              />
            </Field>

            <div className={cn("rounded-lg border p-3.5 transition-colors", verified ? "border-[var(--green-dot)]/40 bg-[var(--green-bg)]/40" : "border-border")}>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 shrink-0 accent-[var(--green-dot)]"
                  {...register("verified", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked && !getValues("verifiedOn")) setValue("verifiedOn", today);
                    },
                  })}
                />
                <span>
                  <span className="block text-sm font-medium text-fg">Our team has verified this vehicle</span>
                  <span className="block text-xs text-fg-muted">
                    Only check this with first-hand evidence — e.g. you inspected it, or confirmed registration and seating with documents.
                  </span>
                </span>
              </label>
              {verified ? (
                <div className="mt-3.5 grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <Field label="Verified on" htmlFor="vehicle-verified-on" required error={errors.verifiedOn?.message}>
                    <Input type="date" max={today} {...register("verifiedOn")} {...fieldAria("vehicle-verified-on", errors.verifiedOn?.message)} />
                  </Field>
                  <Field label="How it was verified" htmlFor="vehicle-verification-note" required error={errors.verificationNote?.message}>
                    <Input
                      {...register("verificationNote")}
                      {...fieldAria("vehicle-verification-note", errors.verificationNote?.message)}
                      placeholder="Inspected at their Elk Grove garage"
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isSubmitting}>
              {vehicle ? "Save vehicle" : "Add vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
