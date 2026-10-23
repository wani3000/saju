import {z} from 'zod';

const version=z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/);
const versions=z.array(version).max(100).refine(xs=>new Set(xs).size===xs.length);
const migrations=z.array(z.object({name:z.string().regex(/^\d{3}_[a-z_]+\.sql$/),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1).max(100)
  .refine(xs=>new Set(xs.map(x=>x.name)).size===xs.length);
const targetSchema=z.object({kind:z.literal('runtime-recovery-manifest-v1'),schemaMigrations:migrations,engineVersions:versions.refine(xs=>xs.length>0),readingVersions:versions.refine(xs=>xs.length>0)}).strict();
const inventorySchema=z.object({kind:z.literal('recovery-inventory-v1'),schemaMigrations:migrations,storedEngineVersions:versions,storedReadingVersions:versions,pendingReadingVersions:versions}).strict();

/** Offline structural check only. Never restores a DB or treats operator data as recovery approval. */
export function recoveryCompatibility(target:unknown,inventory:unknown){
  const runtime=targetSchema.safeParse(target),backup=inventorySchema.safeParse(inventory);
  const base={scope:'artifact-compatibility-only',externalCalls:0,databaseConnections:0,productionRecoveryApproved:false};
  if(!runtime.success||!backup.success)return {...base,status:'invalid',codes:['INVALID_RECOVERY_INPUT']};
  const r=runtime.data,b=backup.data,codes:string[]=[];
  const normalized=(xs:typeof r.schemaMigrations)=>[...xs].sort((a,b)=>a.name.localeCompare(b.name));
  if(JSON.stringify(normalized(r.schemaMigrations))!==JSON.stringify(normalized(b.schemaMigrations)))codes.push('MIGRATION_MISMATCH');
  if(b.storedEngineVersions.some(v=>!r.engineVersions.includes(v)))codes.push('UNSUPPORTED_ENGINE_VERSION');
  if(b.storedReadingVersions.some(v=>!r.readingVersions.includes(v)))codes.push('UNSUPPORTED_STORED_READING_VERSION');
  if(b.pendingReadingVersions.some(v=>!r.readingVersions.includes(v)))codes.push('UNSUPPORTED_PENDING_READING_VERSION');
  return {...base,status:codes.length?'blocked':'compatible',codes};
}

export function recoveryArguments(args:readonly string[]){
  if(args.length!==4||args[0]!=='--target'||args[2]!=='--inventory'||!args[1]||!args[3]||args[1].startsWith('-')||args[3].startsWith('-'))return null;
  return {target:args[1],inventory:args[3]};
}
