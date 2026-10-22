import { createHash, timingSafeEqual } from "node:crypto";
import { AppError } from "../domain/model";
import { PaymentNotFound, type Provider, type Payment } from "./payments";
import type { Row } from "./db";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
export function signatureMatches(payload: string, signature: unknown) {
  if (typeof signature !== "string" || !/^[a-fA-F0-9]{64}$/.test(signature))
    return false;
  return timingSafeEqual(
    Buffer.from(digest(payload), "hex"),
    Buffer.from(signature, "hex"),
  );
}
export function nicepayCredentials() {
  const client = process.env.NICEPAY_CLIENT_KEY ?? "",
    secret = process.env.NICEPAY_SECRET_KEY ?? "";
  // S2 is sandbox + server approval. R keys and production origins are never accepted here.
  if (
    !client.startsWith("S2_") ||
    !secret ||
    process.env.NICEPAY_MODE !== "sandbox"
  )
    throw new AppError(
      "NICEPAY_NOT_CONFIGURED",
      503,
      "NICEPAY 테스트 상점 연결이 필요해요.",
    );
  return { client, secret };
}
export class NicepayTestProvider implements Provider {
  constructor(
    private client: string,
    private secret: string,
    private transport: typeof fetch = fetch,
    private authenticatedReturn?: {orderId:string;tid:string},
  ) {
    if (!client.startsWith("S2_") || !secret)
      throw new Error("ONLY_NICEPAY_SANDBOX_SERVER_KEYS_ALLOWED");
  }
  async request(path: string, body?: unknown): Promise<Row> {
    const response = await this.transport(
      "https://sandbox-api.nicepay.co.kr/v1/payments" + path,
      {
        method: body ? "POST" : "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(this.client + ":" + this.secret).toString("base64"),
          "Content-Type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const p = await response.json();
    // Card authentication is not a payment yet. NICEPAY returns U107 until
    // approval; only a verified return may initiate that first approval.
    if (!body && response.status===404 && p.resultCode==="U107")
      throw new PaymentNotFound("PAYMENT_NOT_FOUND");
    if (!response.ok || p.resultCode !== "0000")
      throw new Error("NICEPAY_REQUEST_FAILED");
    if (
      typeof p.tid !== "string" ||
      !Number.isSafeInteger(p.amount) ||
      typeof p.ediDate !== "string" ||
      !signatureMatches(
        `${p.tid}${p.amount}${p.ediDate}${this.secret}`,
        p.signature,
      )
    )
      throw new Error("NICEPAY_SIGNATURE_MISMATCH");
    return p;
  }
  receipt(p: Row, o: Row): Payment {
    if (
      p.orderId !== o.id ||
      p.currency !== "KRW" ||
      p.amount !== o.amount ||
      (o.payment_key && p.tid !== o.payment_key)
    )
      throw new Error("NICEPAY_ORDER_MISMATCH");
    // Only a fully cancelled transaction revokes the entire purchase.
    const status =
      p.status === "paid"
        ? "DONE"
        : p.status === "cancelled" && p.balanceAmt === 0
          ? "CANCELED"
          : p.status === "ready"
            ? "READY"
            : "PENDING";
    return {
      orderId: p.orderId,
      paymentKey: p.tid,
      totalAmount: p.amount,
      currency: "KRW",
      status,
    };
  }
  async confirm(o: Row, key: string) {
    const bound = { ...o, payment_key: key };
    if(this.authenticatedReturn && this.authenticatedReturn.orderId===o.id && this.authenticatedReturn.tid===key)
      return this.receipt(await this.request("/"+encodeURIComponent(key),{amount:o.amount}),bound);
    // Generic API/reconciliation calls cannot turn an arbitrary TID into a
    // charge. A first approval is scoped to a nonce/signature-verified return.
    const current = await this.lookup(bound);
    if (current.status === "DONE" || current.status === "CANCELED")
      return current;
    if (current.status !== "READY") throw new Error("NICEPAY_NOT_READY");
    return this.receipt(
      await this.request("/" + encodeURIComponent(key), { amount: o.amount }),
      bound,
    );
  }
  forAuthenticatedReturn(orderId:string,tid:string) {
    return new NicepayTestProvider(this.client,this.secret,this.transport,{orderId,tid});
  }
  async lookup(o: Row) {
    const path = o.payment_key
      ? "/" + encodeURIComponent(o.payment_key)
      : "/find/" + encodeURIComponent(o.id);
    return this.receipt(await this.request(path), o);
  }
  async cancel(o: Row) {
    const current = await this.lookup(o);
    if (current.status === "CANCELED") return current;
    if (current.status !== "DONE") throw new Error("NICEPAY_REFUND_NOT_READY");
    await this.request(
      "/" + encodeURIComponent(current.paymentKey) + "/cancel",
      { orderId: "refund-" + o.id, reason: "연구용 테스트 결제 취소" },
    );
    // Cancel response orderId can describe the refund request; query the original payment.
    return this.lookup(o);
  }
}
