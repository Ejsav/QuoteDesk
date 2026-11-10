import type { NextRequest } from "next/server";
import { jsonRoute } from "@/server/route-helpers";
import { globalSearch } from "@/server/services/search";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  return jsonRoute((ctx) => globalSearch(ctx, q));
}
