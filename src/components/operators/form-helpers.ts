import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionError } from "@/lib/action-result";

/**
 * Apply server-side field errors to a react-hook-form instance. Keys are
 * dotted input paths ("serviceAreas.2"); `alias` maps them onto form fields.
 * Returns messages that didn't map to a field (shown as a form-level error).
 */
export function applyServerErrors<T extends FieldValues>(
  error: ActionError,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
  alias: (key: string) => string = (key) => key,
): string[] {
  const unmapped: string[] = [];
  let focused = false;
  for (const [key, messages] of Object.entries(error.fieldErrors ?? {})) {
    const field = alias(key);
    const target = fields.find((f) => f === field || field.startsWith(`${f}.`));
    if (target && messages[0]) {
      setError(target, { type: "server", message: messages[0] }, { shouldFocus: !focused });
      focused = true;
    } else if (messages[0]) {
      unmapped.push(messages[0]);
    }
  }
  return unmapped;
}
