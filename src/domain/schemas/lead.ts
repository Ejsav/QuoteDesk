import { z } from "zod";
import { CONTACT_CHANNELS, CONTACT_DIRECTIONS } from "../customer";
import {
  INITIAL_LEAD_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOST_REASONS,
  OCCASIONS,
  SERVICE_TYPES,
} from "../lead";
import { VEHICLE_PREFERENCES } from "../vehicle";
import { describeWallTimeProblem, resolveWallTime } from "../zoned-time";
import {
  clientRequestId,
  entityId,
  optionalInt,
  optionalPlainDate,
  optionalPlainTime,
  optionalText,
  plainDateSchema,
  requiredText,
  timeZoneSchema,
  versionSchema,
} from "./common";
import { customerContactRules, customerShape } from "./customer";

export const MAX_STOPS = 10;

export const stopSchema = z.object({
  location: requiredText(200, "Enter the stop's location, or remove the stop."),
  note: optionalText(200),
});

export const leadShape = {
  occasion: z.enum(OCCASIONS).nullable().default(null),
  eventName: optionalText(120),
  serviceType: z.enum(SERVICE_TYPES).nullable().default(null),
  tripDate: optionalPlainDate,
  pickupTime: optionalPlainTime,
  timeZone: timeZoneSchema,
  durationMinutes: optionalInt(15, 72 * 60, "Duration"),
  pickupLocation: optionalText(200),
  destination: optionalText(200),
  stops: z.array(stopSchema).max(MAX_STOPS, `Add up to ${MAX_STOPS} stops.`).default([]),
  passengersMin: optionalInt(1, 500, "Passenger count"),
  passengersMax: optionalInt(1, 500, "Passenger count"),
  vehicleCategory: z.enum(VEHICLE_PREFERENCES).nullable().default(null),
  budgetCents: optionalInt(0, 1_000_000_000, "Budget"),
  source: z.enum(LEAD_SOURCES, { error: "Choose how this inquiry came in." }),
  priority: z.enum(LEAD_PRIORITIES).default("normal"),
  followUpDate: optionalPlainDate,
  followUpNote: optionalText(200),
  notes: optionalText(5000),
};

interface LeadRuleFacts {
  tripDate: string | null;
  pickupTime: string | null;
  timeZone: string;
  passengersMin: number | null;
  passengersMax: number | null;
  followUpDate: string | null;
  followUpNote: string | null;
}

/** Cross-field rules every lead write must satisfy. */
export function leadRules(v: LeadRuleFacts, ctx: z.RefinementCtx) {
  if (v.passengersMax != null && v.passengersMin == null) {
    ctx.addIssue({ code: "custom", path: ["passengersMin"], message: "Enter the lower end of the passenger range." });
  }
  if (v.passengersMin != null && v.passengersMax != null && v.passengersMax < v.passengersMin) {
    ctx.addIssue({ code: "custom", path: ["passengersMax"], message: "The upper end can't be lower than the lower end." });
  }
  if (v.pickupTime && !v.tripDate) {
    ctx.addIssue({ code: "custom", path: ["tripDate"], message: "Add the trip date for this pickup time." });
  }
  if (v.tripDate && v.pickupTime) {
    const resolved = resolveWallTime(v.tripDate, v.pickupTime, v.timeZone);
    if (!resolved.ok) ctx.addIssue({ code: "custom", path: ["pickupTime"], message: describeWallTimeProblem(resolved.reason) });
  }
  if (v.followUpNote && !v.followUpDate) {
    ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Add a date for this follow-up." });
  }
}

export const leadCustomerRefSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), customerId: entityId }),
  z
    .object({
      mode: z.literal("new"),
      ...customerShape,
      confirmDuplicate: z.boolean().default(false),
    })
    .superRefine(customerContactRules),
]);

export const createLeadSchema = z
  .object({
    ...leadShape,
    customer: leadCustomerRefSchema,
    initialStatus: z.enum(INITIAL_LEAD_STATUSES).default("new"),
    clientRequestId,
  })
  .superRefine(leadRules);
export type CreateLeadInput = z.input<typeof createLeadSchema>;
export type CreateLeadData = z.output<typeof createLeadSchema>;

export const updateLeadSchema = z
  .object({
    id: entityId,
    version: versionSchema,
    customerId: entityId,
    ...leadShape,
  })
  .superRefine(leadRules);
export type UpdateLeadInput = z.input<typeof updateLeadSchema>;
export type UpdateLeadData = z.output<typeof updateLeadSchema>;

/** Quick actions use compare-and-set on the field they change. */
export const changeLeadStatusSchema = z.object({
  id: entityId,
  expectedStatus: z.enum(LEAD_STATUSES),
  status: z.enum(LEAD_STATUSES),
  lostReason: z.enum(LOST_REASONS).nullable().default(null),
});
export type ChangeLeadStatusInput = z.input<typeof changeLeadStatusSchema>;

export const changeLeadPrioritySchema = z.object({
  id: entityId,
  expectedPriority: z.enum(LEAD_PRIORITIES),
  priority: z.enum(LEAD_PRIORITIES),
});

export const scheduleFollowUpSchema = z.object({
  id: entityId,
  expectedDate: optionalPlainDate,
  date: plainDateSchema,
  note: optionalText(200),
});
export type ScheduleFollowUpInput = z.input<typeof scheduleFollowUpSchema>;

export const completeFollowUpSchema = z.object({
  id: entityId,
  expectedDate: plainDateSchema,
});

export const clearFollowUpSchema = z.object({
  id: entityId,
  expectedDate: plainDateSchema,
});

export const addLeadNoteSchema = z.object({
  leadId: entityId,
  body: requiredText(5000, "Write something before saving the note."),
});

export const logLeadContactSchema = z.object({
  leadId: entityId,
  channel: z.enum(CONTACT_CHANNELS),
  direction: z.enum(CONTACT_DIRECTIONS).default("outbound"),
  summary: optionalText(2000),
});
export type LogLeadContactInput = z.input<typeof logLeadContactSchema>;

export const deleteLeadSchema = z.object({ id: entityId });
