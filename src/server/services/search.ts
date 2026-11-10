/**
 * Global search for the command palette — leads, customers and operators.
 * Reuses each workspace's list query so search and lists can never disagree.
 */
import { DEFAULT_LEAD_QUERY } from "@/domain/lead-query";
import { leadTitle, type LeadStatus } from "@/domain/lead";
import type { OperatorStatus } from "@/domain/operator";
import type { PlainDate } from "@/domain/dates";
import type { ServiceContext } from "./context";
import { listCustomers } from "./customers";
import { listLeads } from "./leads";
import { listOperators } from "./operators";

export interface SearchResults {
  query: string;
  leads: Array<{ id: string; number: number; title: string; customerName: string; status: LeadStatus; tripDate: PlainDate | null }>;
  customers: Array<{ id: string; fullName: string; companyName: string | null; email: string | null; phone: string | null; leadCount: number }>;
  operators: Array<{ id: string; companyName: string; baseLocation: string | null; status: OperatorStatus; serviceAreas: string[] }>;
}

export async function globalSearch(ctx: ServiceContext, rawQuery: string, perGroup = 5): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 100);
  if (query.length === 0) return { query, leads: [], customers: [], operators: [] };

  const [leadPage, customerPage, operatorPage] = await Promise.all([
    listLeads(ctx, { ...DEFAULT_LEAD_QUERY, view: "all", q: query, sort: "newest" }, perGroup),
    listCustomers(ctx, { q: query, sort: "recent", pageSize: perGroup }),
    listOperators(ctx, { q: query, sort: "status", pageSize: perGroup }),
  ]);

  return {
    query,
    leads: leadPage.rows.map((l) => ({
      id: l.id,
      number: l.number,
      title: leadTitle(l),
      customerName: l.customer.fullName,
      status: l.status,
      tripDate: l.tripDate,
    })),
    customers: customerPage.rows.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      companyName: c.companyName,
      email: c.email,
      phone: c.phone,
      leadCount: c.leadCount,
    })),
    operators: operatorPage.rows.map((o) => ({
      id: o.id,
      companyName: o.companyName,
      baseLocation: o.baseLocation,
      status: o.status,
      serviceAreas: o.serviceAreas,
    })),
  };
}
