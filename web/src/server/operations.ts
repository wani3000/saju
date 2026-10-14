import { one, type Database } from "./db";
import { runJobs } from "./service";
import { reconcilePayment, refundPayment } from "./payments";
import { AppError } from "../domain/model";
export async function erasePersonalData(
  db: Database,
  owner: string,
  onlyExpiredGuest = false,
) {
  return db.transaction(async (tx) => {
    const account = await one(
      tx,
      "SELECT * FROM accounts WHERE id=$1 FOR UPDATE",
      [owner],
    );
    if (!account || account.deleted_at || account.merged_into) {
      if (onlyExpiredGuest) return false;
      throw new AppError("UNAUTHORIZED", 401);
    }
    if (
      onlyExpiredGuest &&
      !(await one(
        tx,
        `SELECT a.id FROM accounts a WHERE a.id=$1 AND a.kind='guest' AND a.created_at<now()-interval '30 days'
    AND NOT EXISTS(SELECT 1 FROM auth_identities i WHERE i.owner_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.owner_id=a.id AND s.expires_at>now())
    AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.owner_id=a.id)
    AND NOT EXISTS(SELECT 1 FROM drafts d WHERE d.owner_id=a.id AND d.updated_at>now()-interval '30 days')`,
        [owner],
      ))
    )
      return false;
    if (
      await one(
        tx,
        "SELECT id FROM orders WHERE owner_id=$1 AND state IN ('confirming','confirmation_unknown','refund_pending')",
        [owner],
      )
    )
      throw new AppError(
        "PAYMENT_UNRESOLVED",
        409,
        "확인 중인 결제·취소가 있어요. 이용 내역에서 상태를 먼저 확인해 주세요.",
      );
    await tx.query("DELETE FROM shares WHERE owner_id=$1", [owner]);
    await tx.query(
      "UPDATE generation_jobs SET state='cancelled',fence=fence+1 WHERE owner_id=$1",
      [owner],
    );
    await tx.query(
      "UPDATE entitlements SET state='revoked' WHERE owner_id=$1",
      [owner],
    );
    await tx.query("DELETE FROM results WHERE owner_id=$1", [owner]);
    await tx.query(
      "UPDATE comparisons SET inputs='{}',charts='{}',input_hash='',state='cancelled' WHERE owner_id=$1",
      [owner],
    );
    await tx.query(
      "UPDATE orders SET state='cancelled' WHERE owner_id=$1 AND state='created'",
      [owner],
    );
    for (const table of ["drafts", "sessions", "oauth_attempts"])
      await tx.query(`DELETE FROM ${table} WHERE owner_id=$1`, [owner]);
    await tx.query(
      "DELETE FROM nicepay_attempts WHERE order_id IN (SELECT id FROM orders WHERE owner_id=$1)",
      [owner],
    );
    await tx.query(
      "DELETE FROM merge_tickets WHERE source_id=$1 OR target_id=$1",
      [owner],
    );
    await tx.query(
      "UPDATE accounts SET recovery_hash=NULL,deleted_at=now() WHERE id=$1",
      [owner],
    );
    // Payment/consent/free-use records and auth subject tombstone survive erasure.
    // The latter prevents a deleted account from silently receiving a new free grant.
    await tx.query(
      "INSERT INTO operational_events(kind,outcome) VALUES('erasure','completed')",
    );
    return true;
  });
}
export async function expireData(db: Database) {
  const counts = await db.transaction(async (tx) => {
    const sessions = await tx.query(
      "DELETE FROM sessions WHERE expires_at<now() RETURNING token_hash",
    );
    const shares = await tx.query(
      "DELETE FROM shares WHERE expires_at<now() OR revoked_at IS NOT NULL RETURNING id",
    );
    await tx.query(
      "DELETE FROM oauth_attempts WHERE expires_at<now() OR used_at IS NOT NULL",
    );
    await tx.query(
      "DELETE FROM merge_tickets WHERE expires_at<now() OR used_at IS NOT NULL",
    );
    await tx.query("DELETE FROM nicepay_attempts WHERE expires_at<now()");
    await tx.query(
      "DELETE FROM operational_events WHERE created_at<now()-interval '30 days'",
    );
    await tx.query("DELETE FROM rate_limits WHERE resets_at<now()");
    return { sessions: sessions.rows.length, shares: shares.rows.length };
  });
  // Only inactive, unlinked guests older than 30 days. Members and pending money are untouched.
  const guests =
    await db.query(`SELECT a.id FROM accounts a WHERE a.kind='guest' AND a.deleted_at IS NULL AND a.merged_into IS NULL AND a.created_at<now()-interval '30 days'
 AND NOT EXISTS(SELECT 1 FROM auth_identities i WHERE i.owner_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM sessions s WHERE s.owner_id=a.id AND s.expires_at>now())
 AND NOT EXISTS(SELECT 1 FROM orders o WHERE o.owner_id=a.id)
 AND NOT EXISTS(SELECT 1 FROM drafts d WHERE d.owner_id=a.id AND d.updated_at>now()-interval '30 days')`);
  let erased = 0;
  for (const g of guests.rows)
    if (await erasePersonalData(db, g.id, true)) erased++;
  return { ...counts, guests: erased };
}
export async function maintenance(db: Database) {
  const pending = await db.query(
    "SELECT id,owner_id,state FROM orders WHERE state IN ('confirming','confirmation_unknown','refund_pending') ORDER BY created_at LIMIT 100",
  );
  let recovered = 0,
    unresolved = 0;
  for (const o of pending.rows) {
    try {
      if (o.state === "refund_pending")
        await refundPayment(db, o.owner_id, o.id);
      else await reconcilePayment(db, o.owner_id, o.id);
      recovered++;
    } catch {
      unresolved++;
    }
  }
  await runJobs(db);
  const expired = await expireData(db);
  await db.query(
    "INSERT INTO operational_events(kind,outcome) VALUES('maintenance',$1)",
    [unresolved ? "needs_attention" : "completed"],
  );
  return { recovered, unresolved, expired };
}
export async function health(db: Database) {
  const row = await one(
    db,
    `SELECT (SELECT count(*)::int FROM generation_jobs WHERE state IN ('queued','running','failed')) AS jobs,
 (SELECT count(*)::int FROM orders WHERE state IN ('confirming','confirmation_unknown','refund_pending')) AS payments`,
  );
  return { mode: "research", jobs: row!.jobs, payments: row!.payments };
}
