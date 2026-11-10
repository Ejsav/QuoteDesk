import type { NextRequest } from "next/server";
import { normalizeEmail, normalizePhone } from "@/domain/contact";
import { jsonRoute } from "@/server/route-helpers";
import { checkDuplicateCustomers } from "@/server/services/customers";

/** Live duplicate hints while typing contact details. Read-only. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rawEmail = params.get("email")?.trim() ?? "";
  const rawPhone = params.get("phone")?.trim() ?? "";
  const phone = rawPhone ? normalizePhone(rawPhone) : null;
  const email = rawEmail.includes("@") ? normalizeEmail(rawEmail) : null;
  return jsonRoute((ctx) =>
    checkDuplicateCustomers(ctx, {
      email,
      phone: phone?.ok ? phone.e164 : null,
      excludeId: params.get("exclude") ?? undefined,
    }),
  );
}
