/**
 * URL state for the customer directory. Client-safe: the unions come from the
 * service as types only, so labels here can never drift from what it accepts.
 */
import type { CustomerFilter, CustomerSort } from "@/server/services/customers";

export const CUSTOMER_FILTER_LABELS: Record<CustomerFilter, string> = {
  all: "All",
  open: "Open inquiries",
  repeat: "Repeat clients",
  company: "Companies",
};

export const CUSTOMER_SORT_LABELS: Record<CustomerSort, string> = {
  recent: "Most recent inquiry",
  name: "Name (A–Z)",
  inquiries: "Most inquiries",
  created: "Newest customers",
};

export const CUSTOMER_FILTER_OPTIONS = Object.keys(CUSTOMER_FILTER_LABELS) as CustomerFilter[];
export const CUSTOMER_SORT_OPTIONS = Object.keys(CUSTOMER_SORT_LABELS) as CustomerSort[];

export interface CustomerQuery {
  q: string;
  filter: CustomerFilter;
  sort: CustomerSort;
  page: number;
}

export const DEFAULT_CUSTOMER_QUERY: CustomerQuery = { q: "", filter: "all", sort: "recent", page: 1 };

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(values: readonly T[], raw: string | undefined): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** Tolerant parser — unknown values fall back to defaults; reading never writes. */
export function parseCustomerQuery(params: RawParams): CustomerQuery {
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    q: (first(params.q) ?? "").slice(0, 100),
    filter: oneOf(CUSTOMER_FILTER_OPTIONS, first(params.filter)) ?? DEFAULT_CUSTOMER_QUERY.filter,
    sort: oneOf(CUSTOMER_SORT_OPTIONS, first(params.sort)) ?? DEFAULT_CUSTOMER_QUERY.sort,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** `/customers?…` with only non-default values. */
export function customersHref(query: Partial<CustomerQuery> & { new?: boolean } = {}): string {
  const q = { ...DEFAULT_CUSTOMER_QUERY, ...query };
  const params = new URLSearchParams();
  if (q.q.trim()) params.set("q", q.q.trim());
  if (q.filter !== DEFAULT_CUSTOMER_QUERY.filter) params.set("filter", q.filter);
  if (q.sort !== DEFAULT_CUSTOMER_QUERY.sort) params.set("sort", q.sort);
  if (q.page > 1) params.set("page", String(q.page));
  if (query.new) params.set("new", "1");
  const qs = params.toString();
  return qs ? `/customers?${qs}` : "/customers";
}
