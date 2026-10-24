// Explicit local catalog rotation. No remote storage, keys or scheduler access.
import path from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import { backupCatalogSchema, fingerprint } from "./backup-cycle";
import { atomicPrivateJson, privateDirectory, readPrivateJson, withPrivateLock } from "./private-operations";
import { servicePolicy } from "../src/server/service-policy";
export async function pruneBackups(directory: string, apply: boolean, now = new Date().toISOString()) {
  if(typeof apply!=="boolean")throw new Error("INVALID_ROTATION_MODE");
  const current = Date.parse(z.string().datetime({offset:true}).parse(now));
  const parent = await privateDirectory(directory);
  return withPrivateLock(parent, async () => {
    const file = path.join(parent,"catalog.json"), catalog = backupCatalogSchema.parse(await readPrivateJson(file));
    if(catalog.entries.some(e=>Date.parse(e.snapshotAt)>current || Date.parse(e.completedAt)>current))throw new Error("FUTURE_BACKUP");
    const expired = catalog.entries.filter(e=>current-Date.parse(e.snapshotAt)>=servicePolicy.backupDays*86400000);
    const targets = catalog.prunePending?.length ? catalog.prunePending : expired.map(e=>e.id);
    const targetSet = new Set(targets), expiredSet = new Set(expired.map(e=>e.id));
    if(targetSet.size!==targets.length || targets.some(id=>!expiredSet.has(id)))throw new Error("INVALID_PRUNE_STATE");
    const retained = catalog.entries.filter(e=>!targetSet.has(e.id));
    // Never rotate away the last recent integrity-checked copy. Verify all files
    // before any deletion; only a recorded interrupted deletion may be absent.
    if(targets.length && !retained.some(e=>current-Date.parse(e.snapshotAt)<servicePolicy.backupDays*86400000))throw new Error("RECENT_BACKUP_REQUIRED");
    for(const entry of catalog.entries){
      try { const f=await fingerprint(path.join(parent,entry.id+".saju-backup"));if(f.sha256!==entry.encryptedSha256)throw new Error("BACKUP_HASH_MISMATCH"); }
      catch(error){if(!((error as NodeJS.ErrnoException).code==="ENOENT" && catalog.prunePending?.includes(entry.id)))throw error;}
    }
    if(!apply || !targets.length)return {status:"planned",candidates:targets.length,removed:0,resuming:Boolean(catalog.prunePending?.length),externalCalls:0};
    // Persist intent before unlink; a crash is resumable and blocks new cycles.
    catalog.prunePending=targets;await atomicPrivateJson(file,catalog);
    for(const id of targets)await unlink(path.join(parent,id+".saju-backup")).catch(error=>{if(error.code!=="ENOENT")throw error;});
    catalog.entries=retained;catalog.prunePending=[];catalog.lastPrunedAt=now;
    await atomicPrivateJson(file,catalog);
    return {status:"completed",candidates:targets.length,removed:targets.length,resuming:false,externalCalls:0};
  });
}
export async function pruneCli(args:string[]){
  try {if(args.length!==3||args[0]!=="--directory"||!["--plan","--apply"].includes(args[2]))throw new Error();
    return {exitCode:0,report:await pruneBackups(args[1],args[2]==="--apply")};
  }catch{return {exitCode:1,report:{status:"error",code:"BACKUP_ROTATION_FAILED",externalCalls:0}};}
}
