import { z } from "zod";
import { COMPLIANCE_KINDS, COMPLIANCE_STATUSES, OPERATOR_STATUSES } from "../operator";
import { VEHICLE_AMENITIES, VEHICLE_CATEGORIES } from "../vehicle";
import {
  clientRequestId,
  dedupeTags,
  entityId,
  optionalEmail,
  optionalInt,
  optionalPhone,
  optionalPlainDate,
  optionalText,
  optionalUrl,
  requiredText,
  versionSchema,
} from "./common";

export const operatorShape = {
  companyName: requiredText(120, "Enter the operator's company name."),
  contactName: optionalText(120),
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalUrl,
  baseLocation: optionalText(120),
  serviceAreas: z
    .array(z.string().trim().min(1, "Remove empty service areas.").max(60, "Keep each service area under 60 characters."))
    .max(30, "Up to 30 service areas.")
    .default([])
    .transform(dedupeTags),
  notes: optionalText(5000),
};

export const createOperatorSchema = z.object({
  ...operatorShape,
  status: z.enum(OPERATOR_STATUSES).default("prospect"),
  clientRequestId,
});
export type CreateOperatorInput = z.input<typeof createOperatorSchema>;

export const updateOperatorSchema = z.object({
  id: entityId,
  version: versionSchema,
  ...operatorShape,
});
export type UpdateOperatorInput = z.input<typeof updateOperatorSchema>;

export const changeOperatorStatusSchema = z.object({
  id: entityId,
  expectedStatus: z.enum(OPERATOR_STATUSES),
  status: z.enum(OPERATOR_STATUSES),
});

export const deleteOperatorSchema = z.object({ id: entityId });

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export const vehicleShape = {
  category: z.enum(VEHICLE_CATEGORIES, { error: "Choose a vehicle category." }),
  label: optionalText(120),
  quantity: z.number({ error: "Quantity must be a number." }).int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(200, "Quantity can't be more than 200."),
  capacity: optionalInt(1, 90, "Capacity"),
  amenities: z.array(z.enum(VEHICLE_AMENITIES)).default([]).transform((a) => [...new Set(a)]),
  notes: optionalText(1000),
  verifiedOn: optionalPlainDate,
  verificationNote: optionalText(500),
};

function vehicleRules(v: { verifiedOn: string | null; verificationNote: string | null }, ctx: z.RefinementCtx) {
  if (v.verifiedOn && !v.verificationNote) {
    ctx.addIssue({ code: "custom", path: ["verificationNote"], message: "Describe how this vehicle was verified (e.g. inspected at the garage)." });
  }
  if (v.verificationNote && !v.verifiedOn) {
    ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Add the date it was verified." });
  }
}

export const upsertVehicleSchema = z
  .object({ operatorId: entityId, vehicleId: entityId.nullable().default(null), ...vehicleShape })
  .superRefine(vehicleRules);
export type UpsertVehicleInput = z.input<typeof upsertVehicleSchema>;

export const deleteVehicleSchema = z.object({ operatorId: entityId, vehicleId: entityId });

// ---------------------------------------------------------------------------
// Verification & compliance records
// ---------------------------------------------------------------------------

export const complianceShape = {
  kind: z.enum(COMPLIANCE_KINDS, { error: "Choose what this record covers." }),
  label: optionalText(80),
  status: z.enum(COMPLIANCE_STATUSES, { error: "Choose a status." }),
  reference: optionalText(80),
  expiresOn: optionalPlainDate,
  verifiedOn: optionalPlainDate,
  evidenceNote: optionalText(1000),
};

function complianceRules(
  v: { kind: string; label: string | null; status: string; verifiedOn: string | null; evidenceNote: string | null },
  ctx: z.RefinementCtx,
) {
  if (v.kind === "other" && !v.label) {
    ctx.addIssue({ code: "custom", path: ["label"], message: "Name the document." });
  }
  if (v.status === "verified") {
    if (!v.verifiedOn) ctx.addIssue({ code: "custom", path: ["verifiedOn"], message: "Verified records need the date you confirmed them." });
    if (!v.evidenceNote || v.evidenceNote.length < 10) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceNote"],
        message: "Describe the evidence you reviewed — e.g. “COI from agent, limits confirmed by phone.”",
      });
    }
  }
}

export const upsertComplianceSchema = z
  .object({ operatorId: entityId, recordId: entityId.nullable().default(null), ...complianceShape })
  .superRefine(complianceRules);
export type UpsertComplianceInput = z.input<typeof upsertComplianceSchema>;

export const deleteComplianceSchema = z.object({ operatorId: entityId, recordId: entityId });
