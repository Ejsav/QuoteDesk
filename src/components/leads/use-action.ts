"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionError, ActionResult } from "@/lib/action-result";

interface RunOptions<O> {
  success?: string | ((data: O) => string | null);
  onSuccess?: (data: O) => void;
  /** Return true when the error was fully handled (suppresses the toast). */
  onError?: (error: ActionError) => boolean | void;
}

/**
 * Runs a server action inside a transition: `pending` stays true until the
 * action AND the revalidated page render finish, so controls can't be
 * double-fired against stale data.
 */
export function useAction<I, O>(action: (input: I) => Promise<ActionResult<O>>) {
  const [pending, startTransition] = useTransition();

  function run(input: I, options: RunOptions<O> = {}): Promise<ActionResult<O>> {
    return new Promise((resolve) => {
      startTransition(async () => {
        let result: ActionResult<O>;
        try {
          result = await action(input);
        } catch {
          result = {
            ok: false,
            error: { code: "internal", message: "Couldn't reach the server. Check that QuoteDesk is still running, then try again." },
          };
        }
        if (result.ok) {
          const message = typeof options.success === "function" ? options.success(result.data) : options.success;
          if (message) toast.success(message);
          options.onSuccess?.(result.data);
        } else {
          const handled = options.onError?.(result.error);
          if (!handled) toast.error(result.error.message);
        }
        resolve(result);
      });
    });
  }

  return { pending, run };
}
