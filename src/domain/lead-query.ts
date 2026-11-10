/**
 * The leads workspace is URL-driven: views, filters, sorting and paging live
 * in the query string so every state is shareable and survives refreshes.
 * Reading a URL never writes anything. This module is shared by the server
 * (to query) and the filter bar (to build links), so both agree exactly.
 */
import {
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STATUSES,
  OCCASIONS,
  type LeadPriority,
  type LeadSource,
  type LeadStatus,
  type Occasion,
} from "./lead";
import { VEHICLE_PREFERENCES, type VehiclePreference } from "./vehicle";

export const LEAD_VIEWS = ["open", "attention", "new", "follow_up", "upcoming", "qualified", "on_hold", "lost", "all"] as const;
export type LeadView = (typeof LEAD_VIEWS)[number];

export const UPCOMING_WINDOW_DAYS = 14;

export const LEAD_SORTS = ["attention", "newest", "oldest", "trip", "trip_desc", "follow_up", "updated", "priority"] as const;
export type LeadSort = (typeof LEAD_SORTS)[number];

export const LEAD_SORT_LABELS: Record<LeadSort, string> = {
  attention: "Most urgent",
  newest: "Newest inquiries",
  oldest: "Oldest inquiries",
  trip: "Trip date (soonest)",
  trip_desc: "Trip date (latest)",
  follow_up: "Follow-up date",
  updated: "Recently active",
  priority: "Priority",
};

export const LEAD_VIEW_META: Record<LeadView, { label: string; description: string; defaultSort: LeadSort }> = {
  open: { label: "Open", description: "Every lead that hasn't been lost", defaultSort: "newest" },
  attention: { label: "Needs attention", description: "Leads that need someone today", defaultSort: "attention" },
  new: { label: "New", description: "Awaiting first contact — longest waiting first", defaultSort: "oldest" },
  follow_up: { label: "Follow-ups due", description: "Overdue and due today", defaultSort: "follow_up" },
  upcoming: { label: "Upcoming trips", description: `Open leads with trips in the next ${UPCOMING_WINDOW_DAYS} days`, defaultSort: "trip" },
  qualified: { label: "Qualified", description: "Ready to quote", defaultSort: "trip" },
  on_hold: { label: "On hold", description: "Paused by the customer", defaultSort: "updated" },
  lost: { label: "Lost", description: "Closed without moving forward", defaultSort: "updated" },
  all: { label: "All", description: "Every inquiry", defaultSort: "newest" },
};

export const TRIP_WINDOWS = ["next7", "next30", "this_month", "later", "past", "none"] as const;
export type TripWindow = (typeof TRIP_WINDOWS)[number];
export const TRIP_WINDOW_LABELS: Record<TripWindow, string> = {
  next7: "Next 7 days",
  next30: "Next 30 days",
  this_month: "This month",
  later: "More than 30 days out",
  past: "Trip date passed",
  none: "No date yet",
};

export const RECEIVED_WINDOWS = ["today", "7d", "30d", "90d"] as const;
export type ReceivedWindow = (typeof RECEIVED_WINDOWS)[number];
export const RECEIVED_WINDOW_LABELS: Record<ReceivedWindow, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export const FOLLOW_UP_FILTERS = ["overdue", "today", "upcoming", "none"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];
export const FOLLOW_UP_FILTER_LABELS: Record<FollowUpFilter, string> = {
  overdue: "Overdue",
  today: "Due today",
  upcoming: "Scheduled",
  none: "No follow-up",
};

export interface LeadQuery {
  view: LeadView;
  q: string;
  status: LeadStatus[];
  priority: LeadPriority[];
  source: LeadSource[];
  occasion: Occasion[];
  vehicle: VehiclePreference[];
  trip: TripWindow | null;
  received: ReceivedWindow | null;
  followUp: FollowUpFilter | null;
  /** null = the view's default sort */
  sort: LeadSort | null;
  page: number;
}

export const DEFAULT_LEAD_QUERY: LeadQuery = {
  view: "open",
  q: "",
  status: [],
  priority: [],
  source: [],
  occasion: [],
  vehicle: [],
  trip: null,
  received: null,
  followUp: null,
  sort: null,
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function oneOf<T extends string>(values: readonly T[], raw: string | undefined): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

function listOf<T extends string>(values: readonly T[], raw: string | undefined): T[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").filter((v): v is T => (values as readonly string[]).includes(v)))];
}

/** Tolerant parser: unknown or malformed values fall back to defaults. */
export function parseLeadQuery(params: RawParams): LeadQuery {
  const view = oneOf(LEAD_VIEWS, read(params, "view")) ?? DEFAULT_LEAD_QUERY.view;
  let sort = oneOf(LEAD_SORTS, read(params, "sort"));
  if (sort === "attention" && view !== "attention") sort = null;
  const page = Number.parseInt(read(params, "page") ?? "1", 10);
  return {
    view,
    q: (read(params, "q") ?? "").slice(0, 100),
    status: listOf(LEAD_STATUSES, read(params, "status")),
    priority: listOf(LEAD_PRIORITIES, read(params, "priority")),
    source: listOf(LEAD_SOURCES, read(params, "source")),
    occasion: listOf(OCCASIONS, read(params, "occasion")),
    vehicle: listOf(VEHICLE_PREFERENCES, read(params, "vehicle")),
    trip: oneOf(TRIP_WINDOWS, read(params, "trip")),
    received: oneOf(RECEIVED_WINDOWS, read(params, "received")),
    followUp: oneOf(FOLLOW_UP_FILTERS, read(params, "followUp")),
    sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Query string containing only non-default values (no leading "?"). */
export function serializeLeadQuery(query: Partial<LeadQuery>): string {
  const q = { ...DEFAULT_LEAD_QUERY, ...query };
  const params = new URLSearchParams();
  if (q.view !== DEFAULT_LEAD_QUERY.view) params.set("view", q.view);
  if (q.q.trim()) params.set("q", q.q.trim());
  for (const key of ["status", "priority", "source", "occasion", "vehicle"] as const) {
    if (q[key].length) params.set(key, q[key].join(","));
  }
  if (q.trip) params.set("trip", q.trip);
  if (q.received) params.set("received", q.received);
  if (q.followUp) params.set("followUp", q.followUp);
  if (q.sort && q.sort !== LEAD_VIEW_META[q.view].defaultSort) params.set("sort", q.sort);
  if (q.page > 1) params.set("page", String(q.page));
  return params.toString();
}

export function leadsHref(query: Partial<LeadQuery> = {}): string {
  const qs = serializeLeadQuery(query);
  return qs ? `/leads?${qs}` : "/leads";
}

export function effectiveSort(query: LeadQuery): LeadSort {
  return query.sort ?? LEAD_VIEW_META[query.view].defaultSort;
}

/** Number of refinements beyond the view (for the "Filters (3)" badge). */
export function activeFilterCount(query: LeadQuery): number {
  return (
    query.status.length +
    query.priority.length +
    query.source.length +
    query.occasion.length +
    query.vehicle.length +
    (query.trip ? 1 : 0) +
    (query.received ? 1 : 0) +
    (query.followUp ? 1 : 0)
  );
}
