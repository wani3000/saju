import { readRequestBody } from "@/server/request-body";
import { AppError } from "@/domain/model";
import { NextRequest, NextResponse } from "next/server";
import { database } from "@/server/db";
import { acceptNicepayReturn } from "@/server/nicepay-checkout";
import { rateLimit } from "@/server/service";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  const origin = process.env.APP_ORIGIN;
  if (!origin || process.env.PAYMENT_PROVIDER !== "nicepay-test")
    return new Response("Unavailable", { status: 503 });
  let outcome = "pending";
  try {
    const raw = await readRequestBody(req);
    const db = await database();
    await rateLimit(db, "nicepay-return", 60);
    await acceptNicepayReturn(
      db,
      req.nextUrl.searchParams.get("state") ?? "",
      Object.fromEntries(new URLSearchParams(raw)),
    );
    outcome = "checked";
  } catch (error) {
    if (error instanceof AppError && [400, 408, 413].includes(error.status))
      return new Response(null, { status: error.status });
    /* No birth data, callback tokens, auth tokens or provider messages in logs. */
  }
  return NextResponse.redirect(
    new URL("/?paymentReturn=" + outcome, origin),
    303,
  );
}
