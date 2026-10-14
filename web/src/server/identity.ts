import { z } from "zod";
import { one, type Database, type Sql } from "./db";
import { hash, token, lockOwner } from "./service";
import { AppError } from "../domain/model";
export async function startIdentity(db: Database, owner: string) {
  const secret = token();
  await db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    await tx.query("DELETE FROM oauth_attempts WHERE owner_id=$1", [owner]);
    await tx.query(
      "INSERT INTO oauth_attempts(token_hash,owner_id) VALUES($1,$2)",
      [hash(secret), owner],
    );
  });
  return secret;
}
// subject comes ONLY from Supabase getUser() after a PKCE exchange, never a request body.
export async function bindIdentity(
  db: Database,
  owner: string,
  attempt: string,
  subject: string,
) {
  if (!z.uuid().safeParse(subject).success)
    throw new AppError("INVALID_IDENTITY", 401);
  return db.transaction(async (tx) => {
    // Serialize two browsers linking the same verified identity.
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      subject,
    ]);
    await lockOwner(tx, owner);
    const a = await one(
      tx,
      "UPDATE oauth_attempts SET used_at=now() WHERE token_hash=$1 AND owner_id=$2 AND used_at IS NULL AND expires_at>now() RETURNING token_hash",
      [hash(attempt), owner],
    );
    if (!a) throw new AppError("AUTH_EXPIRED", 401);
    const linked = await one(
      tx,
      "SELECT subject FROM auth_identities WHERE owner_id=$1",
      [owner],
    );
    if (linked && linked.subject !== subject)
      throw new AppError(
        "DIFFERENT_IDENTITY",
        409,
        "이미 다른 로그인에 연결된 보관함이에요. 먼저 나가기를 눌러 주세요.",
      );
    const identity = await one(
      tx,
      "SELECT i.owner_id,a.deleted_at,a.merged_into FROM auth_identities i JOIN accounts a ON a.id=i.owner_id WHERE subject=$1",
      [subject],
    );
    if (identity?.deleted_at || identity?.merged_into)
      throw new AppError("ACCOUNT_DELETED", 409, "삭제된 보관함이에요.");
    if (identity && identity.owner_id !== owner) {
      const ticket = token();
      await tx.query(
        "INSERT INTO merge_tickets(token_hash,source_id,target_id) VALUES($1,$2,$3)",
        [hash(ticket), owner, identity.owner_id],
      );
      return { ticket };
    }
    await tx.query(
      "INSERT INTO auth_identities(subject,owner_id) VALUES($1,$2) ON CONFLICT(subject) DO NOTHING",
      [subject, owner],
    );
    await tx.query("UPDATE accounts SET kind='member' WHERE id=$1", [owner]);
    return { owner };
  });
}
const birthKey = (p: any) =>
  JSON.stringify([
    p?.calendar,
    +p?.year,
    +p?.month,
    +p?.day,
    p?.calendar === "lunar" ? p?.leap : false,
    p?.timeKnown,
    p?.timeKnown ? +p?.hour : null,
    p?.timeKnown ? +p?.minute : null,
  ]);
async function birthKeys(tx: Sql, owner: string) {
  const rows = await tx.query(
    "SELECT inputs FROM comparisons WHERE owner_id=$1 AND state<>'cancelled'",
    [owner],
  );
  const draft = await one(tx, "SELECT data FROM drafts WHERE owner_id=$1", [
    owner,
  ]);
  const people = [...rows.rows.map((r) => r.inputs.me), draft?.data?.me].filter(
    (p) => p?.year && p?.month && p?.day,
  );
  return new Set(people.map(birthKey));
}
export async function finishIdentity(
  db: Database,
  source: string,
  ticket: string,
  merge: boolean,
) {
  return db.transaction(async (tx) => {
    const t = await one(
      tx,
      "SELECT * FROM merge_tickets WHERE token_hash=$1 AND source_id=$2 AND used_at IS NULL AND expires_at>now()",
      [hash(ticket), source],
    );
    if (!t) throw new AppError("AUTH_EXPIRED", 401);
    for (const id of [source, t.target_id].sort()) await lockOwner(tx, id);
    const claimed = await one(
      tx,
      "UPDATE merge_tickets SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL RETURNING target_id",
      [hash(ticket)],
    );
    if (!claimed) throw new AppError("AUTH_EXPIRED", 401);
    if (merge) {
      if (
        await one(tx, "SELECT subject FROM auth_identities WHERE owner_id=$1", [
          source,
        ])
      )
        throw new AppError("ALREADY_LINKED", 409);
      if (
        (await one(
          tx,
          "SELECT id FROM orders WHERE owner_id IN ($1,$2) AND state IN ('confirming','confirmation_unknown','refund_pending')",
          [source, t.target_id],
        )) ||
        (await one(
          tx,
          "SELECT comparison_id FROM generation_jobs WHERE owner_id IN ($1,$2) AND state IN ('queued','running')",
          [source, t.target_id],
        ))
      )
        throw new AppError(
          "MERGE_BUSY",
          409,
          "결제 확인과 이야기 생성을 먼저 마쳐 주세요.",
        );
      const keys = new Set([
        ...(await birthKeys(tx, source)),
        ...(await birthKeys(tx, t.target_id)),
      ]);
      if (keys.size > 1)
        throw new AppError(
          "BIRTH_CONFLICT",
          409,
          "내 생일 정보가 달라 합칠 수 없어요. 기존 보관함만 열 수 있어요.",
        );
      await tx.query("SET CONSTRAINTS ALL DEFERRED");
      const sourceFree = await one(
        tx,
        "SELECT * FROM free_claims WHERE owner_id=$1",
        [source],
      );
      const targetFree = await one(
        tx,
        "SELECT * FROM free_claims WHERE owner_id=$1",
        [t.target_id],
      );
      if (sourceFree?.state === "reserved" || targetFree?.state === "reserved")
        throw new AppError("MERGE_BUSY", 409);
      await tx.query("DELETE FROM free_claims WHERE owner_id=$1", [source]);
      // Rekey transferred idempotency keys to avoid cross-account collisions.
      await tx.query(
        "UPDATE comparisons SET request_key='merged:'||id::text WHERE owner_id=$1",
        [source],
      );
      for (const table of [
        "comparisons",
        "orders",
        "entitlements",
        "generation_jobs",
        "results",
        "shares",
      ])
        await tx.query(`UPDATE ${table} SET owner_id=$2 WHERE owner_id=$1`, [
          source,
          t.target_id,
        ]);
      if (sourceFree?.state === "consumed" && targetFree?.state === "available")
        await tx.query(
          "UPDATE free_claims SET state='consumed',comparison_id=$2,generation=generation+1 WHERE owner_id=$1",
          [t.target_id, sourceFree.comparison_id],
        );
      await tx.query(
        "INSERT INTO drafts(owner_id,data,revision) SELECT $2,data,revision FROM drafts WHERE owner_id=$1 ON CONFLICT(owner_id) DO NOTHING",
        [source, t.target_id],
      );
      await tx.query("DELETE FROM drafts WHERE owner_id=$1", [source]);
      await tx.query("DELETE FROM sessions WHERE owner_id=$1", [source]);
      await tx.query(
        "UPDATE accounts SET merged_into=$2,recovery_hash=NULL WHERE id=$1",
        [source, t.target_id],
      );
    }
    return t.target_id as string;
  });
}
