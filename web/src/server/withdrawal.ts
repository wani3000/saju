import { one, type Database } from './db';

// This queue contains identifiers only. Birth data, provider credentials and raw
// provider errors must never be copied into the ledger or operational output.
export type WithdrawalStage = 'lookup' | 'kakao_unlink' | 'supabase_delete';
export type WithdrawalFailure = 'PROVIDER_REJECTED' | 'RESPONSE_UNCERTAIN' | 'IDENTITY_UNAVAILABLE';
export class WithdrawalProviderError extends Error {
  constructor(readonly reason: WithdrawalFailure) { super(reason); }
}
export interface WithdrawalProvider {
  lookupKakaoId(subject: string): Promise<string>;
  unlinkKakao(id: string): Promise<void>;
  deleteSupabase(subject: string): Promise<void>;
}

/** Run at most one recorded stage. No caller-supplied subject/provider ID is used.
 * A timed-out/crashed mutation is never retried automatically. An operator must
 * reconcile the provider before clearing an unknown state. */
export async function processWithdrawal(db: Database, owner: string, provider?: WithdrawalProvider) {
  const claimed = await db.transaction(async tx => {
    const row = await one(tx, `SELECT w.*,a.deleted_at FROM withdrawal_requests w
      JOIN accounts a ON a.id=w.owner_id WHERE w.owner_id=$1 FOR UPDATE OF w`, [owner]);
    if (!row || !row.deleted_at) return undefined;
    if (row.state === 'running') {
      await tx.query(`UPDATE withdrawal_requests SET state='unknown',lease_until=NULL,reason='RESPONSE_UNCERTAIN',updated_at=now()
        WHERE owner_id=$1 AND lease_until<now()`, [owner]);
      return undefined;
    }
    if (!['pending','blocked'].includes(row.state)) return undefined;
    if (!provider) {
      await tx.query(`UPDATE withdrawal_requests SET state='blocked',reason='CONFIGURATION_REQUIRED',updated_at=now() WHERE owner_id=$1`, [owner]);
      return undefined;
    }
    // Non-configuration failures need explicit review, rather than periodic retry.
    if (row.state === 'blocked' && row.reason !== 'CONFIGURATION_REQUIRED') return undefined;
    return one(tx, `UPDATE withdrawal_requests SET state='running',reason=NULL,fence=fence+1,
      lease_until=now()+interval '2 minutes',updated_at=now() WHERE owner_id=$1 RETURNING *`, [owner]);
  });
  if (!claimed) return { advanced: false };
  const stage = claimed.stage as WithdrawalStage;
  let kakaoId: string | undefined;
  try {
    if (stage === 'lookup') {
      kakaoId = await provider!.lookupKakaoId(claimed.subject);
      if (!/^[0-9]{1,30}$/.test(kakaoId)) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
    } else if (stage === 'kakao_unlink') {
      if (!claimed.kakao_id) throw new WithdrawalProviderError('IDENTITY_UNAVAILABLE');
      await provider!.unlinkKakao(claimed.kakao_id);
    } else await provider!.deleteSupabase(claimed.subject);
    const next = stage === 'lookup' ? 'kakao_unlink' : stage === 'kakao_unlink' ? 'supabase_delete' : 'complete';
    // Late workers cannot overwrite an operator reconciliation or a newer lease.
    const updated = await one(db, `UPDATE withdrawal_requests SET stage=$3,state=$4,lease_until=NULL,
      kakao_id=CASE WHEN $3='complete' THEN NULL ELSE coalesce($5,kakao_id) END,
      completed_at=CASE WHEN $3='complete' THEN now() ELSE NULL END,updated_at=now()
      WHERE owner_id=$1 AND fence=$2 AND state='running' AND lease_until>now() RETURNING owner_id`,
      [owner, claimed.fence, next, next === 'complete' ? 'completed' : 'pending', kakaoId ?? null]);
    return { advanced: !!updated, completed: !!updated && next === 'complete' };
  } catch (error) {
    const reason = error instanceof WithdrawalProviderError ? error.reason : 'RESPONSE_UNCERTAIN';
    await db.query(`UPDATE withdrawal_requests SET state=$3,lease_until=NULL,reason=$4,updated_at=now()
      WHERE owner_id=$1 AND fence=$2 AND state='running'`,
      [owner, claimed.fence, reason === 'RESPONSE_UNCERTAIN' ? 'unknown' : 'blocked', reason]);
    return { advanced: false };
  }
}
