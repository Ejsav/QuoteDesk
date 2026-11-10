import { describe, expect, it } from "vitest";
import { formatPhone, initials, normalizeEmail, normalizePhone, phoneSearchDigits } from "@/domain/contact";
import { centsToInput, formatCents, parseMoneyToCents } from "@/domain/money";

describe("phone normalization", () => {
  it.each([
    ["(312) 555-0147", "+13125550147"],
    ["312.555.0147", "+13125550147"],
    ["312 555 0147", "+13125550147"],
    ["1-312-555-0147", "+13125550147"],
    ["+1 (312) 555-0147", "+13125550147"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhone(input)).toEqual({ ok: true, e164: expected });
  });

  it.each([
    ["555-0147", "10-digit"],
    ["(123) 555-0147", "valid US"],
    ["312-555-0147 x12", "digits only"],
    ["+1 555 0147", "valid US or Canadian"],
    ["", "Enter a phone number"],
  ])("rejects %s with a helpful message", (input, fragment) => {
    const result = normalizePhone(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(fragment);
  });

  it("formats E.164 for display and extracts search digits", () => {
    expect(formatPhone("+13125550147")).toBe("(312) 555-0147");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
    expect(phoneSearchDigits("312-555")).toBe("312555");
    expect(phoneSearchDigits("31")).toBeNull();
  });

  it("normalizes emails and initials", () => {
    expect(normalizeEmail("  Sarah.Chen@Example.COM ")).toBe("sarah.chen@example.com");
    expect(initials("Sarah Chen")).toBe("SC");
    expect(initials("Cher")).toBe("C");
    expect(initials("  Mary Anne  de la Cruz ")).toBe("MC");
  });
});

describe("money", () => {
  it("parses customer-entered amounts into integer cents", () => {
    expect(parseMoneyToCents("1,500")).toEqual({ ok: true, cents: 150_000 });
    expect(parseMoneyToCents("$1,500.5")).toEqual({ ok: true, cents: 150_050 });
    expect(parseMoneyToCents("0.1")).toEqual({ ok: true, cents: 10 });
    expect(parseMoneyToCents("")).toEqual({ ok: true, cents: null });
    expect(parseMoneyToCents("about 2k").ok).toBe(false);
    expect(parseMoneyToCents("12.345").ok).toBe(false);
  });

  it("formats cents without float drift", () => {
    expect(formatCents(150_000)).toBe("$1,500");
    expect(formatCents(150_050)).toBe("$1,500.50");
    expect(centsToInput(150_050)).toBe("1500.50");
    expect(centsToInput(null)).toBe("");
  });
});
