/**
 * Operator network service — independent transportation providers, their
 * fleets, and the verification records our team keeps on them.
 *
 * Trust rules
 * - Fleet details are operator-reported unless a vehicle carries a dated
 *   verification note.
 * - A compliance record can only be "verified" with a date, the verifying
 *   user (taken from the session, never the client) and an evidence note.
 * - Expiration is derived at read time (see domain/operator.ts).
 */
import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import type { FieldChange } from "@/domain/activity";
import { phoneSearchDigits } from "@/domain/contact";
import type { PlainDate } from "@/domain/dates";
import {
  OPERATOR_STATUS_META,
  STANDARD_COMPLIANCE_KINDS,
  COMPLIANCE_KIND_META,
  verificationSummary,
  type OperatorStatus,
  type VerificationSummary,
} from "@/domain/operator";
import type {
  createOperatorSchema,
  updateOperatorSchema,
  upsertComplianceSchema,
  upsertVehicleSchema,
} from "@/domain/schemas/operator";
import { VEHICLE_CATEGORY_META, type VehicleCategory } from "@/domain/vehicle";
import { newId } from "@/lib/ids";
import type { z } from "zod";
import type { Tx } from "../db/client";
import { operatorCompliance, operatorVehicles, operators, users, type OperatorComplianceRow, type OperatorRow, type OperatorVehicleRow } from "../db/schema";
import { logActivity } from "./activity-log";
import { today, type ServiceContext } from "./context";
import { ConflictError, NotFoundError, RuleError, ValidationError } from "./errors";
import { clampPage, contains, pageOf, type Page } from "./sql-helpers";

function getScopedOperator(tx: Tx, ctx: ServiceContext, id: string): OperatorRow {
  const operator = tx
    .select()
    .from(operators)
    .where(and(eq(operators.id, id), eq(operators.workspaceId, ctx.workspace.id)))
    .get();
  if (!operator) throw new NotFoundError("This operator no longer exists. It may have been deleted.");
  return operator;
}

function touchOperator(tx: Tx, id: string, at: Date) {
  tx.update(operators).set({ updatedAt: at }).where(eq(operators.id, id)).run();
}

function vehicleLabel(v: { label: string | null; category: VehicleCategory }): string {
  return v.label ?? VEHICLE_CATEGORY_META[v.category].label;
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export async function createOperator(
  ctx: ServiceContext,
  input: z.output<typeof createOperatorSchema>,
): Promise<{ id: string; created: boolean }> {
  return ctx.db.transaction((tx) => {
    const existing = tx
      .select({ id: operators.id })
      .from(operators)
      .where(and(eq(operators.workspaceId, ctx.workspace.id), eq(operators.clientRequestId, input.clientRequestId)))
      .get();
    if (existing) return { id: existing.id, created: false };

    const sameName = tx
      .select({ id: operators.id })
      .from(operators)
      .where(and(eq(operators.workspaceId, ctx.workspace.id), sql`lower(${operators.companyName}) = lower(${input.companyName})`))
      .get();
    if (sameName) {
      throw new ValidationError("Please fix the highlighted field.", {
        companyName: ["An operator with this name already exists in your network."],
      });
    }

    const id = newId("op");
    const now = ctx.now();
    tx.insert(operators)
      .values({
        id,
        workspaceId: ctx.workspace.id,
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        website: input.website,
        baseLocation: input.baseLocation,
        serviceAreas: input.serviceAreas,
        status: input.status,
        notes: input.notes,
        clientRequestId: input.clientRequestId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    logActivity(tx, ctx, "operator.created", { operatorId: id }, { name: input.companyName }, now);
    return { id, created: true };
  });
}

const OPERATOR_DIFF_FIELDS = ["companyName", "contactName", "phone", "email", "website", "baseLocation", "notes"] as const;

export async function updateOperator(
  ctx: ServiceContext,
  input: z.output<typeof updateOperatorSchema>,
): Promise<{ id: string; version: number; changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedOperator(tx, ctx, input.id);
    if (current.version !== input.version) throw new ConflictError();

    if (current.companyName.toLowerCase() !== input.companyName.toLowerCase()) {
      const sameName = tx
        .select({ id: operators.id })
        .from(operators)
        .where(
          and(
            eq(operators.workspaceId, ctx.workspace.id),
            ne(operators.id, current.id),
            sql`lower(${operators.companyName}) = lower(${input.companyName})`,
          ),
        )
        .get();
      if (sameName) {
        throw new ValidationError("Please fix the highlighted field.", { companyName: ["Another operator already uses this name."] });
      }
    }

    const changes: FieldChange[] = [];
    for (const field of OPERATOR_DIFF_FIELDS) {
      if ((current[field] ?? null) !== (input[field] ?? null)) {
        changes.push(field === "notes" ? { field, from: null, to: null } : { field, from: current[field], to: input[field] });
      }
    }
    if (JSON.stringify(current.serviceAreas) !== JSON.stringify(input.serviceAreas)) {
      changes.push({ field: "serviceAreas", from: current.serviceAreas, to: input.serviceAreas });
    }
    if (changes.length === 0) return { id: current.id, version: current.version, changed: false };

    const now = ctx.now();
    const version = current.version + 1;
    tx.update(operators)
      .set({
        companyName: input.companyName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        website: input.website,
        baseLocation: input.baseLocation,
        serviceAreas: input.serviceAreas,
        notes: input.notes,
        version,
        updatedAt: now,
      })
      .where(eq(operators.id, current.id))
      .run();
    logActivity(tx, ctx, "operator.updated", { operatorId: current.id }, { changes }, now);
    return { id: current.id, version, changed: true };
  });
}

export async function changeOperatorStatus(
  ctx: ServiceContext,
  input: { id: string; expectedStatus: OperatorStatus; status: OperatorStatus },
): Promise<{ changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedOperator(tx, ctx, input.id);
    if (current.status === input.status) return { changed: false };
    if (current.status !== input.expectedStatus) {
      throw new ConflictError(`This operator was changed to ${OPERATOR_STATUS_META[current.status].label} elsewhere. Review it and try again.`);
    }
    const now = ctx.now();
    tx.update(operators)
      .set({ status: input.status, version: current.version + 1, updatedAt: now })
      .where(eq(operators.id, current.id))
      .run();
    logActivity(tx, ctx, "operator.status_changed", { operatorId: current.id }, { from: current.status, to: input.status }, now);
    return { changed: true };
  });
}

export async function deleteOperator(ctx: ServiceContext, input: { id: string }): Promise<{ name: string }> {
  return ctx.db.transaction((tx) => {
    const current = getScopedOperator(tx, ctx, input.id);
    // Vehicles, verification records and the operator's own timeline cascade.
    tx.delete(operators).where(eq(operators.id, current.id)).run();
    logActivity(tx, ctx, "operator.deleted", {}, { name: current.companyName });
    return { name: current.companyName };
  });
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

const VEHICLE_DIFF_FIELDS = ["category", "label", "quantity", "capacity", "notes", "verifiedOn"] as const;

export async function upsertVehicle(
  ctx: ServiceContext,
  input: z.output<typeof upsertVehicleSchema>,
): Promise<{ id: string; created: boolean; changed: boolean }> {
  if (input.verifiedOn && input.verifiedOn > today(ctx)) {
    throw new ValidationError("Please fix the highlighted field.", { verifiedOn: ["Verification can't be dated in the future."] });
  }
  return ctx.db.transaction((tx) => {
    const operator = getScopedOperator(tx, ctx, input.operatorId);
    const now = ctx.now();
    const values = {
      category: input.category,
      label: input.label,
      quantity: input.quantity,
      capacity: input.capacity,
      amenities: input.amenities,
      notes: input.notes,
      verifiedOn: input.verifiedOn,
      verificationNote: input.verifiedOn ? input.verificationNote : null,
    };

    if (!input.vehicleId) {
      const id = newId("veh");
      tx.insert(operatorVehicles)
        .values({ id, operatorId: operator.id, ...values, createdAt: now, updatedAt: now })
        .run();
      logActivity(
        tx,
        ctx,
        "vehicle.added",
        { operatorId: operator.id },
        { label: vehicleLabel(values), category: values.category, capacity: values.capacity, quantity: values.quantity },
        now,
      );
      touchOperator(tx, operator.id, now);
      return { id, created: true, changed: true };
    }

    const current = tx
      .select()
      .from(operatorVehicles)
      .where(and(eq(operatorVehicles.id, input.vehicleId), eq(operatorVehicles.operatorId, operator.id)))
      .get();
    if (!current) throw new NotFoundError("This vehicle record no longer exists.");
    const changes: FieldChange[] = [];
    for (const field of VEHICLE_DIFF_FIELDS) {
      if ((current[field] ?? null) !== (values[field] ?? null)) {
        changes.push(field === "notes" ? { field, from: null, to: null } : { field, from: current[field], to: values[field] });
      }
    }
    if (JSON.stringify(current.amenities) !== JSON.stringify(values.amenities)) {
      changes.push({ field: "amenities", from: current.amenities, to: values.amenities });
    }
    if ((current.verificationNote ?? null) !== (values.verificationNote ?? null) && !changes.some((c) => c.field === "verifiedOn")) {
      changes.push({ field: "verifiedOn", from: current.verifiedOn, to: values.verifiedOn });
    }
    if (changes.length === 0) return { id: current.id, created: false, changed: false };
    tx.update(operatorVehicles).set({ ...values, updatedAt: now }).where(eq(operatorVehicles.id, current.id)).run();
    logActivity(tx, ctx, "vehicle.updated", { operatorId: operator.id }, { label: vehicleLabel(values), changes }, now);
    touchOperator(tx, operator.id, now);
    return { id: current.id, created: false, changed: true };
  });
}

export async function deleteVehicle(ctx: ServiceContext, input: { operatorId: string; vehicleId: string }): Promise<void> {
  ctx.db.transaction((tx) => {
    const operator = getScopedOperator(tx, ctx, input.operatorId);
    const current = tx
      .select()
      .from(operatorVehicles)
      .where(and(eq(operatorVehicles.id, input.vehicleId), eq(operatorVehicles.operatorId, operator.id)))
      .get();
    if (!current) return; // already removed — deleting twice is a no-op
    const now = ctx.now();
    tx.delete(operatorVehicles).where(eq(operatorVehicles.id, current.id)).run();
    logActivity(tx, ctx, "vehicle.removed", { operatorId: operator.id }, { label: vehicleLabel(current), category: current.category }, now);
    touchOperator(tx, operator.id, now);
  });
}

// ---------------------------------------------------------------------------
// Verification & compliance records
// ---------------------------------------------------------------------------

export async function upsertCompliance(
  ctx: ServiceContext,
  input: z.output<typeof upsertComplianceSchema>,
): Promise<{ id: string; created: boolean; changed: boolean }> {
  if (input.verifiedOn && input.verifiedOn > today(ctx)) {
    throw new ValidationError("Please fix the highlighted field.", { verifiedOn: ["Verification can't be dated in the future."] });
  }
  return ctx.db.transaction((tx) => {
    const operator = getScopedOperator(tx, ctx, input.operatorId);
    const now = ctx.now();
    const isVerified = input.status === "verified";
    const values = {
      kind: input.kind,
      label: input.kind === "other" ? input.label : null,
      status: input.status,
      reference: input.reference,
      expiresOn: input.expiresOn,
      verifiedOn: isVerified ? input.verifiedOn : null,
      evidenceNote: input.evidenceNote,
    };

    if (!input.recordId) {
      if (input.kind !== "other") {
        const existing = tx
          .select({ id: operatorCompliance.id })
          .from(operatorCompliance)
          .where(and(eq(operatorCompliance.operatorId, operator.id), eq(operatorCompliance.kind, input.kind)))
          .get();
        if (existing) {
          throw new RuleError(`This operator already has a ${COMPLIANCE_KIND_META[input.kind].label.toLowerCase()} record. Update that record instead.`);
        }
      }
      const id = newId("comp");
      tx.insert(operatorCompliance)
        .values({ id, operatorId: operator.id, ...values, verifiedById: isVerified ? ctx.user.id : null, createdAt: now, updatedAt: now })
        .run();
      logActivity(
        tx,
        ctx,
        "compliance.recorded",
        { operatorId: operator.id },
        { kind: values.kind, label: values.label, status: values.status, previousStatus: null },
        now,
      );
      touchOperator(tx, operator.id, now);
      return { id, created: true, changed: true };
    }

    const current = tx
      .select()
      .from(operatorCompliance)
      .where(and(eq(operatorCompliance.id, input.recordId), eq(operatorCompliance.operatorId, operator.id)))
      .get();
    if (!current) throw new NotFoundError("This verification record no longer exists.");
    if (current.kind !== input.kind) throw new RuleError("A record's type can't be changed. Remove it and add a new record instead.");

    const unchanged =
      current.status === values.status &&
      (current.label ?? null) === (values.label ?? null) &&
      (current.reference ?? null) === (values.reference ?? null) &&
      (current.expiresOn ?? null) === (values.expiresOn ?? null) &&
      (current.verifiedOn ?? null) === (values.verifiedOn ?? null) &&
      (current.evidenceNote ?? null) === (values.evidenceNote ?? null);
    if (unchanged) return { id: current.id, created: false, changed: false };

    // Whoever (re)confirms the evidence becomes the verifier of record.
    const reverified = isVerified && (current.status !== "verified" || current.verifiedOn !== values.verifiedOn || current.evidenceNote !== values.evidenceNote);
    tx.update(operatorCompliance)
      .set({
        ...values,
        verifiedById: isVerified ? (reverified ? ctx.user.id : current.verifiedById) : null,
        updatedAt: now,
      })
      .where(eq(operatorCompliance.id, current.id))
      .run();
    logActivity(
      tx,
      ctx,
      "compliance.recorded",
      { operatorId: operator.id },
      { kind: values.kind, label: values.label, status: values.status, previousStatus: current.status },
      now,
    );
    touchOperator(tx, operator.id, now);
    return { id: current.id, created: false, changed: true };
  });
}

export async function deleteCompliance(ctx: ServiceContext, input: { operatorId: string; recordId: string }): Promise<void> {
  ctx.db.transaction((tx) => {
    const operator = getScopedOperator(tx, ctx, input.operatorId);
    const current = tx
      .select()
      .from(operatorCompliance)
      .where(and(eq(operatorCompliance.id, input.recordId), eq(operatorCompliance.operatorId, operator.id)))
      .get();
    if (!current) return;
    const now = ctx.now();
    tx.delete(operatorCompliance).where(eq(operatorCompliance.id, current.id)).run();
    logActivity(tx, ctx, "compliance.removed", { operatorId: operator.id }, { kind: current.kind, label: current.label, status: current.status }, now);
    touchOperator(tx, operator.id, now);
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export interface FleetSummary {
  totalVehicles: number;
  maxCapacity: number | null;
  categories: Array<{ category: VehicleCategory; quantity: number; maxCapacity: number | null }>;
  verifiedVehicles: number;
}

export function summarizeFleet(vehicles: ReadonlyArray<Pick<OperatorVehicleRow, "category" | "quantity" | "capacity" | "verifiedOn">>): FleetSummary {
  const byCategory = new Map<VehicleCategory, { quantity: number; maxCapacity: number | null }>();
  let maxCapacity: number | null = null;
  let totalVehicles = 0;
  let verifiedVehicles = 0;
  for (const v of vehicles) {
    totalVehicles += v.quantity;
    if (v.verifiedOn) verifiedVehicles += v.quantity;
    if (v.capacity != null) maxCapacity = Math.max(maxCapacity ?? 0, v.capacity);
    const entry = byCategory.get(v.category) ?? { quantity: 0, maxCapacity: null };
    entry.quantity += v.quantity;
    if (v.capacity != null) entry.maxCapacity = Math.max(entry.maxCapacity ?? 0, v.capacity);
    byCategory.set(v.category, entry);
  }
  const order = Object.keys(VEHICLE_CATEGORY_META);
  return {
    totalVehicles,
    maxCapacity,
    verifiedVehicles,
    categories: [...byCategory.entries()]
      .map(([category, e]) => ({ category, ...e }))
      .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category)),
  };
}

export const OPERATOR_SORTS = ["name", "updated", "capacity", "status"] as const;
export type OperatorSort = (typeof OPERATOR_SORTS)[number];
export const VERIFICATION_FILTERS = ["complete", "incomplete", "attention"] as const;
export type VerificationFilter = (typeof VERIFICATION_FILTERS)[number];

export interface OperatorListParams {
  q?: string;
  status?: OperatorStatus[];
  category?: VehicleCategory[];
  minCapacity?: number | null;
  area?: string;
  verification?: VerificationFilter | null;
  sort?: OperatorSort;
  page?: number;
  pageSize?: number;
}

export interface OperatorListRow {
  id: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  baseLocation: string | null;
  serviceAreas: string[];
  status: OperatorStatus;
  updatedAt: Date;
  fleet: FleetSummary;
  verification: VerificationSummary;
}

function vehicleMatch(category: VehicleCategory[] | undefined, minCapacity: number | null | undefined): SQL | undefined {
  if (!category?.length && !minCapacity) return undefined;
  const conds: SQL[] = [sql`v.operator_id = ${operators.id}`];
  if (category?.length) conds.push(sql`v.category in ${category}`);
  if (minCapacity) conds.push(sql`v.capacity >= ${minCapacity}`);
  return sql`exists (select 1 from operator_vehicles v where ${sql.join(conds, sql` and `)})`;
}

function verifiedCurrentCount(todayDate: PlainDate): SQL<number> {
  return sql<number>`(select count(*) from operator_compliance c where c.operator_id = ${operators.id} and c.kind <> 'other' and c.status = 'verified' and (c.expires_on is null or c.expires_on >= ${todayDate}))`;
}

const maxCapacitySql = sql<number | null>`(select max(v.capacity) from operator_vehicles v where v.operator_id = ${operators.id})`;
const statusRankSql = sql`case ${operators.status} when 'preferred' then 0 when 'active' then 1 when 'prospect' then 2 when 'paused' then 3 else 4 end`;

export async function listOperators(ctx: ServiceContext, params: OperatorListParams = {}): Promise<Page<OperatorListRow>> {
  const pageSize = params.pageSize ?? 25;
  const page = clampPage(params.page);
  const todayDate = today(ctx);
  const q = params.q?.trim() ?? "";
  const digits = q ? phoneSearchDigits(q) : null;
  const area = params.area?.trim() ?? "";

  const where = and(
    eq(operators.workspaceId, ctx.workspace.id),
    q
      ? or(
          contains(operators.companyName, q),
          contains(operators.contactName, q),
          contains(operators.baseLocation, q),
          contains(operators.email, q),
          contains(operators.serviceAreas, q),
          digits ? contains(operators.phone, digits) : undefined,
        )
      : undefined,
    params.status?.length ? inArray(operators.status, params.status) : undefined,
    vehicleMatch(params.category, params.minCapacity),
    area ? or(contains(operators.serviceAreas, area), contains(operators.baseLocation, area)) : undefined,
    params.verification === "complete" ? sql`${verifiedCurrentCount(todayDate)} >= ${STANDARD_COMPLIANCE_KINDS.length}` : undefined,
    params.verification === "incomplete" ? sql`${verifiedCurrentCount(todayDate)} < ${STANDARD_COMPLIANCE_KINDS.length}` : undefined,
    params.verification === "attention"
      ? sql`exists (select 1 from operator_compliance c where c.operator_id = ${operators.id} and (c.status = 'issue' or (c.expires_on is not null and c.expires_on < ${todayDate})))`
      : undefined,
  );

  const total = ctx.db.select({ n: sql<number>`count(*)` }).from(operators).where(where).get()?.n ?? 0;
  const order = (() => {
    switch (params.sort ?? "status") {
      case "name":
        return [sql`${operators.companyName} collate nocase asc`];
      case "updated":
        return [desc(operators.updatedAt)];
      case "capacity":
        return [sql`${maxCapacitySql} is null`, desc(maxCapacitySql), sql`${operators.companyName} collate nocase asc`];
      default:
        return [asc(statusRankSql), sql`${operators.companyName} collate nocase asc`];
    }
  })();

  const rows = ctx.db.select().from(operators).where(where).orderBy(...order).limit(pageSize).offset((page - 1) * pageSize).all();
  const ids = rows.map((r) => r.id);
  const vehicles = ids.length ? ctx.db.select().from(operatorVehicles).where(inArray(operatorVehicles.operatorId, ids)).all() : [];
  const records = ids.length ? ctx.db.select().from(operatorCompliance).where(inArray(operatorCompliance.operatorId, ids)).all() : [];

  return pageOf(
    rows.map((r) => ({
      id: r.id,
      companyName: r.companyName,
      contactName: r.contactName,
      phone: r.phone,
      email: r.email,
      baseLocation: r.baseLocation,
      serviceAreas: r.serviceAreas,
      status: r.status,
      updatedAt: r.updatedAt,
      fleet: summarizeFleet(vehicles.filter((v) => v.operatorId === r.id)),
      verification: verificationSummary(
        records.filter((c) => c.operatorId === r.id),
        todayDate,
      ),
    })),
    total,
    page,
    pageSize,
  );
}

export interface OperatorDetail {
  operator: OperatorRow;
  vehicles: OperatorVehicleRow[];
  compliance: Array<OperatorComplianceRow & { verifiedByName: string | null }>;
  fleet: FleetSummary;
  verification: VerificationSummary;
}

export async function getOperator(ctx: ServiceContext, id: string): Promise<OperatorDetail | null> {
  const operator = ctx.db
    .select()
    .from(operators)
    .where(and(eq(operators.id, id), eq(operators.workspaceId, ctx.workspace.id)))
    .get();
  if (!operator) return null;
  const order = Object.keys(VEHICLE_CATEGORY_META);
  const vehicles = ctx.db
    .select()
    .from(operatorVehicles)
    .where(eq(operatorVehicles.operatorId, operator.id))
    .all()
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || (b.capacity ?? 0) - (a.capacity ?? 0));
  const compliance = ctx.db
    .select({ record: operatorCompliance, verifiedByName: users.name })
    .from(operatorCompliance)
    .leftJoin(users, eq(users.id, operatorCompliance.verifiedById))
    .where(eq(operatorCompliance.operatorId, operator.id))
    .orderBy(asc(operatorCompliance.createdAt))
    .all()
    .map((r) => ({ ...r.record, verifiedByName: r.verifiedByName }));
  return {
    operator,
    vehicles,
    compliance,
    fleet: summarizeFleet(vehicles),
    verification: verificationSummary(compliance, today(ctx)),
  };
}

export interface FleetMatch {
  total: number;
  operators: Array<{
    id: string;
    companyName: string;
    status: OperatorStatus;
    matchingVehicles: Array<{ category: VehicleCategory; label: string | null; capacity: number | null; quantity: number }>;
  }>;
}

/**
 * Operators whose *reported* fleet includes a vehicle that fits. This is a
 * directory lookup — it says nothing about availability or price.
 */
export async function findFleetMatches(
  ctx: ServiceContext,
  criteria: { category: VehicleCategory | null; minCapacity: number | null },
  limit = 5,
): Promise<FleetMatch> {
  const conds: SQL[] = [];
  if (criteria.category) conds.push(eq(operatorVehicles.category, criteria.category));
  if (criteria.minCapacity) conds.push(sql`${operatorVehicles.capacity} >= ${criteria.minCapacity}`);
  const rows = ctx.db
    .select({
      operatorId: operators.id,
      companyName: operators.companyName,
      status: operators.status,
      category: operatorVehicles.category,
      label: operatorVehicles.label,
      capacity: operatorVehicles.capacity,
      quantity: operatorVehicles.quantity,
    })
    .from(operatorVehicles)
    .innerJoin(operators, eq(operators.id, operatorVehicles.operatorId))
    .where(and(eq(operators.workspaceId, ctx.workspace.id), inArray(operators.status, ["preferred", "active", "prospect"]), ...conds))
    .orderBy(asc(statusRankSql), sql`${operators.companyName} collate nocase asc`)
    .all();
  const grouped = new Map<string, FleetMatch["operators"][number]>();
  for (const r of rows) {
    const entry = grouped.get(r.operatorId) ?? { id: r.operatorId, companyName: r.companyName, status: r.status, matchingVehicles: [] };
    entry.matchingVehicles.push({ category: r.category, label: r.label, capacity: r.capacity, quantity: r.quantity });
    grouped.set(r.operatorId, entry);
  }
  const all = [...grouped.values()];
  return { total: all.length, operators: all.slice(0, limit) };
}

/** Distinct service areas across the network, most common first (for the area filter). */
export async function listServiceAreas(ctx: ServiceContext): Promise<Array<{ area: string; count: number }>> {
  const rows = ctx.db
    .select({ serviceAreas: operators.serviceAreas })
    .from(operators)
    .where(eq(operators.workspaceId, ctx.workspace.id))
    .all();
  const counts = new Map<string, { area: string; count: number }>();
  for (const row of rows) {
    for (const area of row.serviceAreas) {
      const key = area.toLowerCase();
      const entry = counts.get(key) ?? { area, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.area.localeCompare(b.area));
}

export async function getOperatorVersion(ctx: ServiceContext, id: string) {
  return ctx.db
    .select({ id: operators.id, version: operators.version })
    .from(operators)
    .where(and(eq(operators.id, id), eq(operators.workspaceId, ctx.workspace.id)))
    .get();
}

export function countOperators(ctx: ServiceContext): number {
  return ctx.db.select({ n: sql<number>`count(*)` }).from(operators).where(eq(operators.workspaceId, ctx.workspace.id)).get()?.n ?? 0;
}
