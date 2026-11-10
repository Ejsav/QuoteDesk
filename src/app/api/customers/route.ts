import type { NextRequest } from "next/server";
import { jsonRoute } from "@/server/route-helpers";
import { searchCustomersForPicker } from "@/server/services/customers";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);
  return jsonRoute((ctx) => searchCustomersForPicker(ctx, q));
}
