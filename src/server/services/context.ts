import { todayInZone, type PlainDate } from "@/domain/dates";
import type { DB } from "../db/client";

/**
 * Everything a service needs to act on behalf of someone. Passed explicitly so
 * services stay testable (tests and the seed inject their own db and clock).
 *
 * Future auth: `getContext()` will resolve the workspace and user from the
 * session instead of the single demo workspace — services won't change.
 */
export interface ServiceContext {
  db: DB;
  workspace: { id: string; name: string; timeZone: string; currency: string };
  user: { id: string; name: string };
  now: () => Date;
}

export function today(ctx: ServiceContext): PlainDate {
  return todayInZone(ctx.workspace.timeZone, ctx.now());
}
