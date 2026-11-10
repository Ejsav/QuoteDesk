/**
 * Activity logger and timeline queries.
 *
 * `logActivity` must be called inside the same transaction as the change it
 * records. It is also the only writer of `leads.last_activity_at`.
 */
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { ActivityPayloads, ActivityType } from "@/domain/activity";
import { leadTitle, type Occasion } from "@/domain/lead";
import { newId } from "@/lib/ids";
import type { Tx } from "../db/client";
import { activities, customers, leads, operators, users } from "../db/schema";
import type { ServiceContext } from "./context";

type Subject = { leadId: string } | { customerId: string } | { operatorId: string } | Record<string, never>;

export function logActivity<T extends ActivityType>(
  tx: Tx,
  ctx: ServiceContext,
  type: T,
  subject: Subject,
  data: ActivityPayloads[T],
  at: Date = ctx.now(),
): void {
  const leadId = "leadId" in subject ? subject.leadId : null;
  tx.insert(activities)
    .values({
      id: newId("act"),
      workspaceId: ctx.workspace.id,
      type,
      leadId,
      customerId: "customerId" in subject ? subject.customerId : null,
      operatorId: "operatorId" in subject ? subject.operatorId : null,
      actorId: ctx.user.id,
      data,
      createdAt: at,
    })
    .run();
  if (leadId) tx.update(leads).set({ lastActivityAt: at }).where(eq(leads.id, leadId)).run();
}

export interface ActivityView {
  id: string;
  type: ActivityType;
  data: unknown;
  createdAt: Date;
  actorName: string | null;
  lead: { id: string; number: number; title: string } | null;
  customer: { id: string; name: string } | null;
  operator: { id: string; name: string } | null;
}

function selectActivities(ctx: ServiceContext) {
  return ctx.db
    .select({
      id: activities.id,
      type: activities.type,
      data: activities.data,
      createdAt: activities.createdAt,
      actorName: users.name,
      leadId: leads.id,
      leadNumber: leads.number,
      leadEventName: leads.eventName,
      leadOccasion: leads.occasion,
      customerId: customers.id,
      customerName: customers.fullName,
      operatorId: operators.id,
      operatorName: operators.companyName,
    })
    .from(activities)
    .leftJoin(users, eq(users.id, activities.actorId))
    .leftJoin(leads, eq(leads.id, activities.leadId))
    .leftJoin(customers, eq(customers.id, activities.customerId))
    .leftJoin(operators, eq(operators.id, activities.operatorId));
}

type ActivitySelectRow = ReturnType<ReturnType<typeof selectActivities>["all"]>[number];

function toView(row: ActivitySelectRow): ActivityView {
  return {
    id: row.id,
    type: row.type,
    data: row.data,
    createdAt: row.createdAt,
    actorName: row.actorName,
    lead:
      row.leadId && row.leadNumber != null
        ? { id: row.leadId, number: row.leadNumber, title: leadTitle({ eventName: row.leadEventName, occasion: row.leadOccasion as Occasion | null }) }
        : null,
    customer: row.customerId && row.customerName ? { id: row.customerId, name: row.customerName } : null,
    operator: row.operatorId && row.operatorName ? { id: row.operatorId, name: row.operatorName } : null,
  };
}

export async function listLeadActivity(ctx: ServiceContext, leadId: string): Promise<ActivityView[]> {
  return selectActivities(ctx)
    .where(and(eq(activities.workspaceId, ctx.workspace.id), eq(activities.leadId, leadId)))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .all()
    .map(toView);
}

/** A customer's own entries plus everything on their current inquiries. */
export async function listCustomerActivity(ctx: ServiceContext, customerId: string, limit = 50): Promise<ActivityView[]> {
  const leadIds = ctx.db.select({ id: leads.id }).from(leads).where(eq(leads.customerId, customerId));
  return selectActivities(ctx)
    .where(
      and(
        eq(activities.workspaceId, ctx.workspace.id),
        or(eq(activities.customerId, customerId), inArray(activities.leadId, leadIds)),
      ),
    )
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit)
    .all()
    .map(toView);
}

export async function listOperatorActivity(ctx: ServiceContext, operatorId: string, limit = 50): Promise<ActivityView[]> {
  return selectActivities(ctx)
    .where(and(eq(activities.workspaceId, ctx.workspace.id), eq(activities.operatorId, operatorId)))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit)
    .all()
    .map(toView);
}

export async function listWorkspaceActivity(ctx: ServiceContext, limit = 12): Promise<ActivityView[]> {
  return selectActivities(ctx)
    .where(eq(activities.workspaceId, ctx.workspace.id))
    .orderBy(desc(activities.createdAt), desc(activities.id))
    .limit(limit)
    .all()
    .map(toView);
}

export function countActivities(ctx: ServiceContext): number {
  return (
    ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(activities)
      .where(eq(activities.workspaceId, ctx.workspace.id))
      .get()?.n ?? 0
  );
}
