/**
 * Seed clock — every demo timestamp and date is expressed relative to the real
 * moment the seed runs, so the dashboard always looks "current" after seeding.
 *
 * - `ago(days, "HH:MM")`: a business-local wall time on a past calendar day.
 * - `minutesAgo(n)` / `hoursAgo(n)`: events earlier today (or late last night).
 * - `day(n)`: a calendar date n days from today (negative = past).
 * - `sat(n)`, `fri(n)`, …: the first such weekday on or after today + n, for
 *   events that should land on a realistic day of the week.
 */
import { addDays, isoWeekday, todayInZone, type PlainDate } from "@/domain/dates";
import { resolveWallTime } from "@/domain/zoned-time";

export class SeedClock {
  readonly today: PlainDate;

  constructor(
    readonly timeZone: string,
    readonly now: Date,
  ) {
    this.today = todayInZone(timeZone, now);
  }

  /** Wall-clock time on the calendar day `days` before today (days ≥ 1). */
  ago(days: number, time: string): Date {
    if (!Number.isInteger(days) || days < 1) {
      throw new Error(`SeedClock.ago(${days}, "${time}"): use minutesAgo()/hoursAgo() for events on the current day.`);
    }
    const date = addDays(this.today, -days);
    let resolved = resolveWallTime(date, time, this.timeZone);
    if (!resolved.ok) {
      // A daylight-saving gap: the hour doesn't exist on that date — use the next one.
      const [h, m] = time.split(":").map(Number) as [number, number];
      resolved = resolveWallTime(date, `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`, this.timeZone);
    }
    if (!resolved.ok) throw new Error(`SeedClock.ago(${days}, "${time}") could not be resolved in ${this.timeZone}.`);
    return new Date(resolved.epochMs);
  }

  minutesAgo(minutes: number): Date {
    return new Date(this.now.getTime() - minutes * 60_000);
  }

  hoursAgo(hours: number): Date {
    return this.minutesAgo(hours * 60);
  }

  /** Calendar date `n` days from today in the business time zone. */
  day(n: number): PlainDate {
    return addDays(this.today, n);
  }

  /** First ISO weekday (1 = Mon … 7 = Sun) on or after today + n. */
  weekday(n: number, iso: number): PlainDate {
    let date = this.day(n);
    while (isoWeekday(date) !== iso) date = addDays(date, 1);
    return date;
  }

  thu(n: number): PlainDate {
    return this.weekday(n, 4);
  }

  fri(n: number): PlainDate {
    return this.weekday(n, 5);
  }

  sat(n: number): PlainDate {
    return this.weekday(n, 6);
  }
}

export function plusMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}
