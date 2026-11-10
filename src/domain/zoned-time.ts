/**
 * Wall-clock ↔ instant conversion for customer-requested pickup times.
 *
 * Built on Temporal semantics (via `temporal-polyfill`) so daylight-saving
 * transitions are handled explicitly instead of by accident:
 *
 * - A time that does not exist (the spring-forward gap, e.g. 2:30 AM on
 *   2026-03-08 in Chicago) is rejected. We never silently move a pickup.
 * - A time that occurs twice (the fall-back overlap, e.g. 1:30 AM on
 *   2026-11-01) resolves to the earlier instant and is flagged as ambiguous.
 *
 * The stored source of truth is always date + time + zone. The derived instant
 * (`pickup_at`) exists only for ordering and future conflict detection.
 */
import { Temporal } from "temporal-polyfill";
import { daysBetween, type PlainDate, type PlainTime } from "./dates";

export type WallTimeResolution =
  | { ok: true; epochMs: number; ambiguous: boolean }
  | { ok: false; reason: "nonexistent" | "invalid" };

export function resolveWallTime(date: PlainDate, time: PlainTime, timeZone: string): WallTimeResolution {
  let wall: Temporal.PlainDateTime;
  try {
    wall = Temporal.PlainDateTime.from(`${date}T${time}`, { overflow: "reject" });
  } catch {
    return { ok: false, reason: "invalid" };
  }
  try {
    const earlier = wall.toZonedDateTime(timeZone, { disambiguation: "earlier" });
    // In a DST gap the engine has to shift the wall clock; that means the
    // requested time never happens on that date in that zone.
    if (Temporal.PlainDateTime.compare(earlier.toPlainDateTime(), wall) !== 0) {
      return { ok: false, reason: "nonexistent" };
    }
    const later = wall.toZonedDateTime(timeZone, { disambiguation: "later" });
    return {
      ok: true,
      epochMs: earlier.epochMilliseconds,
      ambiguous: later.epochMilliseconds !== earlier.epochMilliseconds,
    };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export interface LocalEnd {
  date: PlainDate;
  time: PlainTime;
  /** Calendar days after the trip date (1 when the trip crosses midnight). */
  dayOffset: number;
}

/**
 * Local end of a trip given its start and an elapsed duration. Uses elapsed
 * time, so a 4-hour charter that starts at 11:00 PM on a fall-back night ends
 * at 2:00 AM on the clock — exactly four hours of service later.
 */
export function localEnd(date: PlainDate, time: PlainTime, timeZone: string, durationMinutes: number): LocalEnd | null {
  const start = resolveWallTime(date, time, timeZone);
  if (!start.ok) return null;
  const end = Temporal.Instant.fromEpochMilliseconds(start.epochMs + durationMinutes * 60_000).toZonedDateTimeISO(timeZone);
  const endDate = end.toPlainDate().toString();
  return {
    date: endDate,
    time: end.toPlainTime().toString({ smallestUnit: "minute" }),
    dayOffset: daysBetween(date, endDate),
  };
}

/** Human-readable explanation for a rejected wall-clock time. */
export function describeWallTimeProblem(reason: "nonexistent" | "invalid"): string {
  return reason === "nonexistent"
    ? "That time doesn't exist on this date — clocks spring forward for daylight saving. Choose a time outside the skipped hour."
    : "That date and time combination isn't valid.";
}
