import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createLeadSchema, updateLeadSchema, type CreateLeadInput } from "@/domain/schemas/lead";
import { activities, customers, leads } from "@/server/db/schema";
import { listLeadActivity } from "@/server/services/activity-log";
import { ConflictError, DuplicateCustomerError, RuleError, ValidationError } from "@/server/services/errors";
import {
  addLeadNote,
  changeLeadStatus,
  createLead,
  deleteLead,
  getLead,
  logLeadContact,
  scheduleFollowUp,
  updateLead,
} from "@/server/services/leads";
import { emptyContext, requestId } from "../helpers/context";

type LeadOverrides = Record<string, unknown>;

/** Raw input as a form would send it; createLeadSchema.parse validates it at runtime. */
function newLeadInput(overrides: LeadOverrides = {}): CreateLeadInput {
  return {
    customer: { mode: "new", fullName: "Taylor Quinn", phone: "(312) 555-0199", email: "taylor@example.com", companyName: null, preferredContact: null },
    source: "website",
    timeZone: "America/Chicago",
    clientRequestId: requestId(),
    ...overrides,
  } as CreateLeadInput;
}

async function create(t: ReturnType<typeof emptyContext>, overrides: LeadOverrides = {}) {
  return createLead(t.ctx, createLeadSchema.parse(newLeadInput(overrides)));
}

describe("lead intake", () => {
  it("creates the customer and lead together, with a real activity trail", async () => {
    const t = emptyContext();
    const created = await create(t);
    expect(created).toMatchObject({ number: 1001, created: true });
    const timeline = await listLeadActivity(t.ctx, created.id);
    expect(timeline.map((a) => a.type)).toEqual(["lead.created"]);
    const customerActivity = t.ctx.db.select().from(activities).where(eq(activities.customerId, created.customerId)).all();
    expect(customerActivity.map((a) => a.type)).toEqual(["customer.created"]);
  });

  it("is idempotent per form submission (double submit returns the same lead)", async () => {
    const t = emptyContext();
    const input = createLeadSchema.parse(newLeadInput());
    const [first, second] = [await createLead(t.ctx, input), await createLead(t.ctx, input)];
    expect(second).toEqual({ ...first, created: false });
    expect(t.ctx.db.select({ n: sql<number>`count(*)` }).from(leads).get()?.n).toBe(1);
    expect(t.ctx.db.select({ n: sql<number>`count(*)` }).from(customers).get()?.n).toBe(1);
  });

  it("never reuses lead numbers after a delete", async () => {
    const t = emptyContext();
    const first = await create(t);
    const existing = { mode: "existing" as const, customerId: first.customerId };
    const second = await create(t, { customer: existing });
    expect(second.number).toBe(1002);
    await deleteLead(t.ctx, { id: second.id });
    const next = await create(t, { customer: existing });
    expect(next.number).toBe(1003);
  });

  it("flags possible duplicate customers and only creates one when confirmed", async () => {
    const t = emptyContext();
    await create(t);
    const lookalike = { mode: "new" as const, fullName: "T. Quinn", phone: "312-555-0199", email: null, companyName: null, preferredContact: null };
    await expect(create(t, { customer: lookalike })).rejects.toBeInstanceOf(DuplicateCustomerError);
    const confirmed = await create(t, { customer: { ...lookalike, confirmDuplicate: true } });
    expect(confirmed.created).toBe(true);
    expect(t.ctx.db.select({ n: sql<number>`count(*)` }).from(customers).get()?.n).toBe(2);
  });

  it("refuses to start qualified without the facts a quote needs", async () => {
    const t = emptyContext();
    const error = await create(t, { initialStatus: "qualified", tripDate: "2026-12-12" }).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(Object.keys((error as ValidationError).fieldErrors).sort()).toEqual(["passengersMin", "pickupLocation"]);
  });

  it("rejects follow-ups in the past (business time zone)", async () => {
    const t = emptyContext();
    await expect(create(t, { followUpDate: "2026-11-09" })).rejects.toBeInstanceOf(ValidationError);
    await expect(create(t, { followUpDate: "2026-11-10" })).resolves.toMatchObject({ created: true });
  });

  it("stores the requested wall time and derives the instant from the trip's zone", async () => {
    const t = emptyContext();
    const { id } = await create(t, { tripDate: "2026-11-20", pickupTime: "05:30", timeZone: "America/Detroit" });
    const detail = await getLead(t.ctx, id);
    expect(detail?.lead).toMatchObject({ tripDate: "2026-11-20", pickupTime: "05:30", timeZone: "America/Detroit" });
    expect(detail?.lead.pickupAt?.toISOString()).toBe("2026-11-20T10:30:00.000Z");
    expect(detail?.schedule.zoneAbbreviation).toBe("EST");
  });
});

describe("editing and workflow", () => {
  it("uses optimistic concurrency for full edits and records field-level changes", async () => {
    const t = emptyContext();
    const { id, customerId } = await create(t);
    const base = { id, customerId, source: "website" as const, timeZone: "America/Chicago" };
    const edited = await updateLead(t.ctx, updateLeadSchema.parse({ ...base, version: 1, passengersMin: 12, passengersMax: 14 }));
    expect(edited).toMatchObject({ version: 2, changed: true });
    await expect(updateLead(t.ctx, updateLeadSchema.parse({ ...base, version: 1, passengersMin: 20 }))).rejects.toBeInstanceOf(ConflictError);
    const updated = (await listLeadActivity(t.ctx, id)).find((a) => a.type === "lead.updated");
    expect(updated?.data).toMatchObject({ changes: [{ field: "passengers", from: { min: null, max: null }, to: { min: 12, max: 14 } }] });
  });

  it("keeps qualified leads quote-ready", async () => {
    const t = emptyContext();
    const { id, customerId } = await create(t, { initialStatus: "qualified", tripDate: "2026-12-12", pickupLocation: "Union Station", passengersMin: 8 });
    const edit = updateLeadSchema.parse({ id, customerId, version: 1, source: "website", timeZone: "America/Chicago", tripDate: "2026-12-12", passengersMin: 8 });
    await expect(updateLead(t.ctx, edit)).rejects.toBeInstanceOf(ValidationError);
  });

  it("changes status with compare-and-set, safe repeats and required lost reasons", async () => {
    const t = emptyContext();
    const { id } = await create(t, { followUpDate: "2026-11-12" });
    await expect(changeLeadStatus(t.ctx, { id, expectedStatus: "contacted", status: "on_hold", lostReason: null })).rejects.toBeInstanceOf(ConflictError);
    await expect(changeLeadStatus(t.ctx, { id, expectedStatus: "new", status: "lost", lostReason: null })).rejects.toBeInstanceOf(ValidationError);
    await expect(changeLeadStatus(t.ctx, { id, expectedStatus: "new", status: "qualified", lostReason: null })).rejects.toBeInstanceOf(RuleError);

    const lost = await changeLeadStatus(t.ctx, { id, expectedStatus: "new", status: "lost", lostReason: "no_response" });
    expect(lost.changed).toBe(true);
    // A double-click sends the same request again: it's a no-op, not an error.
    expect(await changeLeadStatus(t.ctx, { id, expectedStatus: "new", status: "lost", lostReason: "no_response" })).toMatchObject({ changed: false });

    const lead = (await getLead(t.ctx, id))!.lead;
    expect(lead).toMatchObject({ status: "lost", lostReason: "no_response", followUpDate: null, firstResponseAt: null });
    const types = (await listLeadActivity(t.ctx, id)).map((a) => a.type);
    expect(types).toEqual(expect.arrayContaining(["lead.status_changed", "lead.follow_up_cleared"]));
    await expect(scheduleFollowUp(t.ctx, { id, expectedDate: null, date: "2026-11-20", note: null })).rejects.toBeInstanceOf(RuleError);
  });

  it("logging contact on a new lead records the first response and moves it to Contacted", async () => {
    const t = emptyContext();
    const { id } = await create(t);
    t.advance(45 * 60_000);
    const result = await logLeadContact(t.ctx, { leadId: id, channel: "call", direction: "outbound", summary: "Left voicemail" });
    expect(result).toEqual({ duplicate: false, statusChanged: true });
    const lead = (await getLead(t.ctx, id))!.lead;
    expect(lead.status).toBe("contacted");
    expect(lead.firstResponseAt!.getTime() - lead.createdAt.getTime()).toBe(45 * 60_000);
  });

  it("ignores an identical note submitted twice in quick succession", async () => {
    const t = emptyContext();
    const { id } = await create(t);
    expect(await addLeadNote(t.ctx, { leadId: id, body: "Wants a champagne Sprinter" })).toEqual({ duplicate: false });
    t.advance(2_000);
    expect(await addLeadNote(t.ctx, { leadId: id, body: "Wants a champagne Sprinter" })).toEqual({ duplicate: true });
    t.advance(60_000);
    expect(await addLeadNote(t.ctx, { leadId: id, body: "Wants a champagne Sprinter" })).toEqual({ duplicate: false });
  });

  it("deletes a lead with its stops and timeline, but keeps a record on the customer", async () => {
    const t = emptyContext();
    const { id, customerId } = await create(t, { stops: [{ location: "St. James Chapel", note: null }] });
    await deleteLead(t.ctx, { id });
    expect(await getLead(t.ctx, id)).toBeNull();
    expect(t.ctx.db.select().from(activities).where(eq(activities.leadId, id)).all()).toHaveLength(0);
    const trail = t.ctx.db
      .select()
      .from(activities)
      .where(and(eq(activities.customerId, customerId), eq(activities.type, "lead.deleted")))
      .all();
    expect(trail).toHaveLength(1);
  });

  it("is backstopped by database constraints even if application code misbehaves", async () => {
    const t = emptyContext();
    const { id } = await create(t);
    expect(() => t.ctx.db.update(leads).set({ status: "qualified" }).where(eq(leads.id, id)).run()).toThrow(/CHECK constraint failed/);
    expect(() => t.ctx.db.update(leads).set({ status: "lost" }).where(eq(leads.id, id)).run()).toThrow(/CHECK constraint failed/);
    expect(() => t.ctx.db.update(leads).set({ passengersMin: 10, passengersMax: 5 }).where(eq(leads.id, id)).run()).toThrow(/CHECK constraint failed/);
  });
});
