/**
 * URL contract for the operator directory. Shared by the server page (to
 * query) and the filter bar (to build links) so both read the URL identically.
 * Reading a URL never writes anything.
 *
 * Example (used by the lead fleet-match link): /operators?category=party_bus&minCapacity=30
 */
import { OPERATOR_STATUSES, type OperatorStatus } from "@/domain/operator";
import { VEHICLE_CATEGORIES, type VehicleCategory } from "@/domain/vehicle";
import type { OperatorSort, VerificationFilter } from "@/server/services/operators";

export const OPERATOR_SORT_OPTIONS = ["status", "name", "updated", "capacity"] as const satisfies readonly OperatorSort[];

export const OPERATOR_SORT_LABELS: Record<OperatorSort, string> = {
  status: "Relationship",
  name: "Name (A–Z)",
  updated: "Recently updated",
  capacity: "Largest vehicle",
};

export const VERIFICATION_FILTER_OPTIONS = ["complete", "incomplete", "attention"] as const satisfies readonly VerificationFilter[];

export const VERIFICATION_FILTER_LABELS: Record<VerificationFilter, string> = {
  complete: "All six checks verified",
  incomplete: "Verification incomplete",
  attention: "Expired or issue found",
};

/** Seat-count presets offered in the capacity filter. Any positive integer is accepted from the URL. */
export const CAPACITY_PRESETS = [8, 14, 20, 30, 40, 50] as const;

export const OPERATOR_PAGE_SIZE = 20;

export interface OperatorQuery {
  q: string;
  status: OperatorStatus[];
  category: VehicleCategory[];
  minCapacity: number | null;
  area: string;
  verification: VerificationFilter | null;
  sort: OperatorSort;
  page: number;
}

export const DEFAULT_OPERATOR_QUERY: OperatorQuery = {
  q: "",
  status: [],
  category: [],
  minCapacity: null,
  area: "",
  verification: null,
  sort: "status",
  page: 1,
};

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

function listOf<T extends string>(values: readonly T[], raw: string | undefined): T[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").filter((v): v is T => (values as readonly string[]).includes(v)))];
}

function oneOf<T extends string>(values: readonly T[], raw: string | undefined): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** Tolerant parser: unknown or malformed values fall back to defaults. */
export function parseOperatorQuery(params: RawParams): OperatorQuery {
  const capacity = Number.parseInt(read(params, "minCapacity") ?? "", 10);
  const page = Number.parseInt(read(params, "page") ?? "1", 10);
  return {
    q: (read(params, "q") ?? "").slice(0, 100),
    status: listOf(OPERATOR_STATUSES, read(params, "status")),
    category: listOf(VEHICLE_CATEGORIES, read(params, "category")),
    minCapacity: Number.isFinite(capacity) && capacity > 0 && capacity <= 200 ? capacity : null,
    area: (read(params, "area") ?? "").trim().slice(0, 60),
    verification: oneOf(VERIFICATION_FILTER_OPTIONS, read(params, "verification")),
    sort: oneOf(OPERATOR_SORT_OPTIONS, read(params, "sort")) ?? DEFAULT_OPERATOR_QUERY.sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Query string with only non-default values (no leading "?"). */
export function serializeOperatorQuery(query: Partial<OperatorQuery>): string {
  const q = { ...DEFAULT_OPERATOR_QUERY, ...query };
  const params = new URLSearchParams();
  if (q.q.trim()) params.set("q", q.q.trim());
  if (q.status.length) params.set("status", q.status.join(","));
  if (q.category.length) params.set("category", q.category.join(","));
  if (q.minCapacity) params.set("minCapacity", String(q.minCapacity));
  if (q.area.trim()) params.set("area", q.area.trim());
  if (q.verification) params.set("verification", q.verification);
  if (q.sort !== DEFAULT_OPERATOR_QUERY.sort) params.set("sort", q.sort);
  if (q.page > 1) params.set("page", String(q.page));
  return params.toString();
}

export function operatorsHref(query: Partial<OperatorQuery> = {}): string {
  const qs = serializeOperatorQuery(query);
  return qs ? `/operators?${qs}` : "/operators";
}

/** Refinements beyond free-text search (for "Clear" affordances). */
export function activeOperatorFilterCount(query: OperatorQuery): number {
  return (
    query.status.length +
    query.category.length +
    (query.minCapacity ? 1 : 0) +
    (query.area ? 1 : 0) +
    (query.verification ? 1 : 0)
  );
}

export function hasAnyOperatorFilter(query: OperatorQuery): boolean {
  return activeOperatorFilterCount(query) > 0 || query.q.trim().length > 0;
}
