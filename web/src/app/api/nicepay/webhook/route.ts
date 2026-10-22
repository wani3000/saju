import { readRequestBody } from "@/server/request-body";
import { AppError } from "@/domain/model";
import { database } from "@/server/db";
import { rateLimit } from "@/server/service";
import { acceptNicepayWebhook,verifyNicepayWebhook } from "@/server/nicepay-webhook";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (process.env.PAYMENT_PROVIDER !== "nicepay-test")
    return new Response("Unavailable", { status: 503 });
  try {
    const raw = await readRequestBody(req);
    let input:unknown;
    try{input=JSON.parse(raw);}catch{throw new AppError("INVALID_WEBHOOK",400);}
    verifyNicepayWebhook(input);
    const db = await database();
    await rateLimit(db, "nicepay-webhook", 120);
    await acceptNicepayWebhook(db,input);
    return new Response("OK", {
      headers: { "Content-Type": "text/html", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AppError && [400, 408, 413].includes(error.status))
      return new Response(null, { status: error.status });
    return new Response("Retry", { status: 503 });
  }
}
