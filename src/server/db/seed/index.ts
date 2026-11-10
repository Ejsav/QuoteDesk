/**
 * Demo workspace seed: "Arden & Lake Transportation", a fictional premium
 * ground-transportation broker in Chicago (business time zone America/Chicago).
 *
 * Only the workspace and user rows are inserted directly. Every customer,
 * inquiry, status change, follow-up, note, operator, vehicle and verification
 * record is replayed chronologically through the real services on a simulated
 * clock — so activity timelines, derived timestamps (first response,
 * qualified-at, last activity) and dashboard metrics are exactly what the app
 * itself would have produced. All dates are relative to the moment of seeding.
 *
 * Refuses to run against a database that already has a workspace.
 */
import { eq, sql } from "drizzle-orm";
import { DEFAULT_BUSINESS_TIME_ZONE } from "@/domain/dates";
import { LEAD_STATUSES, type LeadStatus } from "@/domain/lead";
import { newId } from "@/lib/ids";
import type { ServiceContext } from "../../services/context";
import type { Connection } from "../client";
import { activities, customers, leads, operatorCompliance, operatorVehicles, operators, users, workspaces } from "../schema";
import { SeedClock } from "./clock";
import { customerSeeds } from "./data/customers";
import { contactedLeadSeeds, newLeadSeeds } from "./data/leads-active";
import { lostLeadSeeds } from "./data/leads-closed";
import { onHoldLeadSeeds, qualifiedLeadSeeds } from "./data/leads-pipeline";
import { operatorSeeds } from "./data/operators";
import { createRegistry, scheduleCustomers, scheduleLeads, scheduleOperators } from "./schedule";
import { Timeline } from "./timeline";

export const DEMO_WORKSPACE = {
  name: "Arden & Lake Transportation",
  slug: "arden-lake",
  timeZone: DEFAULT_BUSINESS_TIME_ZONE,
  currency: "USD",
} as const;

export const DEMO_USER = { name: "Jordan Avery", email: "jordan@ardenlake.example", role: "owner" } as const;

export interface SeedSummary {
  workspace: string;
  timeZone: string;
  customers: number;
  leads: number;
  leadsByStatus: Record<LeadStatus, number>;
  operators: number;
  vehicles: number;
  verificationRecords: number;
  activities: number;
  events: number;
}

export class WorkspaceExistsError extends Error {
  constructor() {
    super("Refusing to seed: this database already contains a workspace. Seeding never modifies existing data.");
    this.name = "WorkspaceExistsError";
  }
}

export async function seedDemoData(connection: Connection, options: { now?: Date } = {}): Promise<SeedSummary> {
  const { db } = connection;
  if (db.select({ id: workspaces.id }).from(workspaces).limit(1).get()) throw new WorkspaceExistsError();

  const now = options.now ?? new Date();
  const clock = new SeedClock(DEMO_WORKSPACE.timeZone, now);
  const createdAt = clock.ago(100, "09:00");
  const workspaceId = newId("ws");
  const userId = newId("usr");

  db.insert(workspaces).values({ id: workspaceId, ...DEMO_WORKSPACE, nextLeadNumber: 1001, createdAt }).run();
  db.insert(users).values({ id: userId, workspaceId, ...DEMO_USER, createdAt }).run();

  let simulatedNow = createdAt;
  const ctx: ServiceContext = {
    db,
    workspace: { id: workspaceId, name: DEMO_WORKSPACE.name, timeZone: DEMO_WORKSPACE.timeZone, currency: DEMO_WORKSPACE.currency },
    user: { id: userId, name: DEMO_USER.name },
    now: () => simulatedNow,
  };

  const customerList = customerSeeds(clock);
  const leadList = [
    ...newLeadSeeds(clock),
    ...contactedLeadSeeds(clock),
    ...qualifiedLeadSeeds(clock),
    ...onHoldLeadSeeds(clock),
    ...lostLeadSeeds(clock),
  ];

  // Nothing may happen after "now": the latest allowed moment is one minute ago.
  const timeline = new Timeline(now.getTime() - 60_000);
  const registry = createRegistry();
  scheduleOperators(timeline, ctx, registry, operatorSeeds(clock));
  scheduleCustomers(timeline, ctx, registry, customerList, leadList);
  scheduleLeads(timeline, ctx, registry, customerList, leadList);

  const events = await timeline.replay((moment) => {
    simulatedNow = moment;
  });
  return summarize(connection, workspaceId, events);
}

function count(connection: Connection, table: typeof customers | typeof leads | typeof operators | typeof activities, workspaceId: string): number {
  return Number(
    connection.db
      .select({ n: sql<number>`count(*)` })
      .from(table)
      .where(eq(table.workspaceId, workspaceId))
      .get()?.n ?? 0,
  );
}

function summarize(connection: Connection, workspaceId: string, events: number): SeedSummary {
  const { db } = connection;
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const row of db
    .select({ status: leads.status, n: sql<number>`count(*)` })
    .from(leads)
    .where(eq(leads.workspaceId, workspaceId))
    .groupBy(leads.status)
    .all()) {
    byStatus[row.status] = Number(row.n);
  }
  const vehicles = Number(
    db
      .select({ n: sql<number>`count(*)` })
      .from(operatorVehicles)
      .innerJoin(operators, eq(operators.id, operatorVehicles.operatorId))
      .where(eq(operators.workspaceId, workspaceId))
      .get()?.n ?? 0,
  );
  const verificationRecords = Number(
    db
      .select({ n: sql<number>`count(*)` })
      .from(operatorCompliance)
      .innerJoin(operators, eq(operators.id, operatorCompliance.operatorId))
      .where(eq(operators.workspaceId, workspaceId))
      .get()?.n ?? 0,
  );
  return {
    workspace: DEMO_WORKSPACE.name,
    timeZone: DEMO_WORKSPACE.timeZone,
    customers: count(connection, customers, workspaceId),
    leads: count(connection, leads, workspaceId),
    leadsByStatus: byStatus,
    operators: count(connection, operators, workspaceId),
    vehicles,
    verificationRecords,
    activities: count(connection, activities, workspaceId),
    events,
  };
}

export function formatSeedSummary(summary: SeedSummary): string {
  const statuses = LEAD_STATUSES.map((s) => `${s.replace("_", " ")} ${summary.leadsByStatus[s]}`).join(", ");
  return [
    `  Workspace   ${summary.workspace} (${summary.timeZone})`,
    `  Customers   ${summary.customers}`,
    `  Inquiries   ${summary.leads} — ${statuses}`,
    `  Operators   ${summary.operators} with ${summary.vehicles} vehicle records and ${summary.verificationRecords} verification records`,
    `  Activity    ${summary.activities} timeline entries (${summary.events} replayed events)`,
  ].join("\n");
}
