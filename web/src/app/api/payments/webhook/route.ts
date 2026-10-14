import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { database, one } from "@/server/db";
import { paymentEvent } from "@/server/payments";
import { hash, rateLimit } from "@/server/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (process.env.PAYMENT_PROVIDER !== "toss-test")
    return NextResponse.json(
      { code: "TEST_PROVIDER_REQUIRED" },
      { status: 403 },
    );
  try {
    const db = await database();
    await rateLimit(db, "toss-webhook", 60);
    const raw = await req.text();
    if (raw.length > 16384) return new Response(null, { status: 413 });
    const event = z
      .object({
        eventType: z.enum(["PAYMENT_STATUS_CHANGED", "CANCEL_STATUS_CHANGED"]),
        createdAt: z.string(),
        data: z.object({ orderId: z.uuid() }).passthrough(),
      })
      .safeParse(JSON.parse(raw));
    if (!event.success) return new Response(null, { status: 400 });
    const order = await one(db, "SELECT provider FROM orders WHERE id=$1", [
      event.data.data.orderId,
    ]);
    if (order?.provider !== "toss-test")
      return new Response(null, { status: 404 });
    // No state, amount or payment key from the webhook is trusted. Verify with Toss using server credentials.
    await paymentEvent(
      db,
      event.data.data.orderId,
      hash(JSON.stringify(event.data)),
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ code: "EVENT_NOT_VERIFIED" }, { status: 503 });
  }
}
