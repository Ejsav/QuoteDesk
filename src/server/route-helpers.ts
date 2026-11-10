import "server-only";
import { NextResponse } from "next/server";
import { DatabaseNotReadyError, getContext } from "./context";
import type { ServiceContext } from "./services/context";

/** JSON GET handler wrapper: resolves context, maps setup/unknown errors to clean responses. */
export async function jsonRoute<T>(handler: (ctx: ServiceContext) => Promise<T>): Promise<NextResponse> {
  try {
    const ctx = await getContext();
    return NextResponse.json(await handler(ctx), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DatabaseNotReadyError) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 503 });
    }
    console.error("[QuoteDesk] Route failure:", error);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
