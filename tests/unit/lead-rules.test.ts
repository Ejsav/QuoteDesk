import { describe, expect, it } from "vitest";
import {
  attentionReason,
  evaluateReadiness,
  followUpState,
  missingForQualification,
  parseLeadNumber,
  planStatusTransition,
  type AttentionFacts,
  type TransitionLead,
} from "@/domain/lead";

const now = new Date("2026-11-10T15:00:00Z");
const today = "2026-11-10";
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

function facts(overrides: Partial<AttentionFacts> = {}): AttentionFacts {
  return { status: "contacted", tripDate: "2026-12-20", followUpDate: null, createdAt: hoursAgo(72), lastActivityAt: hoursAgo(24), ...overrides };
}

describe("qualification & readiness", () => {
  it("requires date, pickup and passengers to qualify", () => {
    expect(missingForQualification({ tripDate: null, pickupLocation: null, passengersMin: null })).toEqual(["tripDate", "pickupLocation", "passengers"]);
    expect(missingForQualification({ tripDate: "2026-12-01", pickupLocation: "Hotel", passengersMin: 4 })).toEqual([]);
  });

  it("adapts readiness to the service type", () => {
    const base = { tripDate: "2026-12-01", pickupLocation: "Hotel", passengersMin: 10, pickupTime: null, destination: null, vehicleCategory: null, durationMinutes: null };
    const hourly = evaluateReadiness({ ...base, serviceType: "hourly" });
    expect(hourly.items.map((i) => i.key)).toContain("duration");
    expect(hourly.items.map((i) => i.key)).not.toContain("destination");
    const oneWay = evaluateReadiness({ ...base, serviceType: "one_way" });
    expect(oneWay.items.map((i) => i.key)).toContain("destination");
    expect(oneWay.items.map((i) => i.key)).not.toContain("duration");
    expect(oneWay.missingEssential).toHaveLength(0);
  });
});

describe("follow-ups", () => {
  it("classifies follow-up dates relative to the business day", () => {
    expect(followUpState(null, today)).toEqual({ kind: "none" });
    expect(followUpState("2026-11-08", today)).toEqual({ kind: "overdue", days: 2 });
    expect(followUpState("2026-11-10", today)).toEqual({ kind: "today" });
    expect(followUpState("2026-11-13", today)).toEqual({ kind: "upcoming", days: 3 });
  });
});

describe("attention rules", () => {
  const ctx = { now, today };

  it("never flags lost leads", () => {
    expect(attentionReason(facts({ status: "lost", followUpDate: "2026-11-01" }), ctx)).toBeNull();
  });

  it("ranks an imminent unqualified trip above an overdue follow-up", () => {
    expect(attentionReason(facts({ tripDate: "2026-11-13", followUpDate: "2026-11-01" }), ctx)).toEqual({ kind: "trip_soon_unqualified", days: 3 });
  });

  it("flags new inquiries and marks SLA breaches after 24h", () => {
    expect(attentionReason(facts({ status: "new", createdAt: hoursAgo(3) }), ctx)).toEqual({ kind: "awaiting_first_contact", hours: 3, breachedSla: false });
    expect(attentionReason(facts({ status: "new", createdAt: hoursAgo(30) }), ctx)).toMatchObject({ breachedSla: true });
  });

  it("flags passed trip dates and stale working leads", () => {
    expect(attentionReason(facts({ tripDate: "2026-11-07" }), ctx)).toEqual({ kind: "trip_date_passed", days: 3 });
    expect(attentionReason(facts({ lastActivityAt: hoursAgo(24 * 9) }), ctx)).toEqual({ kind: "stale", days: 9 });
  });

  it("doesn't call paused or scheduled leads stale", () => {
    expect(attentionReason(facts({ status: "on_hold", lastActivityAt: hoursAgo(24 * 30) }), ctx)).toBeNull();
    expect(attentionReason(facts({ lastActivityAt: hoursAgo(24 * 30), followUpDate: "2026-11-20" }), ctx)).toBeNull();
  });
});

describe("status transitions", () => {
  const lead: TransitionLead = {
    status: "new",
    tripDate: "2026-12-01",
    pickupLocation: "The Larkspur Hotel",
    passengersMin: 12,
    qualifiedAt: null,
    firstResponseAt: null,
    followUpDate: "2026-11-12",
  };

  it("requires a reason to mark a lead lost, and closes its follow-up", () => {
    expect(planStatusTransition(lead, "lost", { now })).toMatchObject({ ok: false, code: "lost_reason_required" });
    const result = planStatusTransition(lead, "lost", { now, lostReason: "chose_competitor" });
    expect(result).toMatchObject({ ok: true, clearedFollowUp: "2026-11-12", patch: { followUpDate: null, lostReason: "chose_competitor" } });
    // Closing as spam is not a "response".
    expect(result.ok && result.patch.firstResponseAt).toBeNull();
  });

  it("blocks qualifying without the facts a quote needs", () => {
    const result = planStatusTransition({ ...lead, passengersMin: null }, "qualified", { now });
    expect(result).toMatchObject({ ok: false, code: "not_qualifiable", missing: ["passengers"] });
  });

  it("records the first response and the first qualification exactly once", () => {
    const first = planStatusTransition(lead, "qualified", { now });
    expect(first).toMatchObject({ ok: true, patch: { qualifiedAt: now, firstResponseAt: now, lostReason: null } });
    const later = new Date(now.getTime() + 86_400_000);
    const requalified = planStatusTransition({ ...lead, status: "on_hold", qualifiedAt: now, firstResponseAt: now }, "qualified", { now: later });
    expect(requalified.ok && requalified.patch.qualifiedAt).toEqual(now);
    expect(requalified.ok && requalified.patch.firstResponseAt).toEqual(now);
  });

  it("treats a move to the current status as a no-op", () => {
    expect(planStatusTransition(lead, "new", { now })).toMatchObject({ ok: false, code: "unchanged" });
  });

  it("parses lead references flexibly", () => {
    expect(parseLeadNumber("L-1042")).toBe(1042);
    expect(parseLeadNumber("l1042")).toBe(1042);
    expect(parseLeadNumber("#1042")).toBe(1042);
    expect(parseLeadNumber("1042")).toBe(1042);
    expect(parseLeadNumber("Chen wedding")).toBeNull();
  });
});
