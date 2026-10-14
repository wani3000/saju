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
    if (Number(req.headers.get("content-length") ?? 0) > 16384)
      throw new Error("TOO_LARGE");
    const raw = await req.text();
    if (raw.length > 16384) throw new Error("TOO_LARGE");
    const db = await database();
    await rateLimit(db, "nicepay-return", 60);
    await acceptNicepayReturn(
      db,
      req.nextUrl.searchParams.get("state") ?? "",
      Object.fromEntries(new URLSearchParams(raw)),
    );
    outcome = "checked";
  } catch {
    /* No birth data, callback tokens, auth tokens or provider messages in logs. */
  }
  return NextResponse.redirect(
    new URL("/?paymentReturn=" + outcome, origin),
    303,
  );
}
