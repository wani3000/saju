// Restrictive recovery rehearsal only. This is not an independent mutation journal.
import {z} from 'zod';
import {one,type Database,type Sql} from './db';
const uuid=z.string().uuid(),time=z.string().datetime({offset:true});
const unique=<T extends {id:string}>(a:T[])=>new Set(a.map(v=>v.id)).size===a.length;
export const recoveryOverlaySchema=z.object({kind:z.literal('recovery-overlay-v1'),capturedAt:time,
 accounts:z.array(z.object({id:uuid,erased:z.boolean()}).strict()).max(5000).refine(unique),
 comparisons:z.array(z.object({id:uuid,owner:uuid,erased:z.boolean()}).strict()).max(5000).refine(unique),
 orders:z.array(z.object({id:uuid,owner:uuid,comparison:uuid,state:z.enum(['created','confirming','confirmation_unknown','paid','refund_pending','refunded','cancelled'])}).strict()).max(5000).refine(unique),
}).strict();
export type RecoveryOverlay=z.infer<typeof recoveryOverlaySchema>;
export function validateRecoveryOverlay(raw:unknown,backupAt:string,now:string){
 const o=recoveryOverlaySchema.parse(raw),backup=Date.parse(time.parse(backupAt)),current=Date.parse(time.parse(now)),captured=Date.parse(o.capturedAt);
 if(captured<backup||captured>current||current-captured>15*60000)throw new Error('RECOVERY_OVERLAY_STALE');
 const owners=new Set(o.accounts.map(a=>a.id)),comparisons=new Map(o.comparisons.map(c=>[c.id,c]));
 if(o.comparisons.some(c=>!owners.has(c.owner))||o.orders.some(r=>comparisons.get(r.comparison)?.owner!==r.owner))throw new Error('RECOVERY_OVERLAY_RELATIONSHIP');
 return o;
}
async function capture(tx:Sql){
 const at=(await one(tx,'SELECT now() AS at'))!.at;
 return recoveryOverlaySchema.parse({kind:'recovery-overlay-v1',capturedAt:at instanceof Date?at.toISOString():new Date(at).toISOString(),
  accounts:(await tx.query('SELECT id,(deleted_at IS NOT NULL OR merged_into IS NOT NULL) AS erased FROM accounts ORDER BY id')).rows,
  comparisons:(await tx.query("SELECT id,owner_id AS owner,(inputs='{}'::jsonb) AS erased FROM comparisons ORDER BY id")).rows,
  orders:(await tx.query('SELECT id,owner_id AS owner,comparison_id AS comparison,state FROM orders ORDER BY id')).rows});
}
export async function captureRecoveryOverlay(db:Database){
 return db.transaction(async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');return capture(tx);});
}
export async function applyIsolatedRecoveryOverlay(db:Database,raw:unknown,backupAt:string,now=new Date().toISOString()){
 const overlay=validateRecoveryOverlay(raw,backupAt,now);
 return db.transaction(async tx=>{
  const target=(await one(tx,'SELECT current_database() AS name,current_user AS role,inet_server_addr() AS address'))!;
  // No caller-supplied remote URL or generic production apply mode exists.
  if(target.name!=='saju_restore'||target.role!=='saju_runtime'||target.address!==null)throw new Error('ISOLATED_RECOVERY_TARGET_REQUIRED');
  const restored=await capture(tx),accounts=new Map(overlay.accounts.map(a=>[a.id,a])),comparisons=new Map(overlay.comparisons.map(c=>[c.id,c])),orders=new Map(overlay.orders.map(o=>[o.id,o]));
  for(const c of restored.comparisons){const latest=comparisons.get(c.id);if(latest&&latest.owner!==c.owner)throw new Error('RECOVERY_OWNERSHIP_CHANGED');}
  for(const o of restored.orders){const latest=orders.get(o.id);if(latest&&(latest.owner!==o.owner||latest.comparison!==o.comparison))throw new Error('RECOVERY_OWNERSHIP_CHANGED');}
  const erasedOwners=restored.accounts.filter(a=>!accounts.has(a.id)||accounts.get(a.id)!.erased).map(a=>a.id);
  const erasedSet=new Set(erasedOwners);
  const erase=restored.comparisons.filter(c=>erasedSet.has(c.owner)||!comparisons.has(c.id)||comparisons.get(c.id)!.erased).map(c=>c.id);
  const reversed=restored.orders.filter(o=>orders.get(o.id)?.state==='refunded');
  const revoke=restored.orders.filter(o=>orders.get(o.id)?.state!=='paid').map(o=>o.comparison);
  const restricted=[...new Set([...erase,...revoke])];
  // No resurrected links, sessions, drafts, return attempts or automatic workers.
  await tx.query('DELETE FROM shares');await tx.query('DELETE FROM sessions');await tx.query('DELETE FROM drafts');
  await tx.query('DELETE FROM oauth_attempts');await tx.query('DELETE FROM merge_tickets');await tx.query('DELETE FROM nicepay_attempts');
  await tx.query("UPDATE generation_jobs SET state='cancelled',fence=fence+1,lease_until=NULL,error_code=NULL");
  await tx.query("UPDATE entitlements SET state='revoked' WHERE comparison_id=ANY($1::uuid[])",[restricted]);
  await tx.query('DELETE FROM results WHERE comparison_id=ANY($1::uuid[])',[restricted]);
  await tx.query("UPDATE comparisons SET inputs='{}'::jsonb,charts='{}'::jsonb,input_hash='',state='cancelled' WHERE id=ANY($1::uuid[])",[erase]);
  await tx.query("UPDATE orders SET state='refunded' WHERE id=ANY($1::uuid[])",[reversed.map(o=>o.id)]);
  await tx.query("UPDATE orders SET state='cancelled' WHERE comparison_id=ANY($1::uuid[]) AND state='created'",[erase]);
  await tx.query('UPDATE accounts SET recovery_hash=NULL,deleted_at=coalesce(deleted_at,now()) WHERE id=ANY($1::uuid[])',[erasedOwners]);
  await tx.query('UPDATE auth_identities SET display_name=NULL,avatar_url=NULL WHERE owner_id=ANY($1::uuid[])',[erasedOwners]);
  const restoredIds=new Set(restored.comparisons.map(c=>c.id));
  return {scope:'isolated-recovery-restriction',erasedComparisons:erase.length,refundedOrders:reversed.length,
   sourceComparisonsNotInBackup:overlay.comparisons.filter(c=>!restoredIds.has(c.id)).length,
   externalCalls:0,serviceResumeApproved:false,independentJournalVerified:false,allLinksClosed:true,allSessionsInvalidated:true};
 });
}
