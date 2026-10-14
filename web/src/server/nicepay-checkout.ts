import { z } from "zod";
import { one, type Database } from "./db";
import { hash, token, lockOwner } from "./service";
import { AppError } from "../domain/model";
import { nicepayCredentials, signatureMatches } from "./nicepay";
import { confirmPayment, type Provider } from "./payments";
export async function prepareNicepay(
  db: Database,
  owner: string,
  id: string,
  origin: string,
) {
  const { client } = nicepayCredentials();
  const nonce = token();
  return db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const o = await one(
      tx,
      "SELECT * FROM orders WHERE id=$1 AND owner_id=$2 AND provider='nicepay-test' AND state='created' AND expires_at>now() FOR UPDATE",
      [id, owner],
    );
    if (!o)
      throw new AppError(
        "ORDER_NOT_READY",
        409,
        "주문 상태를 먼저 확인해 주세요.",
      );
    await tx.query(
      "INSERT INTO nicepay_attempts(order_id,return_hash) VALUES($1,$2) ON CONFLICT(order_id) DO UPDATE SET return_hash=$2,expires_at=now()+interval '20 minutes'",
      [id, hash(nonce)],
    );
    return {
      clientId: client,
      method: "card",
      orderId: id,
      amount: o.amount,
      goodsName: "가까운 사이 테스트",
      returnUrl: origin + "/api/nicepay/return?state=" + nonce,
    };
  });
}
const authSchema = z.object({
  orderId: z.uuid(),
  tid: z.string().regex(/^[a-zA-Z0-9_-]{1,30}$/),
  clientId: z.string().max(50),
  authToken: z.string().min(1).max(100),
  amount: z.coerce.number().int().positive(),
  signature: z.string().length(64),
  authResultCode: z.literal("0000"),
});
export async function acceptNicepayReturn(
  db: Database,
  nonce: string,
  input: unknown,
  provider?: Provider,
) {
  if (!/^[\w-]{43}$/.test(nonce)) throw new AppError("INVALID_RETURN", 400);
  const parsed = authSchema.safeParse(input);
  if (!parsed.success) throw new AppError("INVALID_RETURN", 400);
  const f = parsed.data,
    { client, secret } = nicepayCredentials();
  const o = await one(
    db,
    `SELECT o.* FROM orders o JOIN nicepay_attempts a ON a.order_id=o.id WHERE o.id=$1 AND o.provider='nicepay-test' AND a.return_hash=$2 AND a.expires_at>now()`,
    [f.orderId, hash(nonce)],
  );
  if (
    !o ||
    f.amount !== o.amount ||
    f.clientId !== client ||
    !signatureMatches(
      `${f.authToken}${f.clientId}${f.amount}${secret}`,
      f.signature,
    )
  )
    throw new AppError("INVALID_RETURN", 400);
  await confirmPayment(db, o.owner_id, o.id, f.tid, f.amount, provider);
  // Keep this bounded nonce until expiry to allow duplicate callbacks to finish idempotently.
}
