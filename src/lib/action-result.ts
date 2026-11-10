/**
 * The contract between server actions and the UI. Every action resolves to an
 * ActionResult — actions never throw to the client.
 */
export type ActionErrorCode = "validation" | "not_found" | "conflict" | "rule" | "duplicate" | "unavailable" | "internal";

export interface DuplicateMatchView {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  matchedOn: Array<"email" | "phone">;
  leadCount: number;
}

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  /** Keyed by dotted input path, e.g. "customer.phone". */
  fieldErrors?: Record<string, string[]>;
  duplicates?: DuplicateMatchView[];
}

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: ActionError };
