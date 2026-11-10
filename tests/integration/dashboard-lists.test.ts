import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { attentionReason, LEAD_STATUSES } from "@/domain/lead";
import { DEFAULT_LEAD_QUERY, LEAD_VIEWS, type LeadQuery } from "@/domain/lead-query";
import { activities, leads } from "@/server/db/schema";
import type { ServiceContext } from "@/server/services/context";
import { listCustomers } from "@/server/services/customers";
import { getDashboard } from "@/server/services/dashboard";
import { clockOf, getAttentionQueue, getLeadViewCounts, listLeads } from "@/server/services/leads";
import { globalSearch } from "@/server/services/search";
import { seededContext } from "../helpers/context";

let ctx: ServiceContext;

beforeAll(async () => {
  ({ ctx } = await seededContext());
});

const q = (overrides: Partial<LeadQuery>): LeadQuery => ({ ...DEFAULT_LEAD_QUERY, ...overrides });

describe("demo dataset integrity", () => {
  it("never has activity in the future, and lastActivityAt matches the latest entry", () => {
    const now = ctx.now().getTime();
    expect(ctx.db.select({ n: sql<number>`count(*)` }).from(activities).where(sql`${activities.createdAt} > ${now}`).get()?.n).toBe(0);
    const mismatched = ctx.db.all<{ id: string }>(
      sql`select l.id from leads l where l.last_activity_at <> (select max(a.created_at) from activities a where a.lead_id = l.id)`,
    );
    expect(mismatched).toHaveLength(0);
  });
});

describe("attention rules", () => {
  it("SQL filter and domain function agree on every lead", async () => {
    const queue = await getAttentionQueue(ctx);
    const c = clockOf(ctx);
    const all = ctx.db.select().from(leads).where(eq(leads.workspaceId, ctx.workspace.id)).all();
    const expected = all.filter((l) => attentionReason(l, c) != null).map((l) => l.id).sort();
    expect(queue.map((l) => l.id).sort()).toEqual(expected);
    expect(queue.length).toBeGreaterThan(0);
  });
});

describe("views, filters and sorting", () => {
  it("view counts match their lists", async () => {
    const counts = await getLeadViewCounts(ctx);
    for (const view of LEAD_VIEWS) {
      const page = await listLeads(ctx, q({ view }), 500);
      expect(page.total, view).toBe(counts[view]);
    }
    const byStatus = Object.fromEntries(
      LEAD_STATUSES.map((s) => [s, ctx.db.select({ n: sql<number>`count(*)` }).from(leads).where(eq(leads.status, s)).get()?.n ?? 0]),
    );
    expect(counts.all).toBe(Object.values(byStatus).reduce((a, b) => a + b, 0));
    expect(counts.open).toBe(counts.all - byStatus.lost!);
    expect(counts.new).toBe(byStatus.new);
  });

  it("sorts by trip date with undated leads last", async () => {
    const rows = (await listLeads(ctx, q({ view: "all", sort: "trip" }), 500)).rows;
    const dated = rows.filter((r) => r.tripDate).map((r) => r.tripDate!);
    expect(dated).toEqual([...dated].sort());
    const firstUndated = rows.findIndex((r) => !r.tripDate);
    expect(firstUndated === -1 || rows.slice(firstUndated).every((r) => !r.tripDate)).toBe(true);
  });

  it("filters combine with views and search", async () => {
    const qualified = await listLeads(ctx, q({ view: "open", status: ["qualified"] }), 500);
    expect(qualified.rows.every((r) => r.status === "qualified")).toBe(true);
    const byNumber = await listLeads(ctx, q({ view: "all", q: "L-1046" }));
    expect(byNumber.rows.map((r) => r.number)).toContain(1046);
  });

  it("reading lists never modifies records", async () => {
    const snapshot = () => ctx.db.get<{ v: number; u: number; a: number }>(sql`select sum(version) v, max(updated_at) u, (select count(*) from activities) a from leads`);
    const before = snapshot();
    for (const view of LEAD_VIEWS) await listLeads(ctx, q({ view, sort: view === "attention" ? "attention" : "priority", q: "a" }));
    await getLeadViewCounts(ctx);
    await getDashboard(ctx);
    await listCustomers(ctx, { q: "555", filter: "repeat" });
    await globalSearch(ctx, "Mercer");
    expect(snapshot()).toEqual(before);
  });
});

describe("dashboard", () => {
  it("derives every metric from records", async () => {
    const d = await getDashboard(ctx);
    const counts = await getLeadViewCounts(ctx);
    expect(d.pipeline.total).toBe(counts.all);
    expect(d.kpis.active).toBe(d.pipeline.byStatus.new + d.pipeline.byStatus.contacted + d.pipeline.byStatus.qualified);
    expect(d.kpis.awaitingFirstContact).toBe(counts.new);
    expect(d.kpis.upcomingTrips).toBe(counts.upcoming);
    expect(d.kpis.followUpsOverdue + d.kpis.followUpsToday).toBe(counts.follow_up);
    expect(d.attention.total).toBe(counts.attention);
    expect(d.volume).toHaveLength(12);
    expect(d.sources.reduce((sum, s) => sum + s.inquiries, 0)).toBe(d.qualification.inquiries);
    expect(d.qualification.rate).toBeCloseTo(d.qualification.qualified / d.qualification.inquiries);
  });

  it("finds customers by phone digits and leads by reference in global search", async () => {
    const results = await globalSearch(ctx, "555-0161");
    expect(results.customers.map((c) => c.fullName).sort()).toEqual(["Jon Mercer", "Jonathan Mercer"]);
  });
});
