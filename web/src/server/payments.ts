import { NicepayTestProvider, nicepayCredentials } from "./nicepay";
import { randomUUID } from "node:crypto";
import { AppError } from "../domain/model";
import { one, type Database, type Row } from "./db";
import { lockOwner } from "./service";
export type Payment = {
  orderId: string;
  paymentKey: string;
  totalAmount: number;
  currency: string;
  status: string;
};
export interface Provider {
  confirm(order: Row, key: string): Promise<Payment>;
  lookup(order: Row): Promise<Payment>;
  cancel(order: Row): Promise<Payment>;
}
export class PaymentNotFound extends Error {}
export class MockProvider implements Provider {
  constructor(
    private db: Database,
    private loseResponse = false,
  ) {}
  async confirm(order: Row, key: string) {
    if (key !== `mock_${order.id}`) throw new AppError("INVALID_PAYMENT_KEY");
    await this.db.query(
      "INSERT INTO mock_payments(order_id,payment_key,amount,status) VALUES($1,$2,$3,'DONE') ON CONFLICT(order_id) DO NOTHING",
      [order.id, key, order.amount],
    );
    if (this.loseResponse) throw new Error("SIMULATED_RESPONSE_LOST");
    return this.lookup(order);
  }
  async lookup(order: Row) {
    const p = await one(
      this.db,
      "SELECT * FROM mock_payments WHERE order_id=$1",
      [order.id],
    );
    if (!p) throw new PaymentNotFound("PAYMENT_NOT_FOUND");
    return {
      orderId: p.order_id,
      paymentKey: p.payment_key,
      totalAmount: p.amount,
      currency: "KRW",
      status: p.status,
    };
  }
  async cancel(order: Row) {
    await this.db.query(
      "UPDATE mock_payments SET status='CANCELED' WHERE order_id=$1",
      [order.id],
    );
    return this.lookup(order);
  }
}
export class TossTestProvider implements Provider {
  constructor(private secret: string) {
    if (!/^test_sk_/.test(secret))
      throw new Error("ONLY_TOSS_TEST_KEYS_ALLOWED");
  }
  private async request(
    path: string,
    body?: unknown,
    idempotency?: string,
  ): Promise<Payment> {
    const response = await fetch(
      `https://api.tosspayments.com/v1/payments${path}`,
      {
        method: body ? "POST" : "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Basic ${Buffer.from(this.secret + ":").toString("base64")}`,
          "Content-Type": "application/json",
          ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    if (response.status === 404) throw new PaymentNotFound("PAYMENT_NOT_FOUND");
    if (!response.ok) throw new Error("PROVIDER_REQUEST_FAILED");
    return (await response.json()) as Payment;
  }
  confirm(o: Row, key: string) {
    return this.request(
      "/confirm",
      { paymentKey: key, orderId: o.id, amount: o.amount },
      o.id,
    );
  }
  lookup(o: Row) {
    return this.request(`/orders/${encodeURIComponent(o.id)}`);
  }
  async cancel(o: Row) {
    const p = await this.lookup(o);
    if (p.status === "CANCELED") return p;
    return this.request(
      `/${encodeURIComponent(p.paymentKey)}/cancel`,
      { cancelReason: "테스트 결제 취소" },
      `refund-${o.id}`,
    );
  }
}
export function providerFor(db: Database, name: string): Provider {
  if (name === "mock") return new MockProvider(db);
  if (name === "nicepay-test") {
    const { client, secret } = nicepayCredentials();
    return new NicepayTestProvider(client, secret);
  }
  if (name === "toss-test")
    return new TossTestProvider(process.env.TOSS_SECRET_KEY ?? "");
  throw new Error("UNKNOWN_PAYMENT_PROVIDER");
}
export async function ownedOrder(db: Database, owner: string, id: string) {
  const o = await one(db, "SELECT * FROM orders WHERE id=$1 AND owner_id=$2", [
    id,
    owner,
  ]);
  if (!o) throw new AppError("NOT_FOUND", 404, "주문을 찾을 수 없어요.");
  return o;
}
export async function applyPayment(
  db: Database,
  owner: string,
  id: string,
  p: Payment,
) {
  return db.transaction(async (tx) => {
    const account = await one(
      tx,
      "SELECT deleted_at,merged_into FROM accounts WHERE id=$1 FOR UPDATE",
      [owner],
    );
    if (!account || account.merged_into)
      throw new AppError("UNAUTHORIZED", 401);
    // Erasure keeps minimal financial records. A late refund may still close them,
    // while a late approval must never regenerate erased personal results.
    if (account.deleted_at && p.status !== "CANCELED") return;
    const o = await one(
      tx,
      "SELECT * FROM orders WHERE id=$1 AND owner_id=$2 FOR UPDATE",
      [id, owner],
    );
    if (!o) throw new AppError("NOT_FOUND", 404);
    if (
      p.orderId !== id ||
      p.totalAmount !== o.amount ||
      p.currency !== "KRW" ||
      !p.paymentKey ||
      (o.payment_key && o.payment_key !== p.paymentKey)
    )
      throw new AppError(
        "PAYMENT_MISMATCH",
        409,
        "결제 확인 정보가 일치하지 않아요.",
      );
    if (p.status === "CANCELED") {
      await tx.query(
        "UPDATE orders SET state='refunded',payment_key=$2 WHERE id=$1",
        [id, p.paymentKey],
      );
      await tx.query(
        "UPDATE entitlements SET state='revoked' WHERE comparison_id=$1",
        [o.comparison_id],
      );
      await tx.query(
        "UPDATE shares SET revoked_at=coalesce(revoked_at,now()) WHERE comparison_id=$1",
        [o.comparison_id],
      );
      await tx.query(
        "UPDATE generation_jobs SET state='cancelled',fence=fence+1 WHERE comparison_id=$1",
        [o.comparison_id],
      );
      await tx.query("UPDATE comparisons SET state='cancelled' WHERE id=$1", [
        o.comparison_id,
      ]);
      return;
    }
    if (p.status !== "DONE")
      throw new AppError(
        "PAYMENT_PENDING",
        409,
        "결제 상태를 확인 중이에요. 잠시 후 다시 확인해 주세요.",
      );
    if (["refund_pending", "refunded", "cancelled"].includes(o.state)) return;
    // A verified late approval may update money elsewhere, but must never
    // recreate entitlements/jobs from a deliberately erased comparison.
    if (!(await one(tx, "SELECT id FROM comparisons WHERE id=$1 AND owner_id=$2 AND inputs<>'{}'::jsonb", [o.comparison_id, owner]))) return;
    await tx.query(
      "UPDATE orders SET state='paid',payment_key=$2 WHERE id=$1",
      [id, p.paymentKey],
    );
    await tx.query(
      "INSERT INTO entitlements(comparison_id,owner_id,source,order_id,state) VALUES($1,$2,'paid',$3,'active') ON CONFLICT DO NOTHING",
      [o.comparison_id, owner, id],
    );
    await tx.query(
      "INSERT INTO generation_jobs(comparison_id,owner_id,state) VALUES($1,$2,'queued') ON CONFLICT DO NOTHING",
      [o.comparison_id, owner],
    );
    await tx.query(
      "UPDATE comparisons SET state='queued' WHERE id=$1 AND state='awaiting_payment'",
      [o.comparison_id],
    );
  });
}
export async function confirmPayment(
  db: Database,
  owner: string,
  id: string,
  key: string,
  amount: number,
  provider?: Provider,
) {
  if (typeof key !== "string" || key.length > 200 || !key.length)
    throw new AppError("INVALID_PAYMENT_KEY");
  const o = await db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const o = await one(
      tx,
      "SELECT * FROM orders WHERE id=$1 AND owner_id=$2 FOR UPDATE",
      [id, owner],
    );
    if (!o) throw new AppError("NOT_FOUND", 404);
    if (amount !== o.amount)
      throw new AppError("AMOUNT_MISMATCH", 422, "결제 금액을 확인해 주세요.");
    if (["refunded", "refund_pending", "cancelled"].includes(o.state))
      throw new AppError("ORDER_CLOSED", 409, "취소된 주문이에요.");
    if (o.state === "created" && new Date(o.expires_at).getTime() < Date.now())
      throw new AppError(
        "ORDER_EXPIRED",
        409,
        "주문 시간이 지났어요. 이 주문을 취소하고 다시 진행해 주세요.",
      );
    if (o.payment_key && o.payment_key !== key)
      throw new AppError("PAYMENT_KEY_MISMATCH", 409);
    await tx.query(
      "UPDATE orders SET state=CASE WHEN state='created' THEN 'confirming' ELSE state END,payment_key=$2 WHERE id=$1",
      [id, key],
    );
    if (o.state === "created")
      await tx.query("INSERT INTO payment_attempts(id,order_id,operation,state) VALUES($1,$2,'confirm','requested')", [randomUUID(), id]);
    return o;
  });
  if (o.state === "paid") return;
  const p = provider ?? providerFor(db, o.provider);
  try {
    let receipt: Payment;
    if (["confirming", "confirmation_unknown"].includes(o.state)) {
      try {
        receipt = await p.lookup({ ...o, payment_key: key });
        if (receipt.status === "READY") receipt = await p.confirm(o, key);
      } catch (e) {
        if (!(e instanceof PaymentNotFound)) throw e;
        receipt = await p.confirm(o, key);
      }
    } else receipt = await p.confirm(o, key);
    await applyPayment(db, owner, id, receipt);
    await db.query(
      "INSERT INTO payment_attempts(id,order_id,operation,state) VALUES($1,$2,'confirm','verified')",
      [randomUUID(), id],
    );
  } catch (e) {
    await db.query(
      "UPDATE orders SET state='confirmation_unknown' WHERE id=$1 AND state='confirming'",
      [id],
    );
    await db.query(
      "INSERT INTO payment_attempts(id,order_id,operation,state) VALUES($1,$2,'confirm','unknown')",
      [randomUUID(), id],
    );
    if (e instanceof AppError) throw e;
    throw new AppError(
      "CONFIRMATION_UNKNOWN",
      503,
      "승인 응답을 확인하지 못했어요. 다시 결제하지 말고 결제 상태 확인을 눌러 주세요.",
    );
  }
}
export async function reconcilePayment(
  db: Database,
  owner: string,
  id: string,
  provider?: Provider,
) {
  const o = await ownedOrder(db, owner, id);
  try {
    const gateway = provider ?? providerFor(db, o.provider);
    let receipt;
    try {
      receipt = await gateway.lookup(o);
      if (
        receipt.status === "READY" &&
        o.payment_key &&
        ["confirming", "confirmation_unknown"].includes(o.state)
      )
        receipt = await gateway.confirm(o, o.payment_key);
    } catch (e) {
      if (
        !(e instanceof PaymentNotFound) ||
        !o.payment_key ||
        !["confirming", "confirmation_unknown"].includes(o.state)
      )
        throw e;
      receipt = await gateway.confirm(o, o.payment_key);
    }
    await applyPayment(db, owner, id, receipt);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "PAYMENT_LOOKUP_FAILED",
      503,
      "결제사 상태를 아직 확인하지 못했어요. 잠시 후 다시 확인해 주세요.",
    );
  }
}
export async function refundPayment(
  db: Database,
  owner: string,
  id: string,
  provider?: Provider,
) {
  const o = await db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const o = await one(
      tx,
      "SELECT * FROM orders WHERE owner_id=$1 AND id=$2 FOR UPDATE",
      [owner, id],
    );
    if (!o) throw new AppError("NOT_FOUND", 404);
    if (o.state === "refunded") return o;
    if (!["paid", "refund_pending"].includes(o.state))
      throw new AppError(
        "REFUND_NOT_READY",
        409,
        "승인된 테스트 주문만 취소할 수 있어요.",
      );
    await tx.query("UPDATE orders SET state='refund_pending' WHERE id=$1", [
      id,
    ]);
    if (o.state === "paid")
      await tx.query("INSERT INTO payment_attempts(id,order_id,operation,state) VALUES($1,$2,'refund','requested')", [randomUUID(), id]);
    await tx.query(
      "UPDATE entitlements SET state='revoked' WHERE comparison_id=$1",
      [o.comparison_id],
    );
    await tx.query(
      "UPDATE shares SET revoked_at=coalesce(revoked_at,now()) WHERE comparison_id=$1",
      [o.comparison_id],
    );
    await tx.query(
      "UPDATE generation_jobs SET state='cancelled',fence=fence+1 WHERE comparison_id=$1",
      [o.comparison_id],
    );
    return o;
  });
  if (o.state === "refunded") return;
  try {
    const receipt = await (provider ?? providerFor(db, o.provider)).cancel(o);
    if (receipt.status !== "CANCELED") throw new Error("REFUND_NOT_CONFIRMED");
    await applyPayment(db, owner, id, receipt);
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError(
      "REFUND_PENDING",
      503,
      "테스트 취소 확인 중이에요. 취소 재시도로 상태를 확인해 주세요.",
    );
  }
}
export async function cancelOrder(db: Database, owner: string, id: string) {
  return db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const o = await one(
      tx,
      "UPDATE orders SET state='cancelled' WHERE owner_id=$1 AND id=$2 AND state='created' RETURNING comparison_id",
      [owner, id],
    );
    if (!o)
      throw new AppError(
        "CANNOT_CANCEL",
        409,
        "결제 상태를 먼저 확인해 주세요.",
      );
    await tx.query("UPDATE comparisons SET state='cancelled' WHERE id=$1", [
      o.comparison_id,
    ]);
  });
}
// Webhook body is only a hint. Provider lookup must verify the current payment before applying it.
export async function paymentEvent(
  db: Database,
  id: string,
  eventKey: string,
  provider?: Provider,
) {
  const o = await one(db, "SELECT * FROM orders WHERE id=$1", [id]);
  if (!o) throw new AppError("NOT_FOUND", 404);
  await reconcilePayment(db, o.owner_id, id, provider);
  await db.query(
    "INSERT INTO payment_events(event_key,order_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [eventKey, id],
  );
}
