/**
 * Command Center metrics. Everything is computed from records at request time.
 *
 * Definitions (also shown in the UI):
 * - Received: inquiries created in the window (business time zone).
 * - Active: status New, Contacted or Qualified.
 * - Qualification rate: of inquiries received in the last 90 days, the share
 *   that have reached Qualified at any point. It is NOT a booking rate —
 *   bookings don't exist in this release.
 * - First response: time from an inquiry's creation to the first move out of
 *   New or the first logged contact.
 */
import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { addDays, plainDateOfInstant, startOfWeek, type PlainDate } from "@/domain/dates";
import { LEAD_SOURCES, LEAD_STATUSES, type AttentionReason, type LeadSource, type LeadStatus } from "@/domain/lead";
import { UPCOMING_WINDOW_DAYS } from "@/domain/lead-query";
import { leads } from "../db/schema";
import { listWorkspaceActivity, type ActivityView } from "./activity-log";
import type { ServiceContext } from "./context";
import { clockOf, getAttentionQueue, listUpcomingTrips, viewCondition, type LeadListRow } from "./leads";

const DAY_MS = 86_400_000;
export const VOLUME_WEEKS = 12;
export const QUALIFICATION_WINDOW_DAYS = 90;
export const RESPONSE_WINDOW_DAYS = 30;

export interface DashboardData {
  today: PlainDate;
  greeting: "morning" | "afternoon" | "evening";
  kpis: {
    received7d: number;
    receivedPrev7d: number;
    awaitingFirstContact: number;
    oldestAwaitingHours: number | null;
    active: number;
    qualified: number;
    followUpsOverdue: number;
    followUpsToday: number;
    upcomingTrips: number;
    upcomingUnqualified: number;
  };
  attention: { items: Array<LeadListRow & { attention: AttentionReason }>; total: number };
  upcoming: LeadListRow[];
  volume: Array<{ weekStart: PlainDate; total: number; qualified: number }>;
  sources: Array<{ source: LeadSource; inquiries: number; qualified: number; medianResponseMs: number | null }>;
  pipeline: { byStatus: Record<LeadStatus, number>; total: number };
  qualification: { inquiries: number; qualified: number; rate: number | null };
  response: { medianMs: number | null; responded: number; awaiting: number };
  activity: ActivityView[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function greetingFor(now: Date, timeZone: string): DashboardData["greeting"] {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(now));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

export async function getDashboard(ctx: ServiceContext): Promise<DashboardData> {
  const c = clockOf(ctx);
  const tz = ctx.workspace.timeZone;
  const nowMs = c.now.getTime();
  const ws = eq(leads.workspaceId, ctx.workspace.id);

  // --- Pipeline & KPI counts -------------------------------------------------
  const statusRows = ctx.db
    .select({ status: leads.status, n: sql<number>`count(*)` })
    .from(leads)
    .where(ws)
    .groupBy(leads.status)
    .all();
  const byStatus = Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) as Record<LeadStatus, number>;
  for (const r of statusRows) byStatus[r.status] = Number(r.n);
  const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

  const count = (cond: ReturnType<typeof sql> | undefined) =>
    Number(ctx.db.select({ n: sql<number>`count(*)` }).from(leads).where(and(ws, cond)).get()?.n ?? 0);

  const received7d = count(sql`${leads.createdAt} >= ${nowMs - 7 * DAY_MS}`);
  const receivedPrev7d = count(sql`${leads.createdAt} >= ${nowMs - 14 * DAY_MS} and ${leads.createdAt} < ${nowMs - 7 * DAY_MS}`);
  const followUpsOverdue = count(sql`${leads.status} <> 'lost' and ${leads.followUpDate} < ${c.today}`);
  const followUpsToday = count(sql`${leads.status} <> 'lost' and ${leads.followUpDate} = ${c.today}`);
  const upcomingCond = viewCondition("upcoming", c);
  const upcomingTrips = count(upcomingCond);
  const upcomingUnqualified = count(and(upcomingCond, inArray(leads.status, ["new", "contacted"])));

  const oldestNew = ctx.db
    .select({ createdAt: sql<number | null>`min(${leads.createdAt})` })
    .from(leads)
    .where(and(ws, eq(leads.status, "new")))
    .get()?.createdAt;

  // --- Cohorts (computed in the business time zone) --------------------------
  const volumeStart = addDays(startOfWeek(c.today), -7 * (VOLUME_WEEKS - 1));
  const cohortSince = Math.min(nowMs - QUALIFICATION_WINDOW_DAYS * DAY_MS, nowMs - (VOLUME_WEEKS * 7 + 7) * DAY_MS);
  const cohort = ctx.db
    .select({
      createdAt: leads.createdAt,
      qualifiedAt: leads.qualifiedAt,
      firstResponseAt: leads.firstResponseAt,
      source: leads.source,
      status: leads.status,
    })
    .from(leads)
    .where(and(ws, gte(leads.createdAt, new Date(cohortSince))))
    .all();

  const weeks = Array.from({ length: VOLUME_WEEKS }, (_, i) => ({ weekStart: addDays(volumeStart, i * 7), total: 0, qualified: 0 }));
  const weekIndex = new Map(weeks.map((w, i) => [w.weekStart, i]));
  for (const lead of cohort) {
    const week = startOfWeek(plainDateOfInstant(lead.createdAt, tz));
    const i = weekIndex.get(week);
    if (i == null) continue;
    weeks[i]!.total += 1;
    if (lead.qualifiedAt) weeks[i]!.qualified += 1;
  }

  const qualWindow = cohort.filter((l) => l.createdAt.getTime() >= nowMs - QUALIFICATION_WINDOW_DAYS * DAY_MS);
  const qualifiedCount = qualWindow.filter((l) => l.qualifiedAt).length;

  const sources = LEAD_SOURCES.map((source) => {
    const group = qualWindow.filter((l) => l.source === source);
    return {
      source,
      inquiries: group.length,
      qualified: group.filter((l) => l.qualifiedAt).length,
      medianResponseMs: median(group.filter((l) => l.firstResponseAt).map((l) => l.firstResponseAt!.getTime() - l.createdAt.getTime())),
    };
  })
    .filter((s) => s.inquiries > 0)
    .sort((a, b) => b.inquiries - a.inquiries || b.qualified - a.qualified);

  const responseWindow = cohort.filter((l) => l.createdAt.getTime() >= nowMs - RESPONSE_WINDOW_DAYS * DAY_MS);
  const responseTimes = responseWindow.filter((l) => l.firstResponseAt).map((l) => l.firstResponseAt!.getTime() - l.createdAt.getTime());

  // --- Lists -------------------------------------------------------------------
  const attentionAll = await getAttentionQueue(ctx);
  const upcoming = await listUpcomingTrips(ctx, UPCOMING_WINDOW_DAYS, 8);
  const activity = await listWorkspaceActivity(ctx, 9);

  return {
    today: c.today,
    greeting: greetingFor(c.now, tz),
    kpis: {
      received7d,
      receivedPrev7d,
      awaitingFirstContact: byStatus.new,
      oldestAwaitingHours: oldestNew != null ? Math.floor((nowMs - Number(oldestNew)) / 3_600_000) : null,
      active: byStatus.new + byStatus.contacted + byStatus.qualified,
      qualified: byStatus.qualified,
      followUpsOverdue,
      followUpsToday,
      upcomingTrips,
      upcomingUnqualified,
    },
    attention: { items: attentionAll.slice(0, 7), total: attentionAll.length },
    upcoming,
    volume: weeks,
    sources,
    pipeline: { byStatus, total },
    qualification: {
      inquiries: qualWindow.length,
      qualified: qualifiedCount,
      rate: qualWindow.length ? qualifiedCount / qualWindow.length : null,
    },
    response: {
      medianMs: median(responseTimes),
      responded: responseTimes.length,
      awaiting: responseWindow.filter((l) => l.status === "new").length,
    },
    activity,
  };
}
