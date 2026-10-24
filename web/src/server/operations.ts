import { one, type Database } from "./db";
import { lockOwner, runJobs } from "./service";
import { reconcilePayment, refundPayment } from "./payments";
import { AppError } from "../domain/model";
import { servicePolicy } from "./service-policy";
// Local alarm starting point, not a production SLO or queue residence time.
export const queuedComparisonAlertSeconds = 300;
export async function eraseReading(db: Database, owner: string, id: string) {
  return db.transaction(async tx => {
    // Same lock order as payment, merge and workers. No PG request is made here.
    await lockOwner(tx, owner);
    const comparison = await one(tx, "SELECT inputs FROM comparisons WHERE owner_id=$1 AND id=$2 FOR UPDATE", [owner, id]);
    if (!comparison) throw new AppError("NOT_FOUND", 404, "이야기를 찾을 수 없어요.");
    if (await one(tx, "SELECT id FROM orders WHERE owner_id=$1 AND comparison_id=$2 AND state IN ('confirming','confirmation_unknown','refund_pending')", [owner, id]))
      throw new AppError("PAYMENT_UNRESOLVED", 409, "결제·취소를 확인 중이에요. 결제 내역에서 확인을 마친 뒤 지워 주세요.");
    if (!comparison.inputs.me) return;
    const pair = comparison.inputs;
    await tx.query("DELETE FROM shares WHERE owner_id=$1 AND comparison_id=$2", [owner, id]);
    await tx.query("UPDATE generation_jobs SET state='cancelled',fence=fence+1,lease_until=NULL,error_code=NULL WHERE owner_id=$1 AND comparison_id=$2", [owner, id]);
    // A consumed free story stays consumed. A not-yet-delivered reservation is
    // released exactly once; a stale worker cannot finish after the fence changes.
    await tx.query("UPDATE free_claims SET state='available',comparison_id=NULL,generation=generation+1 WHERE owner_id=$1 AND comparison_id=$2 AND state='reserved'", [owner, id]);
    await tx.query("UPDATE entitlements SET state='revoked' WHERE owner_id=$1 AND comparison_id=$2", [owner, id]);
    await tx.query("DELETE FROM results WHERE owner_id=$1 AND comparison_id=$2", [owner, id]);
    await tx.query("DELETE FROM nicepay_attempts WHERE order_id IN (SELECT id FROM orders WHERE owner_id=$1 AND comparison_id=$2)", [owner, id]);
    await tx.query("UPDATE orders SET state='cancelled' WHERE owner_id=$1 AND comparison_id=$2 AND state='created'", [owner, id]);
    await tx.query("UPDATE drafts SET data='{}'::jsonb,revision=revision+1 WHERE owner_id=$1 AND data->'me'->>'id'=$2 AND data->'other'->>'id'=$3", [owner, pair.me.id, pair.other.id]);
    // Keep an idempotency/financial tombstone, without birth data or fingerprints.
    await tx.query("UPDATE comparisons SET inputs='{}'::jsonb,charts='{}'::jsonb,input_hash='',state='cancelled' WHERE owner_id=$1 AND id=$2", [owner, id]);
    await tx.query("INSERT INTO operational_events(kind,outcome) VALUES('reading_erasure','completed')");
  });
}
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
      "UPDATE generation_jobs SET state='cancelled',fence=fence+1,lease_until=NULL,error_code=NULL WHERE owner_id=$1",
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
    await tx.query('UPDATE auth_identities SET display_name=NULL,avatar_url=NULL WHERE owner_id=$1',[owner]);
    // Commit the external withdrawal request atomically with local erasure.
    // Linked accounts only: an anonymous guest must never trigger provider APIs.
    await tx.query(`INSERT INTO withdrawal_requests(owner_id,subject)
      SELECT owner_id,subject FROM auth_identities WHERE owner_id=$1
      ON CONFLICT(owner_id) DO NOTHING`, [owner]);
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
    const drafts = await tx.query(
      `UPDATE drafts SET data='{}'::jsonb,revision=revision+1
       WHERE updated_at<=now()-interval '${servicePolicy.draftDays} days' AND data<>'{}'::jsonb RETURNING owner_id`,
    );
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
      `DELETE FROM operational_events WHERE created_at<now()-interval '${servicePolicy.operationalLogDays} days'`,
    );
    await tx.query("DELETE FROM rate_limits WHERE resets_at<now()");
    return { sessions: sessions.rows.length, shares: shares.rows.length, drafts: drafts.rows.length };
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
  await db.query("INSERT INTO operational_events(kind,outcome) VALUES('retention','completed')");
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
  const jobs = await runJobs(db);
  const expired = await expireData(db);
  const status = await health(db);
  await db.query(
    "INSERT INTO operational_events(kind,outcome) VALUES('maintenance',$1)",
    [
      status.status === "needs_attention" || unresolved
        ? "needs_attention"
        : "completed",
    ],
  );
  return { recovered, unresolved, expired, jobs, health: status };
}
export async function health(db: Database) {
  // One statement gives all counters the same database snapshot. Never select payloads or IDs.
  const row = (await one(
    db,
    `WITH jobs AS (
      SELECT count(*) FILTER (WHERE j.state='queued')::int AS queued,
        count(*) FILTER (WHERE j.state='queued' AND c.created_at<=now()-make_interval(secs => $1))::int AS delayed_queued,
        coalesce(greatest(0,floor(max(extract(epoch FROM now()-c.created_at)) FILTER (WHERE j.state='queued'))),0)::float8 AS oldest_queued_comparison_seconds,
        count(*) FILTER (WHERE j.state='running')::int AS running,
        count(*) FILTER (WHERE j.state='failed')::int AS failed,
        count(*) FILTER (WHERE j.state='running' AND (lease_until IS NULL OR lease_until<now()))::int AS expired_leases,
        coalesce(floor(max(extract(epoch FROM now()-lease_until)) FILTER (WHERE j.state='running' AND lease_until<now())),0)::float8 AS oldest_expired_lease_seconds
      FROM generation_jobs j JOIN comparisons c ON c.id=j.comparison_id AND c.owner_id=j.owner_id
    ), pending AS (
      SELECT o.*,(SELECT min(a.created_at) FROM payment_attempts a
        WHERE a.order_id=o.id AND a.state='requested' AND a.operation=
        CASE WHEN o.state='refund_pending' THEN 'refund' ELSE 'confirm' END) AS pending_since
      FROM orders o WHERE o.state IN ('confirming','confirmation_unknown','refund_pending')
    ), payments AS (
      SELECT count(*) FILTER (WHERE state='confirming')::int AS confirming,
        count(*) FILTER (WHERE state='confirmation_unknown')::int AS confirmation_unknown,
        count(*) FILTER (WHERE state='refund_pending')::int AS refund_pending,
        coalesce(greatest(0,floor(max(extract(epoch FROM now()-created_at)))),0)::float8 AS oldest_pending_order_seconds,
        count(*) FILTER (WHERE pending_since<=now()-interval '${servicePolicy.pendingPaymentMinutes} minutes')::int AS overdue_pending,
        count(*) FILTER (WHERE pending_since IS NULL)::int AS unknown_pending_age
      FROM pending
    ), withdrawals AS (
      SELECT count(*) FILTER(WHERE state<>'completed')::int AS withdrawal_pending,
        count(*) FILTER(WHERE state IN ('blocked','unknown') OR (state='running' AND lease_until<now())
          OR (state<>'completed' AND requested_at<=now()-interval '24 hours'))::int AS withdrawal_review
      FROM withdrawal_requests
    ) SELECT * FROM jobs CROSS JOIN payments CROSS JOIN withdrawals`,
    [queuedComparisonAlertSeconds],
  ))!;
  const jobs = {
    queued: row.queued as number,
    delayedQueued: row.delayed_queued as number,
    oldestQueuedComparisonSeconds: row.oldest_queued_comparison_seconds as number,
    running: row.running as number,
    failed: row.failed as number,
    expiredLeases: row.expired_leases as number,
    oldestExpiredLeaseSeconds: row.oldest_expired_lease_seconds as number,
  };
  const payments = {
    confirming: row.confirming as number,
    confirmationUnknown: row.confirmation_unknown as number,
    refundPending: row.refund_pending as number,
    // This is order age, not time spent in its current payment state.
    oldestPendingOrderSeconds: row.oldest_pending_order_seconds as number,
    overduePending: row.overdue_pending as number,
    unknownPendingAge: row.unknown_pending_age as number,
  };
  const reasons: string[] = [];
  const withdrawals = { pending: row.withdrawal_pending as number, reviewRequired: row.withdrawal_review as number };
  if (jobs.failed) reasons.push("FAILED_JOBS");
  if (jobs.expiredLeases) reasons.push("EXPIRED_LEASES");
  if (jobs.delayedQueued) reasons.push("DELAYED_QUEUE");
  if (
    payments.confirming ||
    payments.confirmationUnknown ||
    payments.refundPending
  )
    reasons.push("PENDING_PAYMENTS");
  if (withdrawals.reviewRequired) reasons.push("WITHDRAWAL_REVIEW_REQUIRED");
  return {
    mode: "research" as const,
    status: reasons.length ? ("needs_attention" as const) : ("ok" as const),
    reasons,
    jobs,
    payments,
    withdrawals,
  };
}
