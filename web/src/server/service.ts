import { currentReadingVersion, readingForVersion } from "./readings";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import {
  AppError,
  draftSchema,
  publicCard,
  type SavedResult,
} from "../domain/model";
import { engineVersion, validatePair } from "./engine";
import { one, type Database, type Sql } from "./db";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("base64url");
export async function lockOwner(tx: Sql, owner: string) {
  if (
    !(await one(
      tx,
      "SELECT id FROM accounts WHERE id=$1 AND deleted_at IS NULL AND merged_into IS NULL FOR UPDATE",
      [owner],
    ))
  )
    throw new AppError("UNAUTHORIZED", 401, "다시 시작해 주세요.");
}
export async function newSession(db: Database, owner?: string, authSubject?: string) {
  const secret = token();
  return db.transaction(async (tx) => {
    const id = owner ?? randomUUID();
    if (!owner) {
      await tx.query("INSERT INTO accounts(id) VALUES($1)", [id]);
      await tx.query("INSERT INTO free_claims(owner_id) VALUES($1)", [id]);
    }
    if (owner) await lockOwner(tx, owner);
    if(authSubject&&(!owner||!(await one(tx,'SELECT subject FROM auth_identities WHERE subject=$1 AND owner_id=$2',[authSubject,owner]))))throw new AppError('INVALID_IDENTITY',401);
    await tx.query("INSERT INTO sessions(token_hash,owner_id,auth_subject) VALUES($1,$2,$3)", [
      hash(secret),
      id,
      authSubject??null,
    ]);
    return { owner: id, secret };
  });
}
export async function sessionOwner(db: Sql, secret: string | undefined) {
  if (!secret || !/^[\w-]{43}$/.test(secret)) return undefined;
  return (
    await one(
      db,
      "SELECT s.owner_id FROM sessions s JOIN accounts a ON a.id=s.owner_id WHERE s.token_hash=$1 AND s.expires_at>now() AND a.deleted_at IS NULL AND a.merged_into IS NULL",
      [hash(secret)],
    )
  )?.owner_id as string | undefined;
}
export async function rateLimit(db: Sql, bucket: string, limit = 120) {
  const r = await one(
    db,
    `INSERT INTO rate_limits(bucket,count,resets_at) VALUES($1,1,now()+interval '1 minute')
 ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN rate_limits.resets_at<now() THEN 1 ELSE rate_limits.count+1 END,
 resets_at=CASE WHEN rate_limits.resets_at<now() THEN now()+interval '1 minute' ELSE rate_limits.resets_at END RETURNING count`,
    [bucket],
  );
  if (r!.count > limit)
    throw new AppError(
      "RATE_LIMITED",
      429,
      "잠시 쉬었다가 다시 시도해 주세요.",
    );
}
export async function saveDraft(
  db: Database,
  owner: string,
  input: unknown,
  revision: number,
) {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success || !Number.isInteger(revision) || revision < 0)
    throw new AppError("INVALID_DRAFT");
  return db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const old = await one(tx, "SELECT revision FROM drafts WHERE owner_id=$1", [
      owner,
    ]);
    if ((old?.revision ?? 0) !== revision)
      throw new AppError(
        "DRAFT_CONFLICT",
        409,
        "다른 창에서 입력을 바꿨어요. 새로고침해 최신 내용을 확인해 주세요.",
      );
    const r = await one(
      tx,
      `INSERT INTO drafts(owner_id,data) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET data=$2,revision=drafts.revision+1,updated_at=now() RETURNING revision`,
      [owner, JSON.stringify(parsed.data)],
    );
    return r;
  });
}
export async function recoveryCode(db: Database, owner: string) {
  const secret = token();
  await db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    await tx.query(
      "UPDATE accounts SET kind='member',recovery_hash=$2 WHERE id=$1",
      [owner, hash(secret)],
    );
  });
  return secret;
}
export async function recover(db: Database, secret: string) {
  if (!/^[\w-]{43}$/.test(secret))
    throw new AppError("INVALID_RECOVERY", 401, "복구 코드를 확인해 주세요.");
  const account = await one(
    db,
    "SELECT id FROM accounts WHERE recovery_hash=$1 AND deleted_at IS NULL AND merged_into IS NULL",
    [hash(secret)],
  );
  if (!account)
    throw new AppError("INVALID_RECOVERY", 401, "복구 코드를 확인해 주세요.");
  // Switch accounts only. Never silently combine maps, free histories or conflicting births.
  return newSession(db, account.id);
}
export async function createComparison(
  db: Database,
  owner: string,
  input: unknown,
  key: string,
  consent: boolean,
  provider = "mock",
) {
  if (!z.uuid().safeParse(key).success || consent !== true)
    throw new AppError(
      "CONSENT_REQUIRED",
      422,
      "연구용 계산과 입력 정보 저장 안내에 동의해 주세요.",
    );
  if (!["mock", "toss-test", "nicepay-test"].includes(provider))
    throw new AppError("LIVE_DISABLED", 503);
  const { pair, charts } = validatePair(input);
  const fingerprint = (input: typeof pair, profiles: typeof charts) =>
    hash(
      JSON.stringify({
        engineVersion,
        ruleVersion: currentReadingVersion,
        people: (["me", "other"] as const).map((k) => ({
          id: input[k].id,
          solar: [
            profiles[k].solar.year,
            profiles[k].solar.month,
            profiles[k].solar.day,
          ],
          timeKnown: input[k].timeKnown,
          hour: input[k].timeKnown ? +input[k].hour : null,
          minute: input[k].timeKnown ? +input[k].minute : null,
        })),
      }),
    );
  const inputHash = fingerprint(pair, charts);
  return db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const existing = await one(
      tx,
      "SELECT * FROM comparisons WHERE owner_id=$1 AND request_key=$2",
      [owner, key],
    );
    if (existing) {
      if (fingerprint(existing.inputs, existing.charts) !== inputHash)
        throw new AppError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "이미 처리한 요청이에요. 새 요청으로 진행해 주세요.",
        );
      return { id: existing.id };
    }
    const candidates = await tx.query(
      "SELECT * FROM comparisons WHERE owner_id=$1 AND inputs->'me'->>'id'=$2 AND inputs->'other'->>'id'=$3 AND state<>'cancelled' ORDER BY created_at DESC",
      [owner, pair.me.id, pair.other.id],
    );
    const same = candidates.rows.find(
      (c) => fingerprint(c.inputs, c.charts) === inputHash,
    );
    if (same) return { id: same.id };
    const claim = (await one(
      tx,
      "SELECT * FROM free_claims WHERE owner_id=$1",
      [owner],
    ))!;
    if (claim.state === "reserved")
      throw new AppError(
        "FREE_IN_PROGRESS",
        409,
        "첫 결과를 준비 중이에요. 먼저 진행 중인 결과를 확인해 주세요.",
      );
    const free = claim.state === "available";
    const id = randomUUID();
    if (
      !free &&
      (await one(tx, "SELECT kind FROM accounts WHERE id=$1", [owner]))
        ?.kind !== "member"
    )
      throw new AppError(
        "ACCOUNT_REQUIRED",
        409,
        "추가 결과를 복원할 수 있도록 보관용 복구 코드를 먼저 만들어 주세요.",
      );
    await tx.query(
      "INSERT INTO comparisons(id,owner_id,request_key,input_hash,inputs,charts,state,engine_version,rule_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        id,
        owner,
        key,
        inputHash,
        JSON.stringify(pair),
        JSON.stringify(charts),
        free ? "queued" : "awaiting_payment",
        engineVersion,
        currentReadingVersion,
      ],
    );
    await tx.query(
      "INSERT INTO consent_records(comparison_id,version) VALUES($1,'research-local-v1')",
      [id],
    );
    if (free) {
      await tx.query(
        "UPDATE free_claims SET state='reserved',comparison_id=$2,generation=generation+1 WHERE owner_id=$1",
        [owner, id],
      );
      await tx.query(
        "INSERT INTO generation_jobs(comparison_id,owner_id,state,free_generation) VALUES($1,$2,'queued',$3)",
        [id, owner, claim.generation + 1],
      );
    } else
      await tx.query(
        "INSERT INTO orders(id,owner_id,comparison_id,provider) VALUES($1,$2,$3,$4)",
        [randomUUID(), owner, id, provider],
      );
    return { id };
  });
}
export async function state(db: Sql, owner: string) {
  const account = await one(db, "SELECT kind FROM accounts WHERE id=$1", [
    owner,
  ]);
  const draft = await one(
    db,
    "SELECT data,revision FROM drafts WHERE owner_id=$1",
    [owner],
  );
  const claim = await one(
    db,
    "SELECT state FROM free_claims WHERE owner_id=$1",
    [owner],
  );
  const results = await db.query(
    "SELECT r.snapshot FROM results r JOIN entitlements e USING(comparison_id,owner_id) WHERE r.owner_id=$1 AND e.state='active' ORDER BY r.created_at",
    [owner],
  );
  const pending = await db.query(
    "SELECT c.id,c.state,o.id AS order_id,o.state AS order_state,o.amount,o.provider FROM comparisons c LEFT JOIN orders o ON o.comparison_id=c.id AND o.owner_id=c.owner_id WHERE c.owner_id=$1 AND c.state NOT IN ('ready','cancelled') ORDER BY c.created_at DESC",
    [owner],
  );
  const shares = await db.query(
    "SELECT id,comparison_id,expires_at,revoked_at FROM shares WHERE owner_id=$1 ORDER BY expires_at DESC",
    [owner],
  );
  const orders = await db.query(
    "SELECT o.id,o.comparison_id,o.amount,o.state,o.provider,o.created_at,c.inputs->'other'->>'name' AS other_name FROM orders o JOIN comparisons c ON c.id=o.comparison_id AND c.owner_id=o.owner_id WHERE o.owner_id=$1 ORDER BY o.created_at DESC",
    [owner],
  );
  const identity=await one(db,'SELECT display_name,avatar_url FROM auth_identities WHERE owner_id=$1',[owner]);
  const readingHistory=await db.query(`SELECT c.id,c.state,c.created_at,c.inputs->'other'->>'name' AS other_name,c.inputs->'other'->>'relation' AS relation,
   e.state AS entitlement_state,(e.state='active' AND r.comparison_id IS NOT NULL) IS TRUE AS can_open
   FROM comparisons c LEFT JOIN entitlements e ON e.comparison_id=c.id AND e.owner_id=c.owner_id
   LEFT JOIN results r ON r.comparison_id=c.id AND r.owner_id=c.owner_id WHERE c.owner_id=$1 ORDER BY c.created_at DESC`,[owner]);
  return {
    kind: account?.kind,
    authLinked: Boolean(
      await one(db, "SELECT subject FROM auth_identities WHERE owner_id=$1", [
        owner,
      ]),
    ),
    draft: draft?.data ?? null,
    revision: draft?.revision ?? 0,
    free: claim?.state,
    results: results.rows.map((r) => r.snapshot as SavedResult),
    pending: pending.rows,
    shares: shares.rows,
    orders: orders.rows,
    profile:identity?{displayName:identity.display_name,avatarUrl:identity.avatar_url}:null,
    readingHistory:readingHistory.rows,
  };
}
export async function result(db: Sql, owner: string, id: string) {
  const row = await one(
    db,
    "SELECT r.snapshot FROM results r JOIN entitlements e USING(comparison_id,owner_id) WHERE r.owner_id=$1 AND r.comparison_id=$2 AND e.state='active'",
    [owner, id],
  );
  if (!row) throw new AppError("NOT_FOUND", 404, "결과를 찾을 수 없어요.");
  return row.snapshot as SavedResult;
}
export async function share(
  db: Database,
  owner: string,
  id: string,
  aliases: unknown,
) {
  const names = z
    .tuple([z.string().trim().min(1).max(10), z.string().trim().min(1).max(10)])
    .safeParse(aliases);
  if (!names.success) throw new AppError("INVALID_ALIAS");
  const secret = token();
  const shareId = randomUUID();
  await db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const saved = await result(tx, owner, id);
    await tx.query(
      "INSERT INTO shares(id,owner_id,comparison_id,token_hash,snapshot) VALUES($1,$2,$3,$4,$5)",
      [
        shareId,
        owner,
        id,
        hash(secret),
        JSON.stringify(publicCard(names.data, saved.reading)),
      ],
    );
  });
  return { id: shareId, path: `/s/${secret}` };
}
export async function revokeShare(db: Sql, owner: string, id: string) {
  const r = await one(
    db,
    "UPDATE shares SET revoked_at=coalesce(revoked_at,now()) WHERE id=$1 AND owner_id=$2 RETURNING id",
    [id, owner],
  );
  if (!r) throw new AppError("NOT_FOUND", 404);
}
export async function publicShare(db: Sql, secret: string) {
  if (!/^[\w-]{43}$/.test(secret)) return null;
  const r = await one(
    db,
    "SELECT s.snapshot FROM shares s JOIN entitlements e USING(comparison_id,owner_id) WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND e.state='active'",
    [hash(secret)],
  );
  return r?.snapshot ?? null;
}
export async function retryJob(db: Database, owner: string, id: string) {
  return db.transaction(async (tx) => {
    await lockOwner(tx, owner);
    const c = await one(
      tx,
      "SELECT * FROM comparisons WHERE owner_id=$1 AND id=$2",
      [owner, id],
    );
    if (!c) throw new AppError("NOT_FOUND", 404);
    if (c.state !== "failed") return;
    const job = (await one(
      tx,
      "SELECT * FROM generation_jobs WHERE comparison_id=$1",
      [id],
    ))!;
    if (job.free_generation !== null) {
      const claim = (await one(
        tx,
        "SELECT * FROM free_claims WHERE owner_id=$1",
        [owner],
      ))!;
      if (claim.state !== "available")
        throw new AppError(
          "FREE_UNAVAILABLE",
          409,
          "다른 무료 요청을 확인해 주세요.",
        );
      await tx.query(
        "UPDATE free_claims SET state='reserved',comparison_id=$2,generation=generation+1 WHERE owner_id=$1",
        [owner, id],
      );
      await tx.query(
        "UPDATE generation_jobs SET free_generation=$2 WHERE comparison_id=$1",
        [id, claim.generation + 1],
      );
    } else if (
      !(await one(
        tx,
        "SELECT comparison_id FROM entitlements WHERE owner_id=$1 AND comparison_id=$2 AND state='active'",
        [owner, id],
      ))
    )
      throw new AppError("NO_ENTITLEMENT", 409);
    await tx.query(
      "UPDATE generation_jobs SET state='queued',attempts=0,fence=fence+1,error_code=NULL WHERE comparison_id=$1",
      [id],
    );
    await tx.query("UPDATE comparisons SET state='queued' WHERE id=$1", [id]);
  });
}
async function failJob(tx: Sql, job: Record<string, any>, code: string) {
  const terminal = job.attempts >= 3;
  await tx.query(
    "UPDATE generation_jobs SET state=$2,error_code=$3,fence=fence+1,lease_until=NULL WHERE comparison_id=$1",
    [job.comparison_id, terminal ? "failed" : "queued", code],
  );
  await tx.query("UPDATE comparisons SET state=$2 WHERE id=$1", [
    job.comparison_id,
    terminal ? "failed" : "queued",
  ]);
  if (terminal && job.free_generation !== null)
    await tx.query(
      "UPDATE free_claims SET state='available',comparison_id=NULL,generation=generation+1 WHERE owner_id=$1 AND state='reserved' AND comparison_id=$2 AND generation=$3",
      [job.owner_id, job.comparison_id, job.free_generation],
    );
}
export async function claimJob(db: Database, owner?: string) {
  // Bound cleanup work per call; another batch can continue after many exhausted leases.
  for (let checked = 0; checked < 32; checked++) {
    const claimed = await db.transaction(async (tx) => {
      // All mutations take account before job locks, including refund, merge and erasure.
      const account = await one(
        tx,
        `SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.merged_into IS NULL
        ${owner ? "AND a.id=$1" : ""} AND EXISTS(SELECT 1 FROM generation_jobs j WHERE j.owner_id=a.id AND (j.state='queued' OR (j.state='running' AND j.lease_until<now())))
        ORDER BY a.id LIMIT 1 FOR UPDATE OF a SKIP LOCKED`,
        owner ? [owner] : [],
      );
      if (!account) return null;
      const job = await one(
        tx,
        "SELECT * FROM generation_jobs WHERE owner_id=$1 AND (state='queued' OR (state='running' AND lease_until<now())) ORDER BY comparison_id LIMIT 1 FOR UPDATE SKIP LOCKED",
        [account.id],
      );
      if (!job) return null;
      if (job.attempts >= 3) {
        await failJob(tx, job, "LEASE_EXHAUSTED");
        return { exhausted: true } as const;
      }
      const current = await one(
        tx,
        "UPDATE generation_jobs SET state='running',attempts=attempts+1,fence=fence+1,lease_until=now()+interval '1 minute' WHERE comparison_id=$1 RETURNING *",
        [job.comparison_id],
      );
      await tx.query("UPDATE comparisons SET state='processing' WHERE id=$1", [
        job.comparison_id,
      ]);
      return { job: current! };
    });
    if (!claimed) return null;
    if ("job" in claimed) return claimed.job;
  }
  return null;
}
export async function finishJob(
  db: Database,
  job: Record<string, any>,
  fail = false,
) {
  return db.transaction(async (tx) => {
    await lockOwner(tx, job.owner_id);
    const live = await one(
      tx,
      "SELECT * FROM generation_jobs WHERE comparison_id=$1 FOR UPDATE",
      [job.comparison_id],
    );
    if (!live || live.fence !== job.fence || live.state !== "running")
      return false;
    if (new Date(live.lease_until).getTime() <= Date.now()) return false;
    const free = live.free_generation !== null;
    const claim = await one(tx, "SELECT * FROM free_claims WHERE owner_id=$1", [
      job.owner_id,
    ]);
    const valid = free
      ? claim?.state === "reserved" &&
        claim.comparison_id === job.comparison_id &&
        claim.generation === live.free_generation
      : !!(await one(
          tx,
          "SELECT comparison_id FROM entitlements WHERE comparison_id=$1 AND state='active'",
          [job.comparison_id],
        ));
    if (!valid) {
      await tx.query(
        "UPDATE generation_jobs SET state='cancelled',fence=fence+1 WHERE comparison_id=$1",
        [job.comparison_id],
      );
      return false;
    }
    if (fail) {
      await failJob(tx, live, "GENERATION_FAILED");
      return false;
    }
    const c = (await one(tx, "SELECT * FROM comparisons WHERE id=$1", [
      job.comparison_id,
    ]))!;
    const snapshot: SavedResult = {
      id: c.id,
      ...c.inputs,
      charts: c.charts,
      reading: readingForVersion(c.rule_version, { charts: c.charts, relation: c.inputs.other.relation }),
      createdAt: new Date().toISOString(),
    };
    await tx.query(
      "INSERT INTO results(comparison_id,owner_id,snapshot) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
      [c.id, c.owner_id, JSON.stringify(snapshot)],
    );
    if (free) {
      await tx.query(
        "INSERT INTO entitlements(comparison_id,owner_id,source,state) VALUES($1,$2,'free','active') ON CONFLICT DO NOTHING",
        [c.id, c.owner_id],
      );
      await tx.query(
        "UPDATE free_claims SET state='consumed' WHERE owner_id=$1",
        [c.owner_id],
      );
    }
    await tx.query(
      "UPDATE generation_jobs SET state='done' WHERE comparison_id=$1",
      [c.id],
    );
    await tx.query("UPDATE comparisons SET state='ready' WHERE id=$1", [c.id]);
    return true;
  });
}
export async function runJobs(
  db: Database,
  owner?: string,
  execute = (job: Record<string, any>) => finishJob(db, job),
) {
  const report = { completed: 0, retriedOrFailed: 0, skipped: 0 };
  for (let i = 0; i < 8; i++) {
    const job = await claimJob(db, owner);
    if (!job) break;
    try {
      if (await execute(job)) report.completed++;
      else report.skipped++;
    } catch (error) {
      if (error instanceof AppError && error.code === "UNAUTHORIZED") {
        report.skipped++;
        continue;
      }
      // Persist a bounded retry without logging payloads or original exception messages.
      // If the database itself is unavailable this throws; the lease remains recoverable.
      try {
        await finishJob(db, job, true);
        report.retriedOrFailed++;
      } catch (recoveryError) {
        if (
          recoveryError instanceof AppError &&
          recoveryError.code === "UNAUTHORIZED"
        )
          report.skipped++;
        else throw recoveryError;
      }
    }
  }
  return report;
}
