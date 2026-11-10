/**
 * Typed service errors. Actions translate these into user-facing results;
 * anything else is treated as an unexpected failure. All writes run inside
 * transactions, so a thrown error always means nothing was saved.
 */
import type { ZodError } from "zod";

export type FieldErrors = Record<string, string[]>;

export interface DuplicateMatch {
  id: string;
  fullName: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  matchedOn: Array<"email" | "phone">;
  leadCount: number;
}

export class ServiceError extends Error {
  constructor(
    readonly code: "not_found" | "conflict" | "validation" | "rule" | "duplicate",
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super("not_found", message);
  }
}

/** The record changed since the user loaded it. */
export class ConflictError extends ServiceError {
  constructor(message = "This record was changed in another tab or by someone else. Reload to see the latest version, then try again.") {
    super("conflict", message);
  }
}

/** A business rule prevents the operation (e.g. deleting a customer with inquiries). */
export class RuleError extends ServiceError {
  constructor(message: string) {
    super("rule", message);
  }
}

export class ValidationError extends ServiceError {
  constructor(
    message: string,
    readonly fieldErrors: FieldErrors = {},
  ) {
    super("validation", message);
  }

  static fromZod(error: ZodError): ValidationError {
    const fieldErrors: FieldErrors = {};
    for (const issue of error.issues) {
      const key = issue.path.map(String).join(".") || "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const count = Object.keys(fieldErrors).length;
    return new ValidationError(count === 1 ? "Please fix the highlighted field." : `Please fix the ${count} highlighted fields.`, fieldErrors);
  }
}

/** Possible duplicate customer — the caller must confirm before creating. */
export class DuplicateCustomerError extends ServiceError {
  constructor(readonly matches: DuplicateMatch[]) {
    super("duplicate", matches.length === 1 ? "A customer with the same contact details already exists." : "Customers with the same contact details already exist.");
  }
}
