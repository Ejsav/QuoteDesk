/**
 * Lead service — intake, editing, workflow actions and queries.
 *
 * Integrity guarantees
 * - Every write is one transaction that also records its activity entry.
 * - Creation is idempotent per form instance (`clientRequestId`).
 * - Full edits use optimistic concurrency (`version`); quick actions use
 *   compare-and-set on the field they change, and repeating an action that
 *   already took effect is a no-op instead of an error (safe double-clicks).
 * - Business rules (qualification facts, lost reasons, follow-up dates) are
 *   enforced here and again by database CHECK constraints.
 */
import { and, asc, desc, eq, gte, inArray, lt, lte, ne, or, sql, type SQL } from "drizzle-orm";
import type { FieldChange } from "@/domain/activity";
import { phoneSearchDigits } from "@/domain/contact";
import { addDays, endOfMonth, startOfMonth, zoneAbbreviation, type PlainDate } from "@/domain/dates";
import {
  ATTENTION_RANK,
  ATTENTION_RULES,
  LEAD_STATUS_META,
  attentionReason,
  describeMissing,
  leadTitle,
  missingForQualification,
  parseLeadNumber,
  planStatusTransition,
  type AttentionReason,
  type LeadPriority,
  type LeadSource,
  type LeadStatus,
  type Occasion,
  type QualificationField,
  type ServiceType,
} from "@/domain/lead";
import {
  LEAD_VIEWS,
  UPCOMING_WINDOW_DAYS,
  effectiveSort,
  type FollowUpFilter,
  type LeadQuery,
  type LeadSort,
  type LeadView,
  type ReceivedWindow,
  type TripWindow,
} from "@/domain/lead-query";
import type { CreateLeadData, UpdateLeadData } from "@/domain/schemas/lead";
import type { ContactChannel, ContactDirection, ContactMethod } from "@/domain/customer";
import { formatPlainDate } from "@/domain/dates";
import type { VehiclePreference } from "@/domain/vehicle";
import { localEnd, resolveWallTime, type LocalEnd } from "@/domain/zoned-time";
import { newId } from "@/lib/ids";
import type { Tx } from "../db/client";
import { activities, customers, leadStops, leads, users, workspaces, type LeadRow } from "../db/schema";
import { logActivity } from "./activity-log";
import { insertCustomer } from "./customers";
import { today, type ServiceContext } from "./context";
import { ConflictError, NotFoundError, RuleError, ValidationError, type FieldErrors } from "./errors";
import { clampPage, contains, pageOf, type Page } from "./sql-helpers";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getScopedLead(tx: Tx, ctx: ServiceContext, id: string): LeadRow {
  const lead = tx
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.workspaceId, ctx.workspace.id)))
    .get();
  if (!lead) throw new NotFoundError("This inquiry no longer exists. It may have been deleted.");
  return lead;
}

const MISSING_FIELD_KEYS: Record<QualificationField, string> = {
  tripDate: "tripDate",
  pickupLocation: "pickupLocation",
  passengers: "passengersMin",
};

function fieldErrorsForMissing(missing: QualificationField[], message: string): FieldErrors {
  return Object.fromEntries(missing.map((m) => [MISSING_FIELD_KEYS[m], [message]]));
}

type LeadFieldInput = Pick<
  UpdateLeadData,
  | "occasion"
  | "eventName"
  | "serviceType"
  | "tripDate"
  | "pickupTime"
  | "timeZone"
  | "durationMinutes"
  | "pickupLocation"
  | "destination"
  | "passengersMin"
  | "passengersMax"
  | "vehicleCategory"
  | "budgetCents"
>;

/** Canonical stored form: exact passenger counts become min = max; pickup instant derived. */
function normalizeLeadFields(input: LeadFieldInput) {
  const passengersMax = input.passengersMin == null ? null : (input.passengersMax ?? input.passengersMin);
  let pickupAt: Date | null = null;
  if (input.tripDate && input.pickupTime) {
    const resolved = resolveWallTime(input.tripDate, input.pickupTime, input.timeZone);
    if (!resolved.ok) {
      throw new ValidationError("Please fix the highlighted field.", {
        pickupTime: ["That time doesn't exist on this date because of daylight saving. Choose another time."],
      });
    }
    pickupAt = new Date(resolved.epochMs);
  }
  return {
    occasion: input.occasion,
    eventName: input.eventName,
    serviceType: input.serviceType,
    tripDate: input.tripDate,
    pickupTime: input.pickupTime,
    timeZone: input.timeZone,
    pickupAt,
    durationMinutes: input.durationMinutes,
    pickupLocation: input.pickupLocation,
    destination: input.destination,
    passengersMin: input.passengersMin,
    passengersMax,
    vehicleCategory: input.vehicleCategory,
    budgetCents: input.budgetCents,
  };
}

function insertStops(tx: Tx, leadId: string, stops: Array<{ location: string; note: string | null }>) {
  stops.forEach((stop, index) => {
    tx.insert(leadStops)
      .values({ id: newId("stop"), leadId, position: index + 1, location: stop.location, note: stop.note })
      .run();
  });
}

function assertFollowUpNotPast(ctx: ServiceContext, date: PlainDate | null, field = "followUpDate") {
  if (date && date < today(ctx)) {
    throw new ValidationError("Please fix the highlighted field.", { [field]: ["Choose today or a later date."] });
  }
}

/** True when the same note/contact was just logged by the same person — a double submit. */
function isRecentDuplicate(tx: Tx, ctx: ServiceContext, leadId: string, type: "note.added" | "contact.logged", data: unknown): boolean {
  const latest = tx
    .select({ data: activities.data, actorId: activities.actorId, createdAt: activities.createdAt, type: activities.type })
    .from(activities)
    .where(eq(activities.leadId, leadId))
    .orderBy(desc(activities.createdAt))
    .limit(1)
    .get();
  return (
    !!latest &&
    latest.type === type &&
    latest.actorId === ctx.user.id &&
    ctx.now().getTime() - latest.createdAt.getTime() < 30_000 &&
    JSON.stringify(latest.data) === JSON.stringify(data)
  );
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export interface CreatedLead {
  id: string;
  number: number;
  customerId: string;
  created: boolean;
}

export async function createLead(ctx: ServiceContext, input: CreateLeadData): Promise<CreatedLead> {
  assertFollowUpNotPast(ctx, input.followUpDate);
  if (input.initialStatus === "qualified") {
    const missing = missingForQualification(input);
    if (missing.length > 0) {
      throw new ValidationError(
        `Add the ${describeMissing(missing)} to start this lead as qualified.`,
        fieldErrorsForMissing(missing, "Needed to qualify this lead."),
      );
    }
  }

  return ctx.db.transaction((tx) => {
    const existing = tx
      .select({ id: leads.id, number: leads.number, customerId: leads.customerId })
      .from(leads)
      .where(and(eq(leads.workspaceId, ctx.workspace.id), eq(leads.clientRequestId, input.clientRequestId)))
      .get();
    if (existing) return { ...existing, created: false };

    const now = ctx.now();
    let customerId: string;
    if (input.customer.mode === "existing") {
      const customer = tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, input.customer.customerId), eq(customers.workspaceId, ctx.workspace.id)))
        .get();
      if (!customer) {
        throw new ValidationError("The selected customer no longer exists.", {
          "customer.customerId": ["This customer no longer exists. Choose another, or create a new customer."],
        });
      }
      customerId = customer.id;
    } else {
      customerId = insertCustomer(tx, ctx, input.customer, {
        confirmDuplicate: input.customer.confirmDuplicate,
        clientRequestId: `${input.clientRequestId}:customer`,
      });
    }

    const workspace = tx
      .select({ next: workspaces.nextLeadNumber })
      .from(workspaces)
      .where(eq(workspaces.id, ctx.workspace.id))
      .get();
    if (!workspace) throw new NotFoundError("Workspace not found.");
    const number = workspace.next;
    tx.update(workspaces).set({ nextLeadNumber: number + 1 }).where(eq(workspaces.id, ctx.workspace.id)).run();

    const id = newId("lead");
    const status = input.initialStatus;
    tx.insert(leads)
      .values({
        id,
        workspaceId: ctx.workspace.id,
        number,
        customerId,
        status,
        lostReason: null,
        priority: input.priority,
        source: input.source,
        ...normalizeLeadFields(input),
        followUpDate: input.followUpDate,
        followUpNote: input.followUpDate ? input.followUpNote : null,
        notes: input.notes,
        statusChangedAt: now,
        qualifiedAt: status === "qualified" ? now : null,
        // Starting past "new" means we spoke with the customer at intake.
        firstResponseAt: status === "new" ? null : now,
        lastActivityAt: now,
        createdById: ctx.user.id,
        clientRequestId: input.clientRequestId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    insertStops(tx, id, input.stops);

    logActivity(tx, ctx, "lead.created", { leadId: id }, { number, source: input.source, status }, now);
    if (input.followUpDate) {
      logActivity(
        tx,
        ctx,
        "lead.follow_up_scheduled",
        { leadId: id },
        { number, date: input.followUpDate, note: input.followUpNote, previousDate: null },
        now,
      );
    }
    return { id, number, customerId, created: true };
  });
}

// ---------------------------------------------------------------------------
// Update (full edit)
// ---------------------------------------------------------------------------

const DIFF_FIELDS = [
  "occasion",
  "eventName",
  "serviceType",
  "tripDate",
  "pickupTime",
  "timeZone",
  "durationMinutes",
  "pickupLocation",
  "destination",
  "vehicleCategory",
  "budgetCents",
] as const;

export async function updateLead(ctx: ServiceContext, input: UpdateLeadData): Promise<{ id: string; version: number; changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (current.version !== input.version) {
      throw new ConflictError("This inquiry changed after you opened it. Reload to see the latest details — your edits haven't been saved.");
    }
    const now = ctx.now();
    const next = normalizeLeadFields(input);

    if (current.status === "qualified") {
      const missing = missingForQualification(next);
      if (missing.length > 0) {
        throw new ValidationError(
          `Qualified leads need a ${describeMissing(missing)}. Change the status first if these details are no longer known.`,
          fieldErrorsForMissing(missing, "Required while this lead is qualified."),
        );
      }
    }
    if (current.status === "lost" && input.followUpDate) {
      throw new ValidationError("Please fix the highlighted field.", { followUpDate: ["Reopen this lead before scheduling a follow-up."] });
    }
    if (input.followUpDate !== current.followUpDate) assertFollowUpNotPast(ctx, input.followUpDate);

    let customerChange: { fromName: string; toName: string } | null = null;
    if (input.customerId !== current.customerId) {
      const target = tx
        .select({ fullName: customers.fullName })
        .from(customers)
        .where(and(eq(customers.id, input.customerId), eq(customers.workspaceId, ctx.workspace.id)))
        .get();
      if (!target) throw new ValidationError("The selected customer no longer exists.", { customerId: ["Choose an existing customer."] });
      const from = tx.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, current.customerId)).get();
      customerChange = { fromName: from?.fullName ?? "Unknown customer", toName: target.fullName };
    }

    const changes: FieldChange[] = [];
    for (const field of DIFF_FIELDS) {
      if ((current[field] ?? null) !== (next[field] ?? null)) changes.push({ field, from: current[field], to: next[field] });
    }
    if (current.passengersMin !== next.passengersMin || current.passengersMax !== next.passengersMax) {
      changes.push({
        field: "passengers",
        from: { min: current.passengersMin, max: current.passengersMax },
        to: { min: next.passengersMin, max: next.passengersMax },
      });
    }
    if (current.source !== input.source) changes.push({ field: "source", from: current.source, to: input.source });
    if ((current.notes ?? null) !== (input.notes ?? null)) changes.push({ field: "notes", from: null, to: null });

    const currentStops = tx
      .select({ location: leadStops.location, note: leadStops.note })
      .from(leadStops)
      .where(eq(leadStops.leadId, current.id))
      .orderBy(asc(leadStops.position))
      .all();
    const stopsChanged = JSON.stringify(currentStops) !== JSON.stringify(input.stops.map((s) => ({ location: s.location, note: s.note })));
    if (stopsChanged) {
      changes.push({ field: "stops", from: currentStops.map((s) => s.location), to: input.stops.map((s) => s.location) });
    }

    const nextFollowUpNote = input.followUpDate ? input.followUpNote : null;
    const followUpDateChanged = current.followUpDate !== input.followUpDate;
    if (!followUpDateChanged && (current.followUpNote ?? null) !== (nextFollowUpNote ?? null)) {
      changes.push({ field: "followUpNote", from: current.followUpNote, to: nextFollowUpNote });
    }
    const priorityChanged = current.priority !== input.priority;

    if (changes.length === 0 && !priorityChanged && !followUpDateChanged && !customerChange) {
      return { id: current.id, version: current.version, changed: false };
    }

    const version = current.version + 1;
    tx.update(leads)
      .set({
        ...next,
        customerId: input.customerId,
        source: input.source,
        priority: input.priority,
        followUpDate: input.followUpDate,
        followUpNote: nextFollowUpNote,
        notes: input.notes,
        version,
        updatedAt: now,
      })
      .where(eq(leads.id, current.id))
      .run();
    if (stopsChanged) {
      tx.delete(leadStops).where(eq(leadStops.leadId, current.id)).run();
      insertStops(tx, current.id, input.stops);
    }

    const subject = { leadId: current.id };
    if (customerChange) logActivity(tx, ctx, "lead.customer_changed", subject, { number: current.number, ...customerChange }, now);
    if (changes.length > 0) logActivity(tx, ctx, "lead.updated", subject, { number: current.number, changes }, now);
    if (priorityChanged) {
      logActivity(tx, ctx, "lead.priority_changed", subject, { number: current.number, from: current.priority, to: input.priority }, now);
    }
    if (followUpDateChanged) {
      if (input.followUpDate) {
        logActivity(
          tx,
          ctx,
          "lead.follow_up_scheduled",
          subject,
          { number: current.number, date: input.followUpDate, note: nextFollowUpNote, previousDate: current.followUpDate },
          now,
        );
      } else if (current.followUpDate) {
        logActivity(tx, ctx, "lead.follow_up_cleared", subject, { number: current.number, previousDate: current.followUpDate, reason: "manual" }, now);
      }
    }
    return { id: current.id, version, changed: true };
  });
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------

export async function changeLeadStatus(
  ctx: ServiceContext,
  input: { id: string; expectedStatus: LeadStatus; status: LeadStatus; lostReason: LeadRow["lostReason"] },
): Promise<{ id: string; status: LeadStatus; changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (current.status === input.status) return { id: current.id, status: current.status, changed: false };
    if (current.status !== input.expectedStatus) {
      throw new ConflictError(
        `This lead was moved to ${LEAD_STATUS_META[current.status].label} in another tab or by someone else. Review it and try again.`,
      );
    }
    const now = ctx.now();
    const plan = planStatusTransition(current, input.status, { lostReason: input.lostReason, now });
    if (!plan.ok) {
      if (plan.code === "not_qualifiable") throw new RuleError(plan.message);
      throw new ValidationError(plan.message, { lostReason: [plan.message] });
    }
    tx.update(leads)
      .set({ ...plan.patch, version: current.version + 1, updatedAt: now })
      .where(eq(leads.id, current.id))
      .run();
    const subject = { leadId: current.id };
    logActivity(
      tx,
      ctx,
      "lead.status_changed",
      subject,
      { number: current.number, from: current.status, to: input.status, lostReason: plan.patch.lostReason },
      now,
    );
    if (plan.clearedFollowUp) {
      logActivity(tx, ctx, "lead.follow_up_cleared", subject, { number: current.number, previousDate: plan.clearedFollowUp, reason: "lost" }, now);
    }
    return { id: current.id, status: input.status, changed: true };
  });
}

export async function changeLeadPriority(
  ctx: ServiceContext,
  input: { id: string; expectedPriority: LeadPriority; priority: LeadPriority },
): Promise<{ changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (current.priority === input.priority) return { changed: false };
    if (current.priority !== input.expectedPriority) throw new ConflictError("This lead's priority was changed elsewhere. Review it and try again.");
    const now = ctx.now();
    tx.update(leads)
      .set({ priority: input.priority, version: current.version + 1, updatedAt: now })
      .where(eq(leads.id, current.id))
      .run();
    logActivity(tx, ctx, "lead.priority_changed", { leadId: current.id }, { number: current.number, from: current.priority, to: input.priority }, now);
    return { changed: true };
  });
}

export async function scheduleFollowUp(
  ctx: ServiceContext,
  input: { id: string; expectedDate: PlainDate | null; date: PlainDate; note: string | null },
): Promise<{ changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (current.status === "lost") throw new RuleError("Reopen this lead before scheduling a follow-up.");
    if (current.followUpDate === input.date && (current.followUpNote ?? null) === (input.note ?? null)) return { changed: false };
    if (current.followUpDate !== input.expectedDate && current.followUpDate !== input.date) {
      throw new ConflictError("This follow-up was changed elsewhere. Review the latest date and try again.");
    }
    assertFollowUpNotPast(ctx, input.date, "date");
    const now = ctx.now();
    tx.update(leads)
      .set({ followUpDate: input.date, followUpNote: input.note, version: current.version + 1, updatedAt: now })
      .where(eq(leads.id, current.id))
      .run();
    logActivity(
      tx,
      ctx,
      "lead.follow_up_scheduled",
      { leadId: current.id },
      { number: current.number, date: input.date, note: input.note, previousDate: current.followUpDate },
      now,
    );
    return { changed: true };
  });
}

export async function completeFollowUp(ctx: ServiceContext, input: { id: string; expectedDate: PlainDate }): Promise<{ changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (!current.followUpDate) return { changed: false };
    if (current.followUpDate !== input.expectedDate) throw new ConflictError("This follow-up was changed elsewhere. Review the latest date and try again.");
    const now = ctx.now();
    tx.update(leads)
      .set({ followUpDate: null, followUpNote: null, version: current.version + 1, updatedAt: now })
      .where(eq(leads.id, current.id))
      .run();
    logActivity(
      tx,
      ctx,
      "lead.follow_up_completed",
      { leadId: current.id },
      { number: current.number, date: current.followUpDate, note: current.followUpNote },
      now,
    );
    return { changed: true };
  });
}

export async function clearFollowUp(ctx: ServiceContext, input: { id: string; expectedDate: PlainDate }): Promise<{ changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedLead(tx, ctx, input.id);
    if (!current.followUpDate) return { changed: false };
    if (current.followUpDate !== input.expectedDate) throw new ConflictError("This follow-up was changed elsewhere. Review the latest date and try again.");
    const now = ctx.now();
    tx.update(leads)
      .set({ followUpDate: null, followUpNote: null, version: current.version + 1, updatedAt: now })
      .where(eq(leads.id, current.id))
      .run();
    logActivity(tx, ctx, "lead.follow_up_cleared", { leadId: current.id }, { number: current.number, previousDate: current.followUpDate, reason: "manual" }, now);
    return { changed: true };
  });
}

export async function addLeadNote(ctx: ServiceContext, input: { leadId: string; body: string }): Promise<{ duplicate: boolean }> {
  return ctx.db.transaction((tx) => {
    const lead = getScopedLead(tx, ctx, input.leadId);
    const data = { body: input.body };
    if (isRecentDuplicate(tx, ctx, lead.id, "note.added", data)) return { duplicate: true };
    logActivity(tx, ctx, "note.added", { leadId: lead.id }, data);
    return { duplicate: false };
  });
}

/**
 * Record a call/email/text/meeting that happened outside QuoteDesk.
 * The first logged contact counts as the first response, and logging contact
 * on a New lead moves it to Contacted (recorded as its own timeline entry).
 */
export async function logLeadContact(
  ctx: ServiceContext,
  input: { leadId: string; channel: ContactChannel; direction: ContactDirection; summary: string | null },
): Promise<{ duplicate: boolean; statusChanged: boolean }> {
  return ctx.db.transaction((tx) => {
    const lead = getScopedLead(tx, ctx, input.leadId);
    const data = { channel: input.channel, direction: input.direction, summary: input.summary };
    if (isRecentDuplicate(tx, ctx, lead.id, "contact.logged", data)) return { duplicate: true, statusChanged: false };
    const now = ctx.now();
    logActivity(tx, ctx, "contact.logged", { leadId: lead.id }, data, now);

    if (lead.status === "new") {
      const plan = planStatusTransition(lead, "contacted", { now });
      if (plan.ok) {
        tx.update(leads)
          .set({ ...plan.patch, version: lead.version + 1, updatedAt: now })
          .where(eq(leads.id, lead.id))
          .run();
        logActivity(tx, ctx, "lead.status_changed", { leadId: lead.id }, { number: lead.number, from: "new", to: "contacted", lostReason: null }, now);
        return { duplicate: false, statusChanged: true };
      }
    }
    if (!lead.firstResponseAt) {
      tx.update(leads).set({ firstResponseAt: now }).where(eq(leads.id, lead.id)).run();
    }
    return { duplicate: false, statusChanged: false };
  });
}

export async function deleteLead(ctx: ServiceContext, input: { id: string }): Promise<{ number: number; customerId: string }> {
  return ctx.db.transaction((tx) => {
    const lead = getScopedLead(tx, ctx, input.id);
    const customer = tx.select({ fullName: customers.fullName }).from(customers).where(eq(customers.id, lead.customerId)).get();
    const parts = [leadTitle(lead), customer?.fullName, lead.tripDate ? formatPlainDate(lead.tripDate, "medium") : null].filter(Boolean);
    tx.delete(leads).where(eq(leads.id, lead.id)).run();
    // Recorded on the customer so the audit trail outlives the inquiry.
    logActivity(tx, ctx, "lead.deleted", { customerId: lead.customerId }, { number: lead.number, summary: parts.join(" · ") });
    return { number: lead.number, customerId: lead.customerId };
  });
}

// ---------------------------------------------------------------------------
// Query building — shared by lists, counts and the dashboard.
// ---------------------------------------------------------------------------

export interface QueryClock {
  today: PlainDate;
  now: Date;
}

export function clockOf(ctx: ServiceContext): QueryClock {
  return { today: today(ctx), now: ctx.now() };
}

/** SQL mirror of `attentionReason()` in domain/lead.ts — keep the two in sync (tested). */
export function attentionCondition(c: QueryClock): SQL {
  const soonEnd = addDays(c.today, ATTENTION_RULES.tripSoonDays);
  const staleBefore = c.now.getTime() - ATTENTION_RULES.staleAfterDays * DAY_MS;
  return sql`(${leads.status} <> 'lost' and (
    (${leads.tripDate} >= ${c.today} and ${leads.tripDate} <= ${soonEnd} and ${leads.status} in ('new', 'contacted'))
    or (${leads.followUpDate} is not null and ${leads.followUpDate} <= ${c.today})
    or ${leads.status} = 'new'
    or (${leads.tripDate} is not null and ${leads.tripDate} < ${c.today})
    or (${leads.status} in ('contacted', 'qualified') and ${leads.followUpDate} is null and ${leads.lastActivityAt} <= ${staleBefore})
  ))`;
}

export function viewCondition(view: LeadView, c: QueryClock): SQL | undefined {
  switch (view) {
    case "open":
      return ne(leads.status, "lost");
    case "attention":
      return attentionCondition(c);
    case "new":
      return eq(leads.status, "new");
    case "follow_up":
      return and(ne(leads.status, "lost"), sql`${leads.followUpDate} is not null`, lte(leads.followUpDate, c.today));
    case "upcoming":
      return and(ne(leads.status, "lost"), gte(leads.tripDate, c.today), lte(leads.tripDate, addDays(c.today, UPCOMING_WINDOW_DAYS)));
    case "qualified":
      return eq(leads.status, "qualified");
    case "on_hold":
      return eq(leads.status, "on_hold");
    case "lost":
      return eq(leads.status, "lost");
    case "all":
      return undefined;
  }
}

function tripCondition(window: TripWindow, c: QueryClock): SQL | undefined {
  switch (window) {
    case "next7":
      return and(gte(leads.tripDate, c.today), lte(leads.tripDate, addDays(c.today, 7)));
    case "next30":
      return and(gte(leads.tripDate, c.today), lte(leads.tripDate, addDays(c.today, 30)));
    case "this_month":
      return and(gte(leads.tripDate, startOfMonth(c.today)), lte(leads.tripDate, endOfMonth(c.today)));
    case "later":
      return sql`${leads.tripDate} > ${addDays(c.today, 30)}`;
    case "past":
      return lt(leads.tripDate, c.today);
    case "none":
      return sql`${leads.tripDate} is null`;
  }
}

function receivedCondition(window: ReceivedWindow, c: QueryClock, timeZone: string): SQL {
  if (window === "today") {
    const midnight = resolveWallTime(c.today, "00:00", timeZone);
    const start = midnight.ok ? midnight.epochMs : c.now.getTime() - DAY_MS;
    return sql`${leads.createdAt} >= ${start}`;
  }
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 90;
  return sql`${leads.createdAt} >= ${c.now.getTime() - days * DAY_MS}`;
}

function followUpCondition(filter: FollowUpFilter, c: QueryClock): SQL {
  switch (filter) {
    case "overdue":
      return lt(leads.followUpDate, c.today);
    case "today":
      return eq(leads.followUpDate, c.today);
    case "upcoming":
      return sql`${leads.followUpDate} > ${c.today}`;
    case "none":
      return sql`${leads.followUpDate} is null`;
  }
}

function leadSearchCondition(q: string): SQL | undefined {
  const query = q.trim();
  if (!query) return undefined;
  const number = parseLeadNumber(query);
  const digits = phoneSearchDigits(query);
  return or(
    number != null ? eq(leads.number, number) : undefined,
    contains(customers.fullName, query),
    contains(customers.companyName, query),
    contains(customers.email, query),
    digits ? contains(customers.phone, digits) : undefined,
    contains(leads.eventName, query),
    contains(leads.pickupLocation, query),
    contains(leads.destination, query),
    sql`exists (select 1 from ${leadStops} where ${leadStops.leadId} = ${leads.id} and ${contains(leadStops.location, query)})`,
  );
}

const priorityRankSql = sql`case ${leads.priority} when 'urgent' then 3 when 'high' then 2 when 'normal' then 1 else 0 end`;

function sortOrder(sort: LeadSort): SQL[] {
  switch (sort) {
    case "oldest":
      return [asc(leads.createdAt), asc(leads.number)];
    case "trip":
      return [sql`${leads.tripDate} is null`, asc(leads.tripDate), sql`${leads.pickupTime} is null`, asc(leads.pickupTime), desc(leads.number)];
    case "trip_desc":
      return [sql`${leads.tripDate} is null`, desc(leads.tripDate), desc(leads.pickupTime), desc(leads.number)];
    case "follow_up":
      return [sql`${leads.followUpDate} is null`, asc(leads.followUpDate), desc(priorityRankSql), asc(leads.createdAt)];
    case "updated":
      return [desc(leads.lastActivityAt), desc(leads.number)];
    case "priority":
      return [desc(priorityRankSql), sql`${leads.tripDate} is null`, asc(leads.tripDate), desc(leads.number)];
    case "newest":
    case "attention":
      return [desc(leads.createdAt), desc(leads.number)];
  }
}

export function leadFilterConditions(query: LeadQuery, c: QueryClock, timeZone: string): Array<SQL | undefined> {
  return [
    viewCondition(query.view, c),
    leadSearchCondition(query.q),
    query.status.length ? inArray(leads.status, query.status) : undefined,
    query.priority.length ? inArray(leads.priority, query.priority) : undefined,
    query.source.length ? inArray(leads.source, query.source) : undefined,
    query.occasion.length ? inArray(leads.occasion, query.occasion) : undefined,
    query.vehicle.length ? inArray(leads.vehicleCategory, query.vehicle) : undefined,
    query.trip ? tripCondition(query.trip, c) : undefined,
    query.received ? receivedCondition(query.received, c, timeZone) : undefined,
    query.followUp ? followUpCondition(query.followUp, c) : undefined,
  ];
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface LeadListRow {
  id: string;
  number: number;
  status: LeadStatus;
  priority: LeadPriority;
  source: LeadSource;
  occasion: Occasion | null;
  eventName: string | null;
  serviceType: ServiceType | null;
  tripDate: PlainDate | null;
  pickupTime: string | null;
  timeZone: string;
  pickupLocation: string | null;
  destination: string | null;
  stopCount: number;
  passengersMin: number | null;
  passengersMax: number | null;
  vehicleCategory: VehiclePreference | null;
  followUpDate: PlainDate | null;
  followUpNote: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  customer: { id: string; fullName: string; companyName: string | null };
  attention: AttentionReason | null;
}

function selectLeadRows(ctx: ServiceContext) {
  return ctx.db
    .select({
      id: leads.id,
      number: leads.number,
      status: leads.status,
      priority: leads.priority,
      source: leads.source,
      occasion: leads.occasion,
      eventName: leads.eventName,
      serviceType: leads.serviceType,
      tripDate: leads.tripDate,
      pickupTime: leads.pickupTime,
      timeZone: leads.timeZone,
      pickupLocation: leads.pickupLocation,
      destination: leads.destination,
      stopCount: sql<number>`(select count(*) from ${leadStops} where ${leadStops.leadId} = ${leads.id})`,
      passengersMin: leads.passengersMin,
      passengersMax: leads.passengersMax,
      vehicleCategory: leads.vehicleCategory,
      followUpDate: leads.followUpDate,
      followUpNote: leads.followUpNote,
      createdAt: leads.createdAt,
      lastActivityAt: leads.lastActivityAt,
      customerId: customers.id,
      customerName: customers.fullName,
      customerCompany: customers.companyName,
    })
    .from(leads)
    .innerJoin(customers, eq(customers.id, leads.customerId));
}

type RawLeadRow = ReturnType<ReturnType<typeof selectLeadRows>["all"]>[number];

function toListRow(row: RawLeadRow, c: QueryClock): LeadListRow {
  const { customerId, customerName, customerCompany, ...rest } = row;
  return {
    ...rest,
    customer: { id: customerId, fullName: customerName, companyName: customerCompany },
    attention: attentionReason(row, c),
  };
}

/** Order attention items: most urgent kind first, then by magnitude. */
export function compareAttention(a: AttentionReason, b: AttentionReason): number {
  const rank = ATTENTION_RANK[a.kind] - ATTENTION_RANK[b.kind];
  if (rank !== 0) return rank;
  const magnitude = (r: AttentionReason) => {
    switch (r.kind) {
      case "trip_soon_unqualified":
        return -r.days; // sooner trips first
      case "awaiting_first_contact":
        return r.hours;
      case "follow_up_today":
        return 0;
      default:
        return r.days;
    }
  };
  return magnitude(b) - magnitude(a);
}

export async function listLeads(ctx: ServiceContext, query: LeadQuery, pageSize = 25): Promise<Page<LeadListRow> & { sort: LeadSort }> {
  const c = clockOf(ctx);
  const sort = effectiveSort(query);
  const page = clampPage(query.page);
  const where = and(eq(leads.workspaceId, ctx.workspace.id), ...leadFilterConditions(query, c, ctx.workspace.timeZone));

  if (sort === "attention") {
    // Attention ordering depends on rule evaluation; the matching set is
    // bounded (open leads that need action), so rank in memory.
    const all = selectLeadRows(ctx).where(where).orderBy(desc(leads.createdAt)).limit(2000).all().map((r) => toListRow(r, c));
    all.sort((a, b) => (a.attention && b.attention ? compareAttention(a.attention, b.attention) : a.attention ? -1 : b.attention ? 1 : 0));
    const start = (page - 1) * pageSize;
    return { ...pageOf(all.slice(start, start + pageSize), all.length, page, pageSize), sort };
  }

  const total =
    ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(leads)
      .innerJoin(customers, eq(customers.id, leads.customerId))
      .where(where)
      .get()?.n ?? 0;
  const rows = selectLeadRows(ctx)
    .where(where)
    .orderBy(...sortOrder(sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all()
    .map((r) => toListRow(r, c));
  return { ...pageOf(rows, total, page, pageSize), sort };
}

export type LeadViewCounts = Record<LeadView, number>;

export async function getLeadViewCounts(ctx: ServiceContext): Promise<LeadViewCounts> {
  const c = clockOf(ctx);
  const columns = Object.fromEntries(
    LEAD_VIEWS.map((view) => {
      const cond = viewCondition(view, c);
      return [view, cond ? sql<number>`coalesce(sum(case when ${cond} then 1 else 0 end), 0)` : sql<number>`count(*)`];
    }),
  ) as Record<LeadView, SQL<number>>;
  const row = ctx.db.select(columns).from(leads).where(eq(leads.workspaceId, ctx.workspace.id)).get();
  return Object.fromEntries(LEAD_VIEWS.map((v) => [v, Number(row?.[v] ?? 0)])) as LeadViewCounts;
}

/** Attention queue for the dashboard — every flagged lead, most urgent first. */
export async function getAttentionQueue(ctx: ServiceContext): Promise<Array<LeadListRow & { attention: AttentionReason }>> {
  const c = clockOf(ctx);
  return selectLeadRows(ctx)
    .where(and(eq(leads.workspaceId, ctx.workspace.id), attentionCondition(c)))
    .all()
    .map((r) => toListRow(r, c))
    .filter((r): r is LeadListRow & { attention: AttentionReason } => r.attention != null)
    .sort((a, b) => compareAttention(a.attention, b.attention));
}

export async function listUpcomingTrips(ctx: ServiceContext, days = UPCOMING_WINDOW_DAYS, limit = 10): Promise<LeadListRow[]> {
  const c = clockOf(ctx);
  return selectLeadRows(ctx)
    .where(
      and(
        eq(leads.workspaceId, ctx.workspace.id),
        ne(leads.status, "lost"),
        gte(leads.tripDate, c.today),
        lte(leads.tripDate, addDays(c.today, days)),
      ),
    )
    .orderBy(...sortOrder("trip"))
    .limit(limit)
    .all()
    .map((r) => toListRow(r, c));
}

export interface LeadDetail {
  lead: LeadRow;
  stops: Array<{ id: string; position: number; location: string; note: string | null }>;
  customer: {
    id: string;
    fullName: string;
    companyName: string | null;
    email: string | null;
    phone: string | null;
    preferredContact: ContactMethod | null;
    leadCount: number;
    openLeadCount: number;
  };
  createdByName: string | null;
  schedule: {
    zoneAbbreviation: string;
    /** Requested time falls in the repeated hour of a DST fall-back. */
    ambiguous: boolean;
    end: LocalEnd | null;
  };
  attention: AttentionReason | null;
}

export async function getLead(ctx: ServiceContext, id: string): Promise<LeadDetail | null> {
  const lead = ctx.db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.workspaceId, ctx.workspace.id)))
    .get();
  if (!lead) return null;

  const stops = ctx.db
    .select({ id: leadStops.id, position: leadStops.position, location: leadStops.location, note: leadStops.note })
    .from(leadStops)
    .where(eq(leadStops.leadId, lead.id))
    .orderBy(asc(leadStops.position))
    .all();

  const customer = ctx.db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      preferredContact: customers.preferredContact,
      leadCount: sql<number>`(select count(*) from ${leads} where ${leads.customerId} = ${customers.id})`,
      openLeadCount: sql<number>`(select count(*) from ${leads} where ${leads.customerId} = ${customers.id} and ${leads.status} <> 'lost')`,
    })
    .from(customers)
    .where(eq(customers.id, lead.customerId))
    .get();
  if (!customer) return null;

  const createdBy = lead.createdById
    ? ctx.db.select({ name: users.name }).from(users).where(eq(users.id, lead.createdById)).get()
    : undefined;

  let ambiguous = false;
  let end: LocalEnd | null = null;
  if (lead.tripDate && lead.pickupTime) {
    const resolved = resolveWallTime(lead.tripDate, lead.pickupTime, lead.timeZone);
    ambiguous = resolved.ok && resolved.ambiguous;
    if (lead.durationMinutes) end = localEnd(lead.tripDate, lead.pickupTime, lead.timeZone, lead.durationMinutes);
  }
  const at = lead.pickupAt ?? ctx.now();

  return {
    lead,
    stops,
    customer,
    createdByName: createdBy?.name ?? null,
    schedule: { zoneAbbreviation: zoneAbbreviation(lead.timeZone, at), ambiguous, end },
    attention: attentionReason(lead, clockOf(ctx)),
  };
}

export async function getLeadForEdit(ctx: ServiceContext, id: string) {
  const detail = await getLead(ctx, id);
  if (!detail) return null;
  return { lead: detail.lead, stops: detail.stops, customer: detail.customer };
}

export function countLeads(ctx: ServiceContext): number {
  return ctx.db.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.workspaceId, ctx.workspace.id)).get()?.n ?? 0;
}
