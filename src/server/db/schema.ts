/**
 * QuoteDesk database schema (SQLite via Drizzle).
 *
 * Conventions
 * - Every tenant-owned root table carries `workspace_id`; services always scope
 *   by the request context's workspace. Child tables are reached via parents.
 * - Instants (created/updated/etc.) are integer epoch milliseconds → `Date`.
 * - Customer-requested calendar dates are ISO "YYYY-MM-DD" text, times are
 *   "HH:MM" text, always paired with an IANA `time_zone` on the record.
 * - Money is integer cents. Enumerations are text guarded by CHECK constraints.
 * - Business invariants that must never be violated are CHECK constraints too,
 *   so a bug in application code cannot write an impossible record.
 *
 * Imports below are relative (not "@/") because drizzle-kit loads this file
 * outside the Next.js resolver.
 */
import { relations, sql, type SQL } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import type { ActivityType } from "../../domain/activity";
import { CONTACT_METHODS } from "../../domain/customer";
import { LEAD_PRIORITIES, LEAD_SOURCES, LEAD_STATUSES, LOST_REASONS, OCCASIONS, SERVICE_TYPES } from "../../domain/lead";
import { COMPLIANCE_KINDS, COMPLIANCE_STATUSES, OPERATOR_STATUSES } from "../../domain/operator";
import { VEHICLE_CATEGORIES, VEHICLE_PREFERENCES, type VehicleAmenity } from "../../domain/vehicle";
import { USER_ROLES } from "../../domain/workspace";

/** `column IN ('a','b',…)` from a code-owned constant list. */
function inList(column: AnySQLiteColumn, values: readonly string[]): SQL {
  return sql`${column} in (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;
}

function nullOrInList(column: AnySQLiteColumn, values: readonly string[]): SQL {
  return sql`(${column} is null or ${inList(column, values)})`;
}

const ISO_DATE_GLOB = "[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]";
const TIME_GLOB = "[0-2][0-9]:[0-5][0-9]";

function isoDateOrNull(column: AnySQLiteColumn): SQL {
  return sql`(${column} is null or ${column} glob ${sql.raw(`'${ISO_DATE_GLOB}'`)})`;
}

const createdAt = () => integer("created_at", { mode: "timestamp_ms" }).notNull();
const updatedAt = () => integer("updated_at", { mode: "timestamp_ms" }).notNull();

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  /** Business default IANA zone; "today" for follow-ups and dashboards is computed here. */
  timeZone: text("time_zone").notNull(),
  currency: text("currency").notNull().default("USD"),
  /** Monotonic lead reference counter — numbers are never reused after deletes. */
  nextLeadNumber: integer("next_lead_number").notNull().default(1001),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_workspace_email_uq").on(t.workspaceId, t.email), check("users_role_ck", inList(t.role, USER_ROLES))],
);

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export const customers = sqliteTable(
  "customers",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    companyName: text("company_name"),
    /** Lowercased. Not unique: colleagues can share an inbox or office line. */
    email: text("email"),
    /** E.164. Not unique, for the same reason; duplicates are surfaced, never merged silently. */
    phone: text("phone"),
    preferredContact: text("preferred_contact", { enum: CONTACT_METHODS }),
    notes: text("notes"),
    /** Idempotency key from the creating form — a double submit returns the same record. */
    clientRequestId: text("client_request_id"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("customers_workspace_name_idx").on(t.workspaceId, t.fullName),
    index("customers_workspace_email_idx").on(t.workspaceId, t.email),
    index("customers_workspace_phone_idx").on(t.workspaceId, t.phone),
    uniqueIndex("customers_workspace_request_uq").on(t.workspaceId, t.clientRequestId),
    check("customers_reachable_ck", sql`${t.email} is not null or ${t.phone} is not null`),
    check("customers_preferred_contact_ck", nullOrInList(t.preferredContact, CONTACT_METHODS)),
  ],
);

// ---------------------------------------------------------------------------
// Leads (transportation inquiries)
// ---------------------------------------------------------------------------

export const leads = sqliteTable(
  "leads",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    /** RESTRICT: a customer with inquiries can't be deleted out from under them. */
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    status: text("status", { enum: LEAD_STATUSES }).notNull(),
    lostReason: text("lost_reason", { enum: LOST_REASONS }),
    priority: text("priority", { enum: LEAD_PRIORITIES }).notNull().default("normal"),
    source: text("source", { enum: LEAD_SOURCES }).notNull(),
    occasion: text("occasion", { enum: OCCASIONS }),
    eventName: text("event_name"),
    serviceType: text("service_type", { enum: SERVICE_TYPES }),
    /** Requested calendar date in `time_zone`. */
    tripDate: text("trip_date"),
    /** Requested wall-clock pickup time in `time_zone`. */
    pickupTime: text("pickup_time"),
    timeZone: text("time_zone").notNull(),
    /** Derived UTC instant of date + time + zone. For ordering/conflicts only — never the source of truth. */
    pickupAt: integer("pickup_at", { mode: "timestamp_ms" }),
    durationMinutes: integer("duration_minutes"),
    pickupLocation: text("pickup_location"),
    destination: text("destination"),
    /** Passenger range; an exact count stores min = max. Both null = unknown. */
    passengersMin: integer("passengers_min"),
    passengersMax: integer("passengers_max"),
    vehicleCategory: text("vehicle_category", { enum: VEHICLE_PREFERENCES }),
    /** Customer's stated budget — informational, never a price or revenue. */
    budgetCents: integer("budget_cents"),
    /** Calendar date in the workspace time zone. */
    followUpDate: text("follow_up_date"),
    followUpNote: text("follow_up_note"),
    notes: text("notes"),
    statusChangedAt: integer("status_changed_at", { mode: "timestamp_ms" }).notNull(),
    /** First time the lead reached Qualified. Never cleared. */
    qualifiedAt: integer("qualified_at", { mode: "timestamp_ms" }),
    /** First outreach: first move out of New, or first logged contact. */
    firstResponseAt: integer("first_response_at", { mode: "timestamp_ms" }),
    /** Time of the latest activity entry — maintained by the activity logger. */
    lastActivityAt: integer("last_activity_at", { mode: "timestamp_ms" }).notNull(),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    clientRequestId: text("client_request_id"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("leads_workspace_number_uq").on(t.workspaceId, t.number),
    uniqueIndex("leads_workspace_request_uq").on(t.workspaceId, t.clientRequestId),
    index("leads_workspace_status_idx").on(t.workspaceId, t.status),
    index("leads_workspace_trip_idx").on(t.workspaceId, t.tripDate),
    index("leads_workspace_follow_up_idx").on(t.workspaceId, t.followUpDate),
    index("leads_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("leads_customer_idx").on(t.customerId),
    check("leads_status_ck", inList(t.status, LEAD_STATUSES)),
    check(
      "leads_lost_reason_ck",
      // Explicit IS NOT NULL: `NULL IN (…)` is NULL, and CHECK only rejects FALSE.
      sql`(${t.status} = 'lost' and ${t.lostReason} is not null and ${inList(t.lostReason, LOST_REASONS)}) or (${t.status} <> 'lost' and ${t.lostReason} is null)`,
    ),
    check("leads_priority_ck", inList(t.priority, LEAD_PRIORITIES)),
    check("leads_source_ck", inList(t.source, LEAD_SOURCES)),
    check("leads_occasion_ck", nullOrInList(t.occasion, OCCASIONS)),
    check("leads_service_type_ck", nullOrInList(t.serviceType, SERVICE_TYPES)),
    check("leads_vehicle_ck", nullOrInList(t.vehicleCategory, VEHICLE_PREFERENCES)),
    check(
      "leads_passengers_ck",
      sql`(${t.passengersMin} is null and ${t.passengersMax} is null) or (${t.passengersMin} is not null and ${t.passengersMax} is not null and ${t.passengersMin} >= 1 and ${t.passengersMax} >= ${t.passengersMin})`,
    ),
    check("leads_budget_ck", sql`${t.budgetCents} is null or ${t.budgetCents} >= 0`),
    check("leads_duration_ck", sql`${t.durationMinutes} is null or ${t.durationMinutes} > 0`),
    check("leads_trip_date_ck", isoDateOrNull(t.tripDate)),
    check("leads_follow_up_date_ck", isoDateOrNull(t.followUpDate)),
    check(
      "leads_pickup_time_ck",
      sql`${t.pickupTime} is null or (${t.tripDate} is not null and ${t.pickupTime} glob ${sql.raw(`'${TIME_GLOB}'`)})`,
    ),
    check("leads_follow_up_note_ck", sql`${t.followUpNote} is null or ${t.followUpDate} is not null`),
    // "Qualified" means ready to quote — the facts any quote needs must exist.
    check(
      "leads_qualified_facts_ck",
      sql`${t.status} <> 'qualified' or (${t.tripDate} is not null and ${t.pickupLocation} is not null and ${t.passengersMin} is not null)`,
    ),
  ],
);

export const leadStops = sqliteTable(
  "lead_stops",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    location: text("location").notNull(),
    note: text("note"),
  },
  (t) => [uniqueIndex("lead_stops_position_uq").on(t.leadId, t.position)],
);

// ---------------------------------------------------------------------------
// Operator network
// ---------------------------------------------------------------------------

export const operators = sqliteTable(
  "operators",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    website: text("website"),
    baseLocation: text("base_location"),
    serviceAreas: text("service_areas", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    status: text("status", { enum: OPERATOR_STATUSES }).notNull(),
    notes: text("notes"),
    clientRequestId: text("client_request_id"),
    version: integer("version").notNull().default(1),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("operators_workspace_name_idx").on(t.workspaceId, t.companyName),
    uniqueIndex("operators_workspace_request_uq").on(t.workspaceId, t.clientRequestId),
    check("operators_status_ck", inList(t.status, OPERATOR_STATUSES)),
  ],
);

export const operatorVehicles = sqliteTable(
  "operator_vehicles",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    category: text("category", { enum: VEHICLE_CATEGORIES }).notNull(),
    label: text("label"),
    quantity: integer("quantity").notNull().default(1),
    /** Seated passengers, as reported unless `verified_on` is set. */
    capacity: integer("capacity"),
    amenities: text("amenities", { mode: "json" })
      .$type<VehicleAmenity[]>()
      .notNull()
      .default(sql`'[]'`),
    notes: text("notes"),
    verifiedOn: text("verified_on"),
    verificationNote: text("verification_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("operator_vehicles_operator_idx").on(t.operatorId),
    check("operator_vehicles_category_ck", inList(t.category, VEHICLE_CATEGORIES)),
    check("operator_vehicles_quantity_ck", sql`${t.quantity} >= 1`),
    check("operator_vehicles_capacity_ck", sql`${t.capacity} is null or ${t.capacity} > 0`),
    check("operator_vehicles_verified_on_ck", isoDateOrNull(t.verifiedOn)),
    check(
      "operator_vehicles_verification_ck",
      sql`(${t.verifiedOn} is null and ${t.verificationNote} is null) or (${t.verifiedOn} is not null and ${t.verificationNote} is not null)`,
    ),
  ],
);

export const operatorCompliance = sqliteTable(
  "operator_compliance",
  {
    id: text("id").primaryKey(),
    operatorId: text("operator_id")
      .notNull()
      .references(() => operators.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: COMPLIANCE_KINDS }).notNull(),
    label: text("label"),
    status: text("status", { enum: COMPLIANCE_STATUSES }).notNull(),
    reference: text("reference"),
    expiresOn: text("expires_on"),
    verifiedOn: text("verified_on"),
    verifiedById: text("verified_by_id").references(() => users.id, { onDelete: "set null" }),
    evidenceNote: text("evidence_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("operator_compliance_operator_idx").on(t.operatorId),
    uniqueIndex("operator_compliance_kind_uq").on(t.operatorId, t.kind).where(sql`${t.kind} <> 'other'`),
    check("operator_compliance_kind_ck", inList(t.kind, COMPLIANCE_KINDS)),
    check("operator_compliance_status_ck", inList(t.status, COMPLIANCE_STATUSES)),
    check("operator_compliance_label_ck", sql`${t.kind} <> 'other' or ${t.label} is not null`),
    check("operator_compliance_dates_ck", sql`${isoDateOrNull(t.expiresOn)} and ${isoDateOrNull(t.verifiedOn)}`),
    // Never "verified" without a date and a description of the evidence.
    check(
      "operator_compliance_evidence_ck",
      sql`${t.status} <> 'verified' or (${t.verifiedOn} is not null and ${t.evidenceNote} is not null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Validated in code (see domain/activity.ts) so new event types don't need a table rebuild. */
    type: text("type").$type<ActivityType>().notNull(),
    /** Primary subject — at most one of lead / customer / operator is set. */
    leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    operatorId: text("operator_id").references(() => operators.id, { onDelete: "cascade" }),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    data: text("data", { mode: "json" }).$type<unknown>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("activities_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("activities_lead_created_idx").on(t.leadId, t.createdAt),
    index("activities_customer_created_idx").on(t.customerId, t.createdAt),
    index("activities_operator_created_idx").on(t.operatorId, t.createdAt),
    check(
      "activities_single_subject_ck",
      sql`((${t.leadId} is not null) + (${t.customerId} is not null) + (${t.operatorId} is not null)) <= 1`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Relations (for typed nested reads)
// ---------------------------------------------------------------------------

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  users: many(users),
  customers: many(customers),
  leads: many(leads),
  operators: many(operators),
}));

export const usersRelations = relations(users, ({ one }) => ({
  workspace: one(workspaces, { fields: [users.workspaceId], references: [workspaces.id] }),
}));

export const customersRelations = relations(customers, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [customers.workspaceId], references: [workspaces.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [leads.workspaceId], references: [workspaces.id] }),
  customer: one(customers, { fields: [leads.customerId], references: [customers.id] }),
  createdBy: one(users, { fields: [leads.createdById], references: [users.id] }),
  stops: many(leadStops),
}));

export const leadStopsRelations = relations(leadStops, ({ one }) => ({
  lead: one(leads, { fields: [leadStops.leadId], references: [leads.id] }),
}));

export const operatorsRelations = relations(operators, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [operators.workspaceId], references: [workspaces.id] }),
  vehicles: many(operatorVehicles),
  compliance: many(operatorCompliance),
}));

export const operatorVehiclesRelations = relations(operatorVehicles, ({ one }) => ({
  operator: one(operators, { fields: [operatorVehicles.operatorId], references: [operators.id] }),
}));

export const operatorComplianceRelations = relations(operatorCompliance, ({ one }) => ({
  operator: one(operators, { fields: [operatorCompliance.operatorId], references: [operators.id] }),
  verifiedBy: one(users, { fields: [operatorCompliance.verifiedById], references: [users.id] }),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type User = typeof users.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
export type LeadStopRow = typeof leadStops.$inferSelect;
export type OperatorRow = typeof operators.$inferSelect;
export type OperatorVehicleRow = typeof operatorVehicles.$inferSelect;
export type OperatorComplianceRow = typeof operatorCompliance.$inferSelect;
export type ActivityRow = typeof activities.$inferSelect;
