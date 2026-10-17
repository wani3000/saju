import { readRequestBody } from "@/server/request-body";
import { AppError } from "@/domain/model";
import { database, one } from "@/server/db";
import { rateLimit, hash } from "@/server/service";
import { paymentEvent } from "@/server/payments";
import { nicepayCredentials, signatureMatches } from "@/server/nicepay";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (process.env.PAYMENT_PROVIDER !== "nicepay-test")
    return new Response("Unavailable", { status: 503 });
  try {
    const raw = await readRequestBody(req);
    const f = z
      .object({
        orderId: z.uuid(),
        tid: z.string().min(1).max(30),
        amount: z.number().int(),
        ediDate: z.string().max(40),
        signature: z.string().length(64),
      })
      .parse(JSON.parse(raw));
    const { secret } = nicepayCredentials();
    if (
      !signatureMatches(`${f.tid}${f.amount}${f.ediDate}${secret}`, f.signature)
    )
      return new Response("Invalid", { status: 400 });
    const db = await database();
    await rateLimit(db, "nicepay-webhook", 120);
    const o = await one(
      db,
      "SELECT * FROM orders WHERE id=$1 AND provider='nicepay-test'",
      [f.orderId],
    );
    if (
      !o ||
      o.amount !== f.amount ||
      (o.payment_key && o.payment_key !== f.tid)
    )
      return new Response("Invalid", { status: 400 });
    await paymentEvent(db, f.orderId, "nicepay:" + hash(raw));
    return new Response("OK", {
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AppError && [400, 408, 413].includes(error.status))
      return new Response(null, { status: error.status });
    return new Response("Retry", { status: 503 });
  }
}
