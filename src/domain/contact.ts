/**
 * Contact normalization. Phone numbers are stored in E.164 ("+13125550147") so
 * duplicate detection and search compare like with like; emails are stored
 * trimmed and lowercased. Formatting for display happens at the edges.
 */

export type PhoneResult = { ok: true; e164: string } | { ok: false; message: string };

const NANP_NATIONAL = /^[2-9]\d{2}[2-9]\d{6}$/;

export function normalizePhone(input: string): PhoneResult {
  const raw = input.trim();
  if (!raw) return { ok: false, message: "Enter a phone number." };
  if (!/^\+?[\d\s().-]+$/.test(raw)) {
    return { ok: false, message: "Use digits only — spaces, dashes, dots and parentheses are fine." };
  }
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) {
    if (digits.startsWith("1")) {
      const national = digits.slice(1);
      if (national.length !== 10 || !NANP_NATIONAL.test(national)) {
        return { ok: false, message: "That doesn't look like a valid US or Canadian number." };
      }
      return { ok: true, e164: `+1${national}` };
    }
    if (digits.length < 8 || digits.length > 15) {
      return { ok: false, message: "International numbers need 8–15 digits after the +." };
    }
    return { ok: true, e164: `+${digits}` };
  }

  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) {
    return { ok: false, message: "Enter a 10-digit US number, or an international number starting with +." };
  }
  if (!NANP_NATIONAL.test(national)) {
    return { ok: false, message: "That doesn't look like a valid US number." };
  }
  return { ok: true, e164: `+1${national}` };
}

/** "+13125550147" → "(312) 555-0147"; other countries are shown in E.164. */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : e164;
}

/** Digits a user typed into search, for matching against stored E.164 values. */
export function phoneSearchDigits(query: string): string | null {
  const digits = query.replace(/\D/g, "");
  return digits.length >= 4 ? digits : null;
}

export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
