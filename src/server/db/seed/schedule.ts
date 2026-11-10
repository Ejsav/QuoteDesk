/**
 * Turns declarative seed specs into timeline events that call the REAL
 * services with real schema validation. Authoring mistakes (out-of-order
 * steps, no-op status changes, missing customers) fail loudly instead of
 * producing a quietly inconsistent dataset.
 */
import { asc, eq } from "drizzle-orm";
import { createCustomerSchema } from "@/domain/schemas/customer";
import {
  addLeadNoteSchema,
  changeLeadPrioritySchema,
  changeLeadStatusSchema,
  completeFollowUpSchema,
  createLeadSchema,
  logLeadContactSchema,
  scheduleFollowUpSchema,
  updateLeadSchema,
} from "@/domain/schemas/lead";
import {
  changeOperatorStatusSchema,
  createOperatorSchema,
  updateOperatorSchema,
  upsertComplianceSchema,
  upsertVehicleSchema,
} from "@/domain/schemas/operator";
import type { ServiceContext } from "../../services/context";
import { createCustomer } from "../../services/customers";
import {
  addLeadNote,
  changeLeadPriority,
  changeLeadStatus,
  completeFollowUp,
  createLead,
  logLeadContact,
  scheduleFollowUp,
  updateLead,
} from "../../services/leads";
import { changeOperatorStatus, createOperator, updateOperator, upsertCompliance, upsertVehicle } from "../../services/operators";
import { leadStops, leads, operators } from "../schema";
import { plusMinutes } from "./clock";
import type { Timeline } from "./timeline";
import type { ComplianceRevision, CustomerSeed, LeadSeed, LeadStep, OperatorSeed, Passengers, TripDetails } from "./types";

export interface Registry {
  customers: Map<string, string>;
  leads: Map<string, string>;
  operators: Map<string, string>;
  vehicles: Map<string, string>;
  compliance: Map<string, string>;
}

export function createRegistry(): Registry {
  return { customers: new Map(), leads: new Map(), operators: new Map(), vehicles: new Map(), compliance: new Map() };
}

function lookup(map: Map<string, string>, key: string, what: string): string {
  const id = map.get(key);
  if (!id) throw new Error(`${what} "${key}" has not been created yet — check the event order.`);
  return id;
}

function assertAfter(previous: Date, next: Date, label: string) {
  if (next.getTime() <= previous.getTime()) {
    throw new Error(`Seed data error: ${label} (${next.toISOString()}) must be after ${previous.toISOString()}.`);
  }
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

function passengerFields(passengers: Passengers | undefined) {
  if (passengers == null) return { passengersMin: null, passengersMax: null };
  if (typeof passengers === "number") return { passengersMin: passengers, passengersMax: passengers };
  return { passengersMin: passengers[0], passengersMax: passengers[1] };
}

const DIRECT_FIELDS = [
  "occasion",
  "eventName",
  "serviceType",
  "tripDate",
  "pickupTime",
  "timeZone",
  "durationMinutes",
  "pickupLocation",
  "destination",
] as const;

/** Applies only the keys present in `patch` (so `null` clears and absent keeps). */
function applyTrip(target: Record<string, unknown>, patch: TripDetails & { notes?: string | null }) {
  for (const field of DIRECT_FIELDS) {
    if (field in patch) target[field] = patch[field] ?? null;
  }
  if ("passengers" in patch) Object.assign(target, passengerFields(patch.passengers));
  if ("vehicle" in patch) target.vehicleCategory = patch.vehicle ?? null;
  if ("budget" in patch) target.budgetCents = patch.budget == null ? null : Math.round(patch.budget * 100);
  if ("stops" in patch) target.stops = (patch.stops ?? []).map((location) => ({ location, note: null }));
  if ("notes" in patch) target.notes = patch.notes ?? null;
  return target;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function scheduleCustomers(timeline: Timeline, ctx: ServiceContext, reg: Registry, customers: CustomerSeed[], leadSeeds: LeadSeed[]) {
  const keys = new Set<string>();
  for (const customer of customers) {
    if (keys.has(customer.key)) throw new Error(`Duplicate customer key "${customer.key}".`);
    keys.add(customer.key);
    const theirLeads = leadSeeds.filter((l) => l.customer === customer.key);
    if (customer.notes && !customer.addedAt) {
      throw new Error(`Customer "${customer.key}" has notes — give it an addedAt so the notes are recorded.`);
    }
    if (!customer.addedAt) {
      if (theirLeads.length === 0) throw new Error(`Customer "${customer.key}" has no inquiries and no addedAt.`);
      continue;
    }
    for (const lead of theirLeads) assertAfter(customer.addedAt, lead.at, `lead "${lead.key}" for customer "${customer.key}"`);
    const addedAt = customer.addedAt;
    timeline.add(addedAt, `add customer ${customer.key}`, async () => {
      const result = await createCustomer(
        ctx,
        createCustomerSchema.parse({
          fullName: customer.fullName,
          companyName: customer.companyName ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          preferredContact: customer.preferredContact ?? null,
          notes: customer.notes ?? null,
          confirmDuplicate: customer.confirmDuplicate ?? false,
          clientRequestId: `seed-customer-${customer.key}`,
        }),
      );
      reg.customers.set(customer.key, result.id);
    });
  }
  for (const lead of leadSeeds) {
    if (!keys.has(lead.customer)) throw new Error(`Lead "${lead.key}" references unknown customer "${lead.customer}".`);
  }
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export function scheduleLeads(timeline: Timeline, ctx: ServiceContext, reg: Registry, customers: CustomerSeed[], leadSeeds: LeadSeed[]) {
  const customerByKey = new Map(customers.map((c) => [c.key, c]));
  const keys = new Set<string>();

  for (const seed of leadSeeds) {
    if (keys.has(seed.key)) throw new Error(`Duplicate lead key "${seed.key}".`);
    keys.add(seed.key);
    let previous = seed.at;
    for (const step of seed.steps ?? []) {
      assertAfter(previous, step.at, `lead "${seed.key}" step "${step.kind}"`);
      previous = step.at;
    }

    timeline.add(seed.at, `lead ${seed.key}: create`, async () => {
      const customer = customerByKey.get(seed.customer)!;
      const existingId = reg.customers.get(seed.customer);
      const customerRef = existingId
        ? { mode: "existing" as const, customerId: existingId }
        : {
            mode: "new" as const,
            fullName: customer.fullName,
            companyName: customer.companyName ?? null,
            email: customer.email ?? null,
            phone: customer.phone ?? null,
            preferredContact: customer.preferredContact ?? null,
            confirmDuplicate: customer.confirmDuplicate ?? false,
          };
      const fields = applyTrip(
        { timeZone: ctx.workspace.timeZone, stops: [], ...passengerFields(null), vehicleCategory: null, budgetCents: null },
        seed,
      );
      const input = createLeadSchema.parse({
        ...fields,
        source: seed.source,
        priority: seed.priority ?? "normal",
        followUpDate: null,
        followUpNote: null,
        notes: seed.notes ?? null,
        customer: customerRef,
        initialStatus: seed.status ?? "new",
        clientRequestId: `seed-lead-${seed.key}`,
      });
      const created = await createLead(ctx, input);
      if (!created.created) throw new Error(`Lead "${seed.key}" was already created.`);
      reg.leads.set(seed.key, created.id);
      if (!existingId) reg.customers.set(seed.customer, created.customerId);
    });

    for (const step of seed.steps ?? []) {
      timeline.add(step.at, `lead ${seed.key}: ${step.kind}`, () => runLeadStep(ctx, reg, seed.key, step));
    }
  }
}

async function runLeadStep(ctx: ServiceContext, reg: Registry, key: string, step: LeadStep): Promise<void> {
  const id = lookup(reg.leads, key, "Lead");
  const current = ctx.db.select().from(leads).where(eq(leads.id, id)).get();
  if (!current) throw new Error(`Lead "${key}" disappeared.`);

  switch (step.kind) {
    case "contact": {
      const result = await logLeadContact(
        ctx,
        logLeadContactSchema.parse({ leadId: id, channel: step.channel, direction: step.direction, summary: step.summary }),
      );
      if (result.duplicate) throw new Error(`Contact on "${key}" was treated as a duplicate submission.`);
      return;
    }
    case "note": {
      const result = await addLeadNote(ctx, addLeadNoteSchema.parse({ leadId: id, body: step.body }));
      if (result.duplicate) throw new Error(`Note on "${key}" was treated as a duplicate submission.`);
      return;
    }
    case "status": {
      const result = await changeLeadStatus(
        ctx,
        changeLeadStatusSchema.parse({ id, expectedStatus: current.status, status: step.to, lostReason: step.reason ?? null }),
      );
      if (!result.changed) throw new Error(`Status step on "${key}" had no effect (already ${current.status}).`);
      return;
    }
    case "priority": {
      const result = await changeLeadPriority(ctx, changeLeadPrioritySchema.parse({ id, expectedPriority: current.priority, priority: step.to }));
      if (!result.changed) throw new Error(`Priority step on "${key}" had no effect.`);
      return;
    }
    case "followUp": {
      const result = await scheduleFollowUp(
        ctx,
        scheduleFollowUpSchema.parse({ id, expectedDate: current.followUpDate, date: step.date, note: step.note ?? null }),
      );
      if (!result.changed) throw new Error(`Follow-up step on "${key}" had no effect.`);
      return;
    }
    case "completeFollowUp": {
      if (!current.followUpDate) throw new Error(`Lead "${key}" has no follow-up to complete.`);
      await completeFollowUp(ctx, completeFollowUpSchema.parse({ id, expectedDate: current.followUpDate }));
      return;
    }
    case "update": {
      const stops = ctx.db
        .select({ location: leadStops.location, note: leadStops.note })
        .from(leadStops)
        .where(eq(leadStops.leadId, id))
        .orderBy(asc(leadStops.position))
        .all();
      const base: Record<string, unknown> = {
        id,
        version: current.version,
        customerId: current.customerId,
        occasion: current.occasion,
        eventName: current.eventName,
        serviceType: current.serviceType,
        tripDate: current.tripDate,
        pickupTime: current.pickupTime,
        timeZone: current.timeZone,
        durationMinutes: current.durationMinutes,
        pickupLocation: current.pickupLocation,
        destination: current.destination,
        stops,
        passengersMin: current.passengersMin,
        passengersMax: current.passengersMax,
        vehicleCategory: current.vehicleCategory,
        budgetCents: current.budgetCents,
        source: current.source,
        priority: current.priority,
        followUpDate: current.followUpDate,
        followUpNote: current.followUpNote,
        notes: current.notes,
      };
      const result = await updateLead(ctx, updateLeadSchema.parse(applyTrip(base, step.patch)));
      if (!result.changed) throw new Error(`Update step on "${key}" had no effect.`);
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

type ComplianceState = Omit<ComplianceRevision, "at">;

function carryForward(state: ComplianceState, revision: ComplianceRevision): ComplianceState {
  const next: ComplianceState = { ...state };
  for (const [field, value] of Object.entries(revision)) {
    if (field !== "at" && value !== undefined) (next as Record<string, unknown>)[field] = value;
  }
  return next;
}

export function scheduleOperators(timeline: Timeline, ctx: ServiceContext, reg: Registry, seeds: OperatorSeed[]) {
  const keys = new Set<string>();
  for (const op of seeds) {
    if (keys.has(op.key)) throw new Error(`Duplicate operator key "${op.key}".`);
    keys.add(op.key);
    const operatorId = () => lookup(reg.operators, op.key, "Operator");

    timeline.add(op.at, `operator ${op.key}: create`, async () => {
      const result = await createOperator(
        ctx,
        createOperatorSchema.parse({
          companyName: op.companyName,
          contactName: op.contactName ?? null,
          phone: op.phone ?? null,
          email: op.email ?? null,
          website: op.website ?? null,
          baseLocation: op.baseLocation ?? null,
          serviceAreas: op.serviceAreas,
          notes: op.notes ?? null,
          status: op.status,
          clientRequestId: `seed-operator-${op.key}`,
        }),
      );
      reg.operators.set(op.key, result.id);
    });

    op.vehicles.forEach((vehicle, index) => {
      const vehicleKey = `${op.key}:vehicle:${index}`;
      const addedAt = plusMinutes(op.at, 4 * (index + 1));
      const fields = {
        category: vehicle.category,
        label: vehicle.label ?? null,
        quantity: vehicle.quantity ?? 1,
        capacity: vehicle.capacity ?? null,
        amenities: vehicle.amenities ?? [],
        notes: vehicle.notes ?? null,
      };
      timeline.add(addedAt, `operator ${op.key}: add vehicle ${index}`, async () => {
        const result = await upsertVehicle(
          ctx,
          upsertVehicleSchema.parse({ operatorId: operatorId(), vehicleId: null, ...fields, verifiedOn: null, verificationNote: null }),
        );
        reg.vehicles.set(vehicleKey, result.id);
      });
      if (vehicle.verified) {
        const verified = vehicle.verified;
        assertAfter(addedAt, verified.at, `operator "${op.key}" vehicle ${index} verification`);
        timeline.add(verified.at, `operator ${op.key}: verify vehicle ${index}`, async () => {
          const result = await upsertVehicle(
            ctx,
            upsertVehicleSchema.parse({
              operatorId: operatorId(),
              vehicleId: lookup(reg.vehicles, vehicleKey, "Vehicle"),
              ...fields,
              verifiedOn: verified.on,
              verificationNote: verified.note,
            }),
          );
          if (!result.changed) throw new Error(`Vehicle verification on "${op.key}" had no effect.`);
        });
      }
    });

    op.compliance.forEach((record, index) => {
      const recordKey = `${op.key}:compliance:${index}`;
      assertAfter(op.at, record.at, `operator "${op.key}" ${record.kind} record`);
      let state: ComplianceState = carryForward({ status: record.status }, record);
      const initial = { ...state };
      timeline.add(record.at, `operator ${op.key}: record ${record.kind}`, async () => {
        const result = await upsertCompliance(
          ctx,
          upsertComplianceSchema.parse({
            operatorId: operatorId(),
            recordId: null,
            kind: record.kind,
            label: record.label ?? null,
            status: initial.status,
            reference: initial.reference ?? null,
            expiresOn: initial.expiresOn ?? null,
            verifiedOn: initial.verifiedOn ?? null,
            evidenceNote: initial.evidenceNote ?? null,
          }),
        );
        reg.compliance.set(recordKey, result.id);
      });
      let previous = record.at;
      for (const revision of record.revisions ?? []) {
        assertAfter(previous, revision.at, `operator "${op.key}" ${record.kind} revision`);
        previous = revision.at;
        state = carryForward(state, revision);
        const snapshot = { ...state };
        timeline.add(revision.at, `operator ${op.key}: update ${record.kind}`, async () => {
          const result = await upsertCompliance(
            ctx,
            upsertComplianceSchema.parse({
              operatorId: operatorId(),
              recordId: lookup(reg.compliance, recordKey, "Verification record"),
              kind: record.kind,
              label: record.label ?? null,
              status: snapshot.status,
              reference: snapshot.reference ?? null,
              expiresOn: snapshot.expiresOn ?? null,
              verifiedOn: snapshot.status === "verified" ? (snapshot.verifiedOn ?? null) : null,
              evidenceNote: snapshot.evidenceNote ?? null,
            }),
          );
          if (!result.changed) throw new Error(`Verification revision on "${op.key}" had no effect.`);
        });
      }
    });

    for (const change of op.statusChanges ?? []) {
      assertAfter(op.at, change.at, `operator "${op.key}" status change`);
      timeline.add(change.at, `operator ${op.key}: status → ${change.to}`, async () => {
        const id = operatorId();
        const current = ctx.db.select({ status: operators.status }).from(operators).where(eq(operators.id, id)).get();
        if (!current) throw new Error(`Operator "${op.key}" disappeared.`);
        const result = await changeOperatorStatus(ctx, changeOperatorStatusSchema.parse({ id, expectedStatus: current.status, status: change.to }));
        if (!result.changed) throw new Error(`Status change on operator "${op.key}" had no effect.`);
      });
    }

    for (const noteUpdate of op.noteUpdates ?? []) {
      assertAfter(op.at, noteUpdate.at, `operator "${op.key}" notes update`);
      timeline.add(noteUpdate.at, `operator ${op.key}: update notes`, async () => {
        const id = operatorId();
        const current = ctx.db.select().from(operators).where(eq(operators.id, id)).get();
        if (!current) throw new Error(`Operator "${op.key}" disappeared.`);
        const result = await updateOperator(
          ctx,
          updateOperatorSchema.parse({
            id,
            version: current.version,
            companyName: current.companyName,
            contactName: current.contactName,
            phone: current.phone,
            email: current.email,
            website: current.website,
            baseLocation: current.baseLocation,
            serviceAreas: current.serviceAreas,
            notes: noteUpdate.notes,
          }),
        );
        if (!result.changed) throw new Error(`Notes update on operator "${op.key}" had no effect.`);
      });
    }
  }
}
