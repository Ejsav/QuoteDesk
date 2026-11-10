/**
 * Reusable field schemas. These define the *server's* integrity contract;
 * client forms reuse them for instant feedback but never replace them.
 */
import { z } from "zod";
import { normalizeEmail, normalizePhone } from "../contact";
import { isPlainDate, isPlainTime, isValidTimeZone } from "../dates";

const toTrimmedString = (v: unknown) => (v == null ? "" : typeof v === "string" ? v.trim() : v);

/** Trimmed free text; blank becomes null. */
export function optionalText(max: number) {
  return z
    .preprocess(toTrimmedString, z.string().max(max, `Keep this under ${max} characters.`))
    .transform((v) => (v === "" ? null : v));
}

/** Trimmed text that must be present. */
export function requiredText(max: number, message: string) {
  return z.preprocess(
    toTrimmedString,
    z.string({ error: message }).min(1, message).max(max, `Keep this under ${max} characters.`),
  );
}

export const plainDateSchema = z.string({ error: "Enter a valid date." }).refine(isPlainDate, "Enter a valid date.");
export const optionalPlainDate = z.preprocess((v) => (v === "" || v == null ? null : v), plainDateSchema.nullable());

export const plainTimeSchema = z.string({ error: "Enter a valid time." }).refine(isPlainTime, "Enter a valid time.");
export const optionalPlainTime = z.preprocess((v) => (v === "" || v == null ? null : v), plainTimeSchema.nullable());

export const timeZoneSchema = z
  .string({ error: "Choose a time zone." })
  .refine(isValidTimeZone, "Choose a valid time zone.");

/** Accepts any common phone format; outputs E.164 or null. */
export const optionalPhone = z.preprocess(toTrimmedString, z.string()).transform((value, ctx) => {
  if (value === "") return null;
  const result = normalizePhone(value);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.message });
    return z.NEVER;
  }
  return result.e164;
});

const emailCheck = z.email();

/** Outputs a lowercased email or null. */
export const optionalEmail = z.preprocess(toTrimmedString, z.string().max(254, "That email is too long.")).transform((value, ctx) => {
  if (value === "") return null;
  const normalized = normalizeEmail(value);
  if (!emailCheck.safeParse(normalized).success) {
    ctx.addIssue({ code: "custom", message: "Enter a valid email address, like name@example.com." });
    return z.NEVER;
  }
  return normalized;
});

/** Accepts "example.com" or a full URL; outputs a normalized https URL or null. */
export const optionalUrl = z.preprocess(toTrimmedString, z.string().max(200, "That address is too long.")).transform((value, ctx) => {
  if (value === "") return null;
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes(".")) throw new Error("no tld");
    return url.toString().replace(/\/$/, "");
  } catch {
    ctx.addIssue({ code: "custom", message: "Enter a valid website, like example.com." });
    return z.NEVER;
  }
});

export function optionalInt(min: number, max: number, label: string) {
  return z.preprocess(
    (v) => (v === "" || v == null ? null : v),
    z
      .number({ error: `${label} must be a number.` })
      .int(`${label} must be a whole number.`)
      .min(min, `${label} must be at least ${min}.`)
      .max(max, `${label} can't be more than ${max}.`)
      .nullable(),
  );
}

export const entityId = z.string().min(1, "Missing record reference.").max(64);
export const versionSchema = z.number().int().min(1);
export const clientRequestId = z.string().min(8).max(64);

/** Deduplicate free-text tags case-insensitively, preserving first spelling. */
export function dedupeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}
