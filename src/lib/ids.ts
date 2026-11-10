/**
 * Prefixed random identifiers, e.g. "lead_7k2m9q4w8x1c5v3b6n0p".
 * The prefix makes logs and URLs self-describing; 100 bits of randomness
 * (Crockford base32) makes collisions practically impossible.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

export type IdPrefix = "ws" | "usr" | "cus" | "lead" | "stop" | "op" | "veh" | "comp" | "act";

export function newId(prefix: IdPrefix): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let out = "";
  for (const b of bytes) out += ALPHABET[b & 31];
  return `${prefix}_${out}`;
}

/** Idempotency key for a form instance. */
export function newRequestId(): string {
  return crypto.randomUUID();
}
