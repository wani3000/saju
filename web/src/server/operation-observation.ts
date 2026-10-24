import { one, type Database } from './db';
import {health} from './operations';
import {alertObservationSchema} from './alert-plan';
// One consistent, explicitly read-only snapshot; no IDs or payloads selected.
export async function collectOperationObservation(db:Database){
  return db.transaction(async tx=>{
    await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const row=(await one(tx,"SELECT now() AS at,max(created_at) FILTER(WHERE kind='retention' AND outcome='completed') AS retention_at FROM operational_events"))!;
    const iso=(v:unknown)=>v instanceof Date?v.toISOString():typeof v==='string'?new Date(v).toISOString():null;
    const report=await health({...db,query:tx.query.bind(tx)});
    return alertObservationSchema.parse({kind:'operations-observation-v1',at:iso(row.at),health:report,lastRetentionSuccessAt:iso(row.retention_at),lastVerifiedBackupAt:null});
  });
}
