import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  endOfMonth,
  formatPlainTime,
  isPlainDate,
  isPlainTime,
  isValidTimeZone,
  relativeDayLabel,
  startOfWeek,
  todayInZone,
} from "@/domain/dates";
import { localEnd, resolveWallTime } from "@/domain/zoned-time";

describe("calendar dates", () => {
  it("validates real calendar dates only", () => {
    expect(isPlainDate("2026-11-10")).toBe(true);
    expect(isPlainDate("2028-02-29")).toBe(true);
    expect(isPlainDate("2026-02-29")).toBe(false);
    expect(isPlainDate("2026-13-01")).toBe(false);
    expect(isPlainDate("11/10/2026")).toBe(false);
    expect(isPlainTime("23:59")).toBe(true);
    expect(isPlainTime("24:00")).toBe(false);
    expect(isPlainTime("9:30")).toBe(false);
  });

  it("does arithmetic across month, year and leap boundaries", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-11-10", "2026-12-25")).toBe(45);
    expect(daysBetween("2026-11-10", "2026-11-03")).toBe(-7);
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
  });

  it("is unaffected by DST transitions (plain dates have no zone)", () => {
    // 2026-03-08 and 2026-11-01 are US DST transition days.
    expect(addDays("2026-03-07", 1)).toBe("2026-03-08");
    expect(daysBetween("2026-10-31", "2026-11-02")).toBe(2);
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-11-10")).toBe("2026-11-09"); // Tuesday → Monday
    expect(startOfWeek("2026-11-15")).toBe("2026-11-09"); // Sunday → previous Monday
    expect(startOfWeek("2026-11-09")).toBe("2026-11-09");
  });

  it("computes 'today' in the business time zone, not UTC", () => {
    // 05:30 UTC on Nov 10 is still Nov 9 in Chicago (UTC−6).
    const instant = new Date("2026-11-10T05:30:00Z");
    expect(todayInZone("America/Chicago", instant)).toBe("2026-11-09");
    expect(todayInZone("UTC", instant)).toBe("2026-11-10");
    expect(todayInZone("Asia/Tokyo", instant)).toBe("2026-11-10");
  });

  it("formats wall-clock times and relative day labels", () => {
    expect(formatPlainTime("00:05")).toBe("12:05 AM");
    expect(formatPlainTime("12:00")).toBe("12:00 PM");
    expect(formatPlainTime("18:30")).toBe("6:30 PM");
    expect(relativeDayLabel("2026-11-10", "2026-11-10")).toBe("Today");
    expect(relativeDayLabel("2026-11-11", "2026-11-10")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-11-13", "2026-11-10")).toBe("Friday");
  });

  it("validates IANA time zones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("America/Indiana/Indianapolis")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus_Mons")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("wall-clock ↔ instant", () => {
  it("rejects times that don't exist (spring-forward gap)", () => {
    expect(resolveWallTime("2026-03-08", "02:30", "America/Chicago")).toEqual({ ok: false, reason: "nonexistent" });
    // The same wall time exists in Phoenix, which doesn't observe DST.
    expect(resolveWallTime("2026-03-08", "02:30", "America/Phoenix").ok).toBe(true);
  });

  it("resolves repeated times (fall-back overlap) to the earlier instant and flags them", () => {
    const result = resolveWallTime("2026-11-01", "01:30", "America/Chicago");
    expect(result).toEqual({ ok: true, ambiguous: true, epochMs: Date.parse("2026-11-01T06:30:00Z") });
  });

  it("converts ordinary times using the zone's offset on that date", () => {
    expect(resolveWallTime("2026-07-04", "18:00", "America/Chicago")).toEqual({
      ok: true,
      ambiguous: false,
      epochMs: Date.parse("2026-07-04T23:00:00Z"),
    });
    expect(resolveWallTime("2026-12-04", "18:00", "America/Chicago")).toEqual({
      ok: true,
      ambiguous: false,
      epochMs: Date.parse("2026-12-05T00:00:00Z"),
    });
  });

  it("keeps the customer's requested wall time when the zone differs", () => {
    const detroit = resolveWallTime("2026-11-20", "05:30", "America/Detroit");
    const chicago = resolveWallTime("2026-11-20", "05:30", "America/Chicago");
    expect(detroit.ok && chicago.ok && chicago.epochMs - detroit.epochMs).toBe(3_600_000);
  });

  it("computes trip ends that cross midnight", () => {
    expect(localEnd("2026-11-28", "21:30", "America/Chicago", 300)).toEqual({ date: "2026-11-29", time: "02:30", dayOffset: 1 });
  });

  it("uses elapsed time across a fall-back night", () => {
    // 4 hours of service from 11 PM CDT ends at 2 AM CST — not 3 AM.
    expect(localEnd("2026-10-31", "23:00", "America/Chicago", 240)).toEqual({ date: "2026-11-01", time: "02:00", dayOffset: 1 });
  });
});
