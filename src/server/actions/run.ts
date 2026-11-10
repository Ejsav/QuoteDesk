import "server-only";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import type { ActionError, ActionResult } from "@/lib/action-result";
import { DatabaseNotReadyError, getContext } from "../context";
import type { ServiceContext } from "../services/context";
import { DuplicateCustomerError, ServiceError, ValidationError } from "../services/errors";

function toActionError(error: unknown): ActionError {
  if (error instanceof DuplicateCustomerError) {
    return { code: "duplicate", message: error.message, duplicates: error.matches };
  }
  if (error instanceof ValidationError) {
    return { code: "validation", message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof ServiceError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof DatabaseNotReadyError) {
    return { code: "unavailable", message: "The database isn't set up yet. Run `npm run db:setup`, then reload." };
  }
  console.error("[QuoteDesk] Unexpected action failure:", error);
  return {
    code: "internal",
    message: "Something went wrong and nothing was saved. Please try again — if it keeps happening, check the server log.",
  };
}

/**
 * Standard action pipeline: validate → act → revalidate.
 * Services run inside transactions, so any failure leaves data unchanged.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  handler: (data: z.output<S>, ctx: ServiceContext) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { ok: false, error: toActionError(ValidationError.fromZod(parsed.error)) };
    const ctx = await getContext();
    const data = await handler(parsed.data, ctx);
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}
