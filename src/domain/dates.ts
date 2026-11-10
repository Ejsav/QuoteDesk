/**
 * Calendar dates, wall-clock times and display formatting.
 *
 * QuoteDesk stores what the customer actually asked for: a calendar date
 * ("2026-06-13") and a 24-hour wall-clock time ("18:30"), always paired with an
 * explicit IANA time zone on the record. Plain dates carry no zone of their own,
 * so the arithmetic below runs in UTC, where every day is exactly 24 hours and
 * DST can never shift a date.
 *
 * This module is dependency-free and safe to import from client components.
 * Conversions between wall-clock time and real instants live in `zoned-time.ts`.
 */

/** ISO calendar date, "YYYY-MM-DD". */
export type PlainDate = string;
/** 24-hour wall-clock time, "HH:MM". */
export type PlainTime = string;

/** The demo workspace's default business time zone (Chicago, US Central). */
export const DEFAULT_BUSINESS_TIME_ZONE = "America/Chicago";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isPlainDate(value: unknown): value is PlainDate {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function isPlainTime(value: unknown): value is PlainTime {
  return typeof value === "string" && TIME_RE.test(value);
}

function toUtcMs(date: PlainDate): number {
  const m = DATE_RE.exec(date);
  if (!m) throw new RangeError(`Invalid calendar date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMs(ms: number): PlainDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: PlainDate, days: number): PlainDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` — positive when `to` is later. */
export function daysBetween(from: PlainDate, to: PlainDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: PlainDate): number {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: PlainDate): PlainDate {
  return addDays(date, 1 - isoWeekday(date));
}

export function startOfMonth(date: PlainDate): PlainDate {
  return `${date.slice(0, 8)}01`;
}

export function endOfMonth(date: PlainDate): PlainDate {
  const [y, m] = date.split("-").map(Number) as [number, number];
  return `${date.slice(0, 8)}${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Intl formatter cache — constructing formatters is expensive.
// ---------------------------------------------------------------------------

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", options);
    formatterCache.set(key, f);
  }
  return f;
}

/** The current calendar date in an IANA time zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): PlainDate {
  return plainDateOfInstant(now, timeZone);
}

/** The calendar date an instant falls on in a time zone. */
export function plainDateOfInstant(value: Date | number, timeZone: string): PlainDate {
  const parts = formatter({ timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(
    typeof value === "number" ? new Date(value) : value,
  );
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || timeZone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** Time zones offered in pickers. Any valid IANA zone is still accepted on the server. */
export const COMMON_TIME_ZONES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "America/New_York", label: "Eastern Time" },
  { id: "America/Chicago", label: "Central Time" },
  { id: "America/Denver", label: "Mountain Time" },
  { id: "America/Phoenix", label: "Arizona (no DST)" },
  { id: "America/Los_Angeles", label: "Pacific Time" },
  { id: "America/Anchorage", label: "Alaska Time" },
  { id: "Pacific/Honolulu", label: "Hawaii Time" },
  { id: "America/Toronto", label: "Toronto" },
  { id: "Europe/London", label: "London" },
];

export function timeZoneLabel(timeZone: string): string {
  return COMMON_TIME_ZONES.find((z) => z.id === timeZone)?.label ?? timeZone.replace(/_/g, " ");
}

/** Short zone name such as "CST" / "CDT" at a given moment. */
export function zoneAbbreviation(timeZone: string, at: Date | number = new Date()): string {
  const parts = formatter({ timeZone, timeZoneName: "short", hour: "numeric" }).formatToParts(
    typeof at === "number" ? new Date(at) : at,
  );
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}

// ---------------------------------------------------------------------------
// Display formatting for plain dates and times (zone-free by definition).
// ---------------------------------------------------------------------------

export type PlainDateStyle = "short" | "medium" | "long" | "weekday" | "weekdayYear" | "monthYear";

const PLAIN_DATE_OPTIONS: Record<PlainDateStyle, Intl.DateTimeFormatOptions> = {
  short: { month: "short", day: "numeric", timeZone: "UTC" },
  medium: { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  long: { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" },
  weekday: { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" },
  weekdayYear: { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" },
  monthYear: { month: "long", year: "numeric", timeZone: "UTC" },
};

export function formatPlainDate(date: PlainDate, style: PlainDateStyle = "medium"): string {
  return formatter(PLAIN_DATE_OPTIONS[style]).format(new Date(toUtcMs(date)));
}

/** "18:30" → "6:30 PM" */
export function formatPlainTime(time: PlainTime): string {
  const m = TIME_RE.exec(time);
  if (!m) return time;
  const hours = Number(m[1]);
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${m[2]} ${period}`;
}

/** "Today", "Tomorrow", "Yesterday", weekday within the week ahead, else a date. */
export function relativeDayLabel(date: PlainDate, today: PlainDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return formatter({ weekday: "long", timeZone: "UTC" }).format(new Date(toUtcMs(date)));
  return date.slice(0, 4) === today.slice(0, 4) ? formatPlainDate(date, "weekday") : formatPlainDate(date, "weekdayYear");
}

/** "in 3 days", "today", "2 days ago" */
export function formatDayDistance(date: PlainDate, today: PlainDate): string {
  const diff = daysBetween(today, date);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  if (diff > 0) return diff < 60 ? `in ${diff} days` : `in ${Math.round(diff / 30)} months`;
  const past = -diff;
  return past < 60 ? `${past} days ago` : `${Math.round(past / 30)} months ago`;
}

// ---------------------------------------------------------------------------
// Instants (timestamps such as createdAt) are always displayed in a zone.
// ---------------------------------------------------------------------------

export type InstantStyle = "datetime" | "date" | "time" | "short" | "full";

const INSTANT_OPTIONS: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  datetime: { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  date: { month: "short", day: "numeric", year: "numeric" },
  time: { hour: "numeric", minute: "2-digit" },
  short: { month: "short", day: "numeric" },
  full: { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" },
};

export function formatInstant(value: Date | number, timeZone: string, style: InstantStyle = "datetime"): string {
  return formatter({ ...INSTANT_OPTIONS[style], timeZone }).format(typeof value === "number" ? new Date(value) : value);
}

/** Compact relative time: "just now", "12m ago", "3h ago", "4d ago", then a date. */
export function formatRelativeTime(value: Date | number, timeZone: string, now: Date = new Date()): string {
  const ms = now.getTime() - (typeof value === "number" ? value : value.getTime());
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatInstant(value, timeZone, "short");
}

/** Human duration from minutes: 90 → "1.5 hrs", 45 → "45 min", 300 → "5 hrs". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  const rounded = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  return `${rounded} ${hours === 1 ? "hr" : "hrs"}`;
}

/** Elapsed time between two instants, compact: "45m", "3.2h", "2.1d". */
export function formatElapsed(ms: number): string {
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m`;
  const hours = minutes / 60;
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)}h`;
  const days = hours / 24;
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, "") : Math.round(days)}d`;
}
