/**
 * Money is stored as integer minor units (cents) — never floats.
 *
 * Scope note: the only money in this release is a customer's *stated budget*
 * on an inquiry. It is informational, not a price, quote, or revenue figure,
 * and is never summed into financial totals.
 */

export type MoneyParse = { ok: true; cents: number | null } | { ok: false; message: string };

export function parseMoneyToCents(input: string): MoneyParse {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (cleaned === "") return { ok: true, cents: null };
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return { ok: false, message: "Enter an amount like 1500 or 1,500.00." };
  }
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isSafeInteger(cents)) return { ok: false, message: "That amount is too large." };
  return { ok: true, cents };
}

export function formatCents(cents: number, currency = "USD"): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** Value for a money text input: 150000 → "1500", 150050 → "1500.50". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}
