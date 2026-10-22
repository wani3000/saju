import {z} from "zod";
import {AppError} from "../domain/model";
import {one,type Database} from "./db";
import {hash} from "./service";
import {nicepayCredentials,signatureMatches} from "./nicepay";
import {paymentEvent,type Provider} from "./payments";

const notification = z.object({
  // The sandbox can be shared with another service whose order IDs are not UUIDs.
  orderId:z.string().min(1).max(64),
  tid:z.string().regex(/^[a-zA-Z0-9_-]{1,30}$/),
  amount:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ediDate:z.string().min(1).max(40),
  signature:z.string().regex(/^[a-fA-F0-9]{64}$/),
});
export function verifyNicepayWebhook(input:unknown) {
  const parsed=notification.safeParse(input);
  if(!parsed.success)throw new AppError("INVALID_WEBHOOK",400);
  const f=parsed.data,{secret}=nicepayCredentials();
  if(!signatureMatches(`${f.tid}${f.amount}${f.ediDate}${secret}`,f.signature))
    throw new AppError("INVALID_WEBHOOK",400);
  return f;
}
export async function acceptNicepayWebhook(db:Database, input:unknown, provider?:Provider) {
  const f=verifyNicepayWebhook(input);
  // Acknowledge signed foreign transactions without retries, saving them, or
  // querying/cancelling them at the gateway. Never use an unverified payload.
  if(!z.uuid().safeParse(f.orderId).success)return "ignored" as const;
  const order=await one(db,"SELECT * FROM orders WHERE id=$1 AND provider='nicepay-test'",[f.orderId]);
  if(!order)return "ignored" as const;
  if(order.amount!==f.amount || (order.payment_key && order.payment_key!==f.tid))
    throw new AppError("INVALID_WEBHOOK",400);
  // Re-query provider truth. The incoming status is never enough to grant access.
  // Use signed fields for a stable event key, independent of JSON order/extra PII.
  await paymentEvent(db,order.id,"nicepay:"+hash(`${f.tid}\n${f.amount}\n${f.ediDate}`),provider);
  return "checked" as const;
}
