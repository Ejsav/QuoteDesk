/**
 * Customer service. A customer is one person or organization with any number
 * of inquiries over time; leads reference customers by id, so a contact detail
 * changes in exactly one place.
 *
 * Duplicates: matching email or phone is surfaced to the user as a possible
 * duplicate and must be explicitly confirmed — records are never merged on
 * weak signals. Merging is a separate, deliberate action.
 */
import { and, asc, desc, eq, ne, or, sql, type SQL } from "drizzle-orm";
import type { FieldChange } from "@/domain/activity";
import { phoneSearchDigits } from "@/domain/contact";
import type { ContactMethod } from "@/domain/customer";
import type { PlainDate } from "@/domain/dates";
import type { LeadPriority, LeadStatus, Occasion } from "@/domain/lead";
import type { createCustomerSchema, mergeCustomersSchema, updateCustomerSchema } from "@/domain/schemas/customer";
import { newId } from "@/lib/ids";
import type { z } from "zod";
import type { DB, Tx } from "../db/client";
import { activities, customers, leads } from "../db/schema";
import { logActivity } from "./activity-log";
import { today, type ServiceContext } from "./context";
import { ConflictError, DuplicateCustomerError, NotFoundError, RuleError, type DuplicateMatch } from "./errors";
import { contains, pageOf, pageWithin, type Page } from "./sql-helpers";

type Executor = DB | Tx;

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export function findDuplicateCustomers(
  db: Executor,
  ctx: ServiceContext,
  contact: { email: string | null; phone: string | null; excludeId?: string },
): DuplicateMatch[] {
  const matchers: SQL[] = [];
  if (contact.email) matchers.push(eq(customers.email, contact.email));
  if (contact.phone) matchers.push(eq(customers.phone, contact.phone));
  if (matchers.length === 0) return [];
  const rows = db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      leadCount: leadCountSql,
    })
    .from(customers)
    .where(
      and(
        eq(customers.workspaceId, ctx.workspace.id),
        or(...matchers),
        contact.excludeId ? ne(customers.id, contact.excludeId) : undefined,
      ),
    )
    .orderBy(asc(customers.fullName))
    .limit(5)
    .all();
  return rows.map((r) => ({
    ...r,
    matchedOn: [
      ...(contact.email && r.email === contact.email ? (["email"] as const) : []),
      ...(contact.phone && r.phone === contact.phone ? (["phone"] as const) : []),
    ],
  }));
}

export async function checkDuplicateCustomers(
  ctx: ServiceContext,
  contact: { email: string | null; phone: string | null; excludeId?: string },
): Promise<DuplicateMatch[]> {
  return findDuplicateCustomers(ctx.db, ctx, contact);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

type NewCustomerData = {
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: ContactMethod | null;
  notes?: string | null;
};

/** Insert a customer inside an existing transaction (used by lead intake too). */
export function insertCustomer(
  tx: Tx,
  ctx: ServiceContext,
  data: NewCustomerData,
  opts: { confirmDuplicate: boolean; clientRequestId: string | null },
): string {
  if (!opts.confirmDuplicate) {
    const matches = findDuplicateCustomers(tx, ctx, { email: data.email, phone: data.phone });
    if (matches.length > 0) throw new DuplicateCustomerError(matches);
  }
  const id = newId("cus");
  const now = ctx.now();
  tx.insert(customers)
    .values({
      id,
      workspaceId: ctx.workspace.id,
      fullName: data.fullName,
      companyName: data.companyName,
      email: data.email,
      phone: data.phone,
      preferredContact: data.preferredContact,
      notes: data.notes ?? null,
      clientRequestId: opts.clientRequestId,
      version: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  logActivity(tx, ctx, "customer.created", { customerId: id }, { name: data.fullName }, now);
  return id;
}

export async function createCustomer(
  ctx: ServiceContext,
  input: z.output<typeof createCustomerSchema>,
): Promise<{ id: string; created: boolean }> {
  return ctx.db.transaction((tx) => {
    const existing = tx
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.workspaceId, ctx.workspace.id), eq(customers.clientRequestId, input.clientRequestId)))
      .get();
    if (existing) return { id: existing.id, created: false };
    const id = insertCustomer(tx, ctx, input, { confirmDuplicate: input.confirmDuplicate, clientRequestId: input.clientRequestId });
    return { id, created: true };
  });
}

const TRACKED_FIELDS = ["fullName", "companyName", "email", "phone", "preferredContact", "notes"] as const;

export async function updateCustomer(
  ctx: ServiceContext,
  input: z.output<typeof updateCustomerSchema>,
): Promise<{ id: string; version: number; changed: boolean }> {
  return ctx.db.transaction((tx) => {
    const current = tx
      .select()
      .from(customers)
      .where(and(eq(customers.id, input.id), eq(customers.workspaceId, ctx.workspace.id)))
      .get();
    if (!current) throw new NotFoundError("This customer no longer exists. It may have been deleted or merged.");
    if (current.version !== input.version) throw new ConflictError();

    const changes: FieldChange[] = [];
    for (const field of TRACKED_FIELDS) {
      if ((current[field] ?? null) !== (input[field] ?? null)) {
        changes.push(field === "notes" ? { field, from: null, to: null } : { field, from: current[field], to: input[field] });
      }
    }
    if (changes.length === 0) return { id: current.id, version: current.version, changed: false };

    const contactChanged = current.email !== input.email || current.phone !== input.phone;
    if (contactChanged && !input.confirmDuplicate) {
      const matches = findDuplicateCustomers(tx, ctx, {
        email: input.email !== current.email ? input.email : null,
        phone: input.phone !== current.phone ? input.phone : null,
        excludeId: current.id,
      });
      if (matches.length > 0) throw new DuplicateCustomerError(matches);
    }

    const now = ctx.now();
    const version = current.version + 1;
    tx.update(customers)
      .set({
        fullName: input.fullName,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        preferredContact: input.preferredContact,
        notes: input.notes,
        version,
        updatedAt: now,
      })
      .where(eq(customers.id, current.id))
      .run();
    logActivity(tx, ctx, "customer.updated", { customerId: current.id }, { changes }, now);
    return { id: current.id, version, changed: true };
  });
}

export async function deleteCustomer(ctx: ServiceContext, input: { id: string }): Promise<{ name: string }> {
  return ctx.db.transaction((tx) => {
    const current = tx
      .select({ id: customers.id, fullName: customers.fullName })
      .from(customers)
      .where(and(eq(customers.id, input.id), eq(customers.workspaceId, ctx.workspace.id)))
      .get();
    if (!current) throw new NotFoundError("This customer no longer exists.");
    const leadCount = tx.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.customerId, current.id)).get()?.n ?? 0;
    if (leadCount > 0) {
      throw new RuleError(
        `${current.fullName} has ${leadCount} ${leadCount === 1 ? "inquiry" : "inquiries"}. Delete or reassign ${leadCount === 1 ? "it" : "them"} first, or merge this customer into another record.`,
      );
    }
    tx.delete(customers).where(eq(customers.id, current.id)).run();
    logActivity(tx, ctx, "customer.deleted", {}, { name: current.fullName });
    return { name: current.fullName };
  });
}

/**
 * Merge `source` into `target`: inquiries move, the target keeps its own
 * contact details and gains any it was missing, and the source is deleted.
 */
export async function mergeCustomers(
  ctx: ServiceContext,
  input: z.output<typeof mergeCustomersSchema>,
): Promise<{ targetId: string; leadsMoved: number }> {
  return ctx.db.transaction((tx) => {
    const scoped = (id: string) => and(eq(customers.id, id), eq(customers.workspaceId, ctx.workspace.id));
    const source = tx.select().from(customers).where(scoped(input.sourceId)).get();
    const target = tx.select().from(customers).where(scoped(input.targetId)).get();
    if (!source) throw new NotFoundError("The customer you're merging no longer exists.");
    if (!target) throw new NotFoundError("The customer you're merging into no longer exists.");

    const now = ctx.now();
    const movedLeads = tx
      .select({ id: leads.id, number: leads.number, version: leads.version })
      .from(leads)
      .where(eq(leads.customerId, source.id))
      .all();
    for (const lead of movedLeads) {
      tx.update(leads)
        .set({ customerId: target.id, version: lead.version + 1, updatedAt: now })
        .where(eq(leads.id, lead.id))
        .run();
      logActivity(tx, ctx, "lead.customer_changed", { leadId: lead.id }, { number: lead.number, fromName: source.fullName, toName: target.fullName }, now);
    }
    // Keep the audit trail of inquiries deleted from the source record.
    tx.update(activities)
      .set({ customerId: target.id })
      .where(and(eq(activities.customerId, source.id), eq(activities.type, "lead.deleted")))
      .run();

    const email = target.email ?? source.email;
    const phone = target.phone ?? source.phone;
    const notes = [target.notes, source.notes ? `Merged from ${source.fullName}:\n${source.notes}` : null].filter(Boolean).join("\n\n") || null;
    tx.update(customers)
      .set({
        companyName: target.companyName ?? source.companyName,
        email,
        phone,
        preferredContact: target.preferredContact ?? source.preferredContact,
        notes,
        version: target.version + 1,
        updatedAt: now,
      })
      .where(eq(customers.id, target.id))
      .run();
    logActivity(tx, ctx, "customer.merged", { customerId: target.id }, { sourceName: source.fullName, leadsMoved: movedLeads.length }, now);
    tx.delete(customers).where(eq(customers.id, source.id)).run();
    return { targetId: target.id, leadsMoved: movedLeads.length };
  });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/*
 * Correlated subqueries name the outer row explicitly. Drizzle renders columns
 * unqualified in single-table select lists (even inside sql`` templates), so
 * `${customers.id}` there would silently bind to the subquery's own table.
 */
const OUTER_CUSTOMER_ID = sql.raw(`"customers"."id"`);
const leadCountSql = sql<number>`(select count(*) from leads l where l.customer_id = ${OUTER_CUSTOMER_ID})`;
const openLeadCountSql = sql<number>`(select count(*) from leads l where l.customer_id = ${OUTER_CUSTOMER_ID} and l.status <> 'lost')`;
const lastInquiryAtSql = sql<number | null>`(select max(l.created_at) from leads l where l.customer_id = ${OUTER_CUSTOMER_ID})`;

export const CUSTOMER_FILTERS = ["all", "open", "repeat", "company"] as const;
export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number];
export const CUSTOMER_SORTS = ["recent", "name", "inquiries", "created"] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export interface CustomerListParams {
  q?: string;
  filter?: CustomerFilter;
  sort?: CustomerSort;
  page?: number;
  pageSize?: number;
}

export interface CustomerListRow {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  preferredContact: ContactMethod | null;
  createdAt: Date;
  leadCount: number;
  openLeadCount: number;
  lastInquiryAt: Date | null;
  latestLead: { id: string; number: number; status: LeadStatus; tripDate: PlainDate | null; occasion: Occasion | null; eventName: string | null } | null;
}

function customerSearch(q: string): SQL | undefined {
  const query = q.trim();
  if (!query) return undefined;
  const digits = phoneSearchDigits(query);
  return or(
    contains(customers.fullName, query),
    contains(customers.companyName, query),
    contains(customers.email, query),
    digits ? contains(customers.phone, digits) : undefined,
  );
}

export async function listCustomers(ctx: ServiceContext, params: CustomerListParams = {}): Promise<Page<CustomerListRow>> {
  const pageSize = params.pageSize ?? 25;
  const filter = params.filter ?? "all";
  const where = and(
    eq(customers.workspaceId, ctx.workspace.id),
    customerSearch(params.q ?? ""),
    filter === "open" ? sql`${openLeadCountSql} > 0` : undefined,
    filter === "repeat" ? sql`${leadCountSql} >= 2` : undefined,
    filter === "company" ? sql`${customers.companyName} is not null` : undefined,
  );
  const total = ctx.db.select({ n: sql<number>`count(*)` }).from(customers).where(where).get()?.n ?? 0;
  const page = pageWithin(params.page, total, pageSize);

  const order = (() => {
    switch (params.sort ?? "recent") {
      case "name":
        return [sql`${customers.fullName} collate nocase asc`];
      case "inquiries":
        return [desc(leadCountSql), sql`${customers.fullName} collate nocase asc`];
      case "created":
        return [desc(customers.createdAt)];
      default:
        return [sql`${lastInquiryAtSql} is null`, desc(lastInquiryAtSql), desc(customers.createdAt)];
    }
  })();

  const rows = ctx.db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      preferredContact: customers.preferredContact,
      createdAt: customers.createdAt,
      leadCount: leadCountSql,
      openLeadCount: openLeadCountSql,
      lastInquiryAt: lastInquiryAtSql,
    })
    .from(customers)
    .where(where)
    .orderBy(...order)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  // Latest inquiry per customer on this page, in one query.
  const ids = rows.map((r) => r.id);
  const latest = new Map<string, CustomerListRow["latestLead"]>();
  if (ids.length > 0) {
    const leadRows = ctx.db
      .select({
        id: leads.id,
        customerId: leads.customerId,
        number: leads.number,
        status: leads.status,
        tripDate: leads.tripDate,
        occasion: leads.occasion,
        eventName: leads.eventName,
      })
      .from(leads)
      .where(sql`${leads.customerId} in ${ids} and ${leads.createdAt} = (select max(l2.created_at) from leads l2 where l2.customer_id = ${leads.customerId})`)
      .all();
    for (const l of leadRows) latest.set(l.customerId, l);
  }

  return pageOf(
    rows.map((r) => ({
      ...r,
      lastInquiryAt: r.lastInquiryAt == null ? null : new Date(Number(r.lastInquiryAt)),
      latestLead: latest.get(r.id) ?? null,
    })),
    total,
    page,
    pageSize,
  );
}

export interface CustomerPickerRow {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  leadCount: number;
}

/** Compact search for the lead form's customer picker. */
export async function searchCustomersForPicker(ctx: ServiceContext, q: string, limit = 8): Promise<CustomerPickerRow[]> {
  return ctx.db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      companyName: customers.companyName,
      email: customers.email,
      phone: customers.phone,
      leadCount: leadCountSql,
    })
    .from(customers)
    .where(and(eq(customers.workspaceId, ctx.workspace.id), customerSearch(q)))
    .orderBy(q.trim() ? sql`${customers.fullName} collate nocase asc` : desc(customers.updatedAt))
    .limit(limit)
    .all();
}

export interface CustomerLeadRow {
  id: string;
  number: number;
  status: LeadStatus;
  priority: LeadPriority;
  occasion: Occasion | null;
  eventName: string | null;
  tripDate: PlainDate | null;
  pickupTime: string | null;
  timeZone: string;
  pickupLocation: string | null;
  destination: string | null;
  stopCount: number;
  passengersMin: number | null;
  passengersMax: number | null;
  followUpDate: PlainDate | null;
  createdAt: Date;
  qualifiedAt: Date | null;
}

export interface CustomerDetail {
  customer: typeof customers.$inferSelect;
  leads: CustomerLeadRow[];
  stats: {
    total: number;
    open: number;
    everQualified: number;
    lost: number;
    firstInquiryAt: Date | null;
    nextTripDate: PlainDate | null;
  };
  possibleDuplicates: DuplicateMatch[];
}

export async function getCustomer(ctx: ServiceContext, id: string): Promise<CustomerDetail | null> {
  const customer = ctx.db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.workspaceId, ctx.workspace.id)))
    .get();
  if (!customer) return null;

  const leadRows = ctx.db
    .select({
      id: leads.id,
      number: leads.number,
      status: leads.status,
      priority: leads.priority,
      occasion: leads.occasion,
      eventName: leads.eventName,
      tripDate: leads.tripDate,
      pickupTime: leads.pickupTime,
      timeZone: leads.timeZone,
      pickupLocation: leads.pickupLocation,
      destination: leads.destination,
      stopCount: sql<number>`(select count(*) from lead_stops s where s.lead_id = ${sql.raw(`"leads"."id"`)})`,
      passengersMin: leads.passengersMin,
      passengersMax: leads.passengersMax,
      followUpDate: leads.followUpDate,
      createdAt: leads.createdAt,
      qualifiedAt: leads.qualifiedAt,
    })
    .from(leads)
    .where(eq(leads.customerId, customer.id))
    .orderBy(desc(leads.createdAt))
    .all();

  const todayDate = today(ctx);
  const upcoming = leadRows
    .filter((l) => l.status !== "lost" && l.tripDate && l.tripDate >= todayDate)
    .map((l) => l.tripDate as string)
    .sort();

  return {
    customer,
    leads: leadRows,
    stats: {
      total: leadRows.length,
      open: leadRows.filter((l) => l.status !== "lost").length,
      everQualified: leadRows.filter((l) => l.qualifiedAt != null).length,
      lost: leadRows.filter((l) => l.status === "lost").length,
      firstInquiryAt: leadRows.length ? leadRows[leadRows.length - 1]!.createdAt : null,
      nextTripDate: upcoming[0] ?? null,
    },
    possibleDuplicates: findDuplicateCustomers(ctx.db, ctx, { email: customer.email, phone: customer.phone, excludeId: customer.id }),
  };
}

export async function getCustomerVersion(ctx: ServiceContext, id: string) {
  return ctx.db
    .select({ id: customers.id, fullName: customers.fullName, version: customers.version })
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.workspaceId, ctx.workspace.id)))
    .get();
}

export function countCustomers(ctx: ServiceContext): number {
  return ctx.db.select({ n: sql<number>`count(*)` }).from(customers).where(eq(customers.workspaceId, ctx.workspace.id)).get()?.n ?? 0;
}
