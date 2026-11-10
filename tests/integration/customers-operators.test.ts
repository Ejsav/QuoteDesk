import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createCustomerSchema, updateCustomerSchema } from "@/domain/schemas/customer";
import { createLeadSchema } from "@/domain/schemas/lead";
import { createOperatorSchema, upsertComplianceSchema, upsertVehicleSchema } from "@/domain/schemas/operator";
import { operatorCompliance } from "@/server/db/schema";
import { createCustomer, deleteCustomer, getCustomer, mergeCustomers, updateCustomer } from "@/server/services/customers";
import { DuplicateCustomerError, RuleError, ValidationError } from "@/server/services/errors";
import { createLead, getLead } from "@/server/services/leads";
import { changeOperatorStatus, createOperator, findFleetMatches, getOperator, upsertCompliance, upsertVehicle } from "@/server/services/operators";
import { emptyContext, requestId } from "../helpers/context";

async function customer(t: ReturnType<typeof emptyContext>, fullName: string, phone: string | null, email: string | null = null, confirmDuplicate = false) {
  return createCustomer(t.ctx, createCustomerSchema.parse({ fullName, phone, email, clientRequestId: requestId(), confirmDuplicate }));
}

async function leadFor(t: ReturnType<typeof emptyContext>, customerId: string) {
  return createLead(t.ctx, createLeadSchema.parse({ customer: { mode: "existing", customerId }, source: "phone", timeZone: "America/Chicago", clientRequestId: requestId() }));
}

describe("customers", () => {
  it("won't delete a customer who still has inquiries", async () => {
    const t = emptyContext();
    const { id } = await customer(t, "Sarah Chen", "(312) 555-0101");
    await leadFor(t, id);
    await expect(deleteCustomer(t.ctx, { id })).rejects.toBeInstanceOf(RuleError);
    const empty = await customer(t, "Walk-in Contact", null, "walkin@example.com");
    await expect(deleteCustomer(t.ctx, { id: empty.id })).resolves.toEqual({ name: "Walk-in Contact" });
  });

  it("detects duplicates on changed contact details, never silently merging", async () => {
    const t = emptyContext();
    await customer(t, "Jon Mercer", "(773) 555-0161");
    const other = await customer(t, "Jonathan Mercer", null, "jmercer@example.org");
    const edit = { id: other.id, version: 1, fullName: "Jonathan Mercer", email: "jmercer@example.org", phone: "773.555.0161" };
    await expect(updateCustomer(t.ctx, updateCustomerSchema.parse(edit))).rejects.toBeInstanceOf(DuplicateCustomerError);
    await expect(updateCustomer(t.ctx, updateCustomerSchema.parse({ ...edit, confirmDuplicate: true }))).resolves.toMatchObject({ version: 2 });
  });

  it("merges a duplicate: inquiries move, missing details fill in, the source disappears", async () => {
    const t = emptyContext();
    const target = await customer(t, "Jon Mercer", "(773) 555-0161");
    const source = await customer(t, "Jonathan Mercer", "(773) 555-0161", "jmercer@example.org", true);
    const lead = await leadFor(t, source.id);
    const result = await mergeCustomers(t.ctx, { sourceId: source.id, targetId: target.id });
    expect(result).toEqual({ targetId: target.id, leadsMoved: 1 });
    expect(await getCustomer(t.ctx, source.id)).toBeNull();
    const merged = await getCustomer(t.ctx, target.id);
    expect(merged?.customer.email).toBe("jmercer@example.org");
    expect(merged?.leads.map((l) => l.id)).toEqual([lead.id]);
    expect((await getLead(t.ctx, lead.id))?.customer.id).toBe(target.id);
  });
});

describe("operators", () => {
  async function operator(t: ReturnType<typeof emptyContext>, companyName: string, status: "active" | "paused" = "active") {
    return createOperator(t.ctx, createOperatorSchema.parse({ companyName, status, clientRequestId: requestId(), serviceAreas: ["Chicago", "chicago", "O'Hare (ORD)"] }));
  }

  it("dedupes service areas and rejects duplicate operator names", async () => {
    const t = emptyContext();
    const { id } = await operator(t, "Halden & Pike Chauffeured");
    expect((await getOperator(t.ctx, id))?.operator.serviceAreas).toEqual(["Chicago", "O'Hare (ORD)"]);
    const error = await operator(t, "halden & pike chauffeured").catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).fieldErrors.companyName?.[0]).toMatch(/already exists/);
  });

  it("only records 'verified' with a date and evidence — enforced by schema and database", async () => {
    const t = emptyContext();
    const { id } = await operator(t, "Copperline Party Coaches");
    const unverifiable = upsertComplianceSchema.safeParse({ operatorId: id, kind: "insurance", status: "verified" });
    expect(unverifiable.success).toBe(false);
    if (!unverifiable.success) expect(unverifiable.error.issues.map((i) => i.path[0]).sort()).toEqual(["evidenceNote", "verifiedOn"]);

    const record = await upsertCompliance(
      t.ctx,
      upsertComplianceSchema.parse({ operatorId: id, kind: "insurance", status: "verified", verifiedOn: "2026-11-01", evidenceNote: "COI from agent; limits confirmed by phone.", expiresOn: "2027-04-01" }),
    );
    const stored = t.ctx.db.select().from(operatorCompliance).where(eq(operatorCompliance.id, record.id)).get();
    expect(stored?.verifiedById).toBe(t.ctx.user.id);
    expect(() => t.ctx.db.update(operatorCompliance).set({ evidenceNote: null }).where(eq(operatorCompliance.id, record.id)).run()).toThrow(/CHECK/);
    await expect(
      upsertCompliance(t.ctx, upsertComplianceSchema.parse({ operatorId: id, kind: "insurance", status: "reported" })),
    ).rejects.toBeInstanceOf(RuleError);
  });

  it("derives expiry at read time", async () => {
    const t = emptyContext();
    const { id } = await operator(t, "Vesper Lane Livery");
    await upsertCompliance(t.ctx, upsertComplianceSchema.parse({ operatorId: id, kind: "insurance", status: "received", expiresOn: "2026-11-01" }));
    expect((await getOperator(t.ctx, id))?.verification).toMatchObject({ expired: 1, verified: 0, missing: 5 });
  });

  it("matches fleets on reported capacity and skips paused operators", async () => {
    const t = emptyContext();
    const active = await operator(t, "Copperline Party Coaches");
    const paused = await operator(t, "Northgate Coachworks");
    for (const op of [active, paused]) {
      await upsertVehicle(t.ctx, upsertVehicleSchema.parse({ operatorId: op.id, category: "party_bus", quantity: 2, capacity: 40 }));
    }
    await upsertVehicle(t.ctx, upsertVehicleSchema.parse({ operatorId: active.id, category: "party_bus", quantity: 1, capacity: 24 }));
    await changeOperatorStatus(t.ctx, { id: paused.id, expectedStatus: "active", status: "paused" });

    const match = await findFleetMatches(t.ctx, { category: "party_bus", minCapacity: 30 });
    expect(match.total).toBe(1);
    expect(match.operators[0]).toMatchObject({ id: active.id, matchingVehicles: [{ capacity: 40, quantity: 2 }] });
    expect(t.ctx.db.select({ n: sql<number>`count(*)` }).from(operatorCompliance).get()?.n).toBe(0);
  });
});
