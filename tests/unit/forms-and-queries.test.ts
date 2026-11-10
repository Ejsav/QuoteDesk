import { describe, expect, it } from "vitest";
import { buildLeadInput, emptyLeadForm, leadToFormValues, type LeadFormValues } from "@/components/leads/lead-form-model";
import { DEFAULT_LEAD_QUERY, leadsHref, parseLeadQuery, serializeLeadQuery } from "@/domain/lead-query";

function form(overrides: Partial<LeadFormValues> = {}): LeadFormValues {
  return { ...emptyLeadForm("America/Chicago"), customerMode: "existing", customerId: "cus_123", source: "phone", ...overrides };
}

describe("lead form model", () => {
  it("records unknown information as null instead of inventing values", () => {
    const result = buildLeadInput(form(), { mode: "create", clientRequestId: "request-12345" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toMatchObject({ passengersMin: null, passengersMax: null, tripDate: null, vehicleCategory: null, budgetCents: null });
  });

  it("stores an exact count as min = max and parses money and hours", () => {
    const result = buildLeadInput(form({ passengersMode: "exact", passengersExact: "18", budget: "1,250.50", durationHours: "4.5" }), {
      mode: "create",
      clientRequestId: "request-12345",
    });
    expect(result.ok && result.input).toMatchObject({ passengersMin: 18, passengersMax: 18, budgetCents: 125_050, durationMinutes: 270 });
  });

  it("maps server-schema errors back to form fields", () => {
    const range = buildLeadInput(form({ passengersMode: "range", passengersMin: "30", passengersMax: "20" }), { mode: "create", clientRequestId: "request-12345" });
    expect(range).toEqual({ ok: false, errors: { passengersMax: "The upper end can't be lower than the lower end." } });

    const budget = buildLeadInput(form({ budget: "about 2k" }), { mode: "create", clientRequestId: "request-12345" });
    expect(budget.ok).toBe(false);
    expect(!budget.ok && budget.errors.budget).toBeTruthy();

    const source = buildLeadInput(form({ source: "" }), { mode: "create", clientRequestId: "request-12345" });
    expect(!source.ok && source.errors.source).toBe("Choose how this inquiry came in.");
  });

  it("requires a reachable new customer", () => {
    const result = buildLeadInput(
      form({ customerMode: "new", newCustomer: { fullName: "Taylor Quinn", companyName: "", phone: "", email: "", preferredContact: "" } }),
      { mode: "create", clientRequestId: "request-12345" },
    );
    expect(!result.ok && result.errors["newCustomer.phone"]).toMatch(/phone number or an email/);
  });

  it("rejects a pickup time that doesn't exist because of DST", () => {
    const result = buildLeadInput(form({ tripDate: "2026-03-08", pickupTime: "02:30" }), { mode: "create", clientRequestId: "request-12345" });
    expect(!result.ok && result.errors.pickupTime).toMatch(/daylight saving/);
  });

  it("round-trips a stored lead through the edit form", () => {
    const values = leadToFormValues(
      {
        customerId: "cus_1",
        occasion: "wedding",
        eventName: "Chen–Alvarez Wedding",
        serviceType: "hourly",
        tripDate: "2027-06-12",
        pickupTime: "15:30",
        timeZone: "America/Chicago",
        durationMinutes: 330,
        pickupLocation: "The Larkspur Hotel",
        destination: null,
        passengersMin: 20,
        passengersMax: 25,
        vehicleCategory: "party_bus",
        budgetCents: 180_000,
        source: "referral",
        priority: "high",
        followUpDate: null,
        followUpNote: null,
        notes: null,
      },
      [{ location: "St. James Chapel", note: null }],
    );
    expect(values).toMatchObject({ passengersMode: "range", passengersMin: "20", passengersMax: "25", durationHours: "5.5", budget: "1800" });
    const rebuilt = buildLeadInput(values, { mode: "edit", leadId: "lead_1", version: 3 });
    expect(rebuilt.ok && rebuilt.input).toMatchObject({ id: "lead_1", version: 3, passengersMin: 20, passengersMax: 25, durationMinutes: 330, budgetCents: 180_000 });
  });
});

describe("lead list URLs", () => {
  it("round-trips filters through the query string", () => {
    const query = { ...DEFAULT_LEAD_QUERY, view: "qualified" as const, q: "chen", status: ["qualified" as const], trip: "next30" as const, page: 2 };
    expect(parseLeadQuery(new URLSearchParams(serializeLeadQuery(query)))).toEqual(query);
  });

  it("ignores unknown values instead of failing", () => {
    const parsed = parseLeadQuery({ view: "booked", status: "new,bogus", sort: "attention", page: "-4" });
    expect(parsed).toMatchObject({ view: "open", status: ["new"], sort: null, page: 1 });
  });

  it("omits defaults so links stay clean", () => {
    expect(leadsHref()).toBe("/leads");
    expect(leadsHref({ view: "attention", sort: "attention" })).toBe("/leads?view=attention");
  });
});

describe("lead form customer requirement", () => {
  it("asks for a customer in plain language", () => {
    const result = buildLeadInput(form({ customerId: "" }), { mode: "create", clientRequestId: "request-12345" });
    expect(!result.ok && result.errors.customerId).toBe("Choose a customer, or add a new one.");
  });
});

describe("lead form error reporting", () => {
  it("reports parse errors and schema errors together", () => {
    const result = buildLeadInput(form({ customerId: "", source: "", budget: "lots" }), { mode: "create", clientRequestId: "request-12345" });
    expect(!result.ok && Object.keys(result.errors).sort()).toEqual(["budget", "customerId", "source"]);
  });
});
