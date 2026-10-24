import { constants } from "node:fs";
import { open, unlink, lstat } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { privateBackup } from "./private-backup";
import { atomicPrivateJson, inside, privateDirectory, readOptionalJson, readPrivateJson, withPrivateLock } from "./private-operations";
const timestamp = z.string().datetime({ offset: true });
const configSchema = z.object({ kind: z.literal("backup-cycle-file-v1"), input: z.string().min(1), snapshotAt: timestamp,
  keyFile: z.string().min(1), keyVersion: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/), directory: z.string().min(1) }).strict();
const entrySchema = z.object({ id: z.string().uuid(), snapshotAt: timestamp, completedAt: timestamp,
  keyVersion: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/), encryptedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/), bytes: z.number().int().positive(),
  verification: z.literal("authenticated-byte-roundtrip"), restoreVerifiedAt: timestamp.nullable() }).strict();
export const backupCatalogSchema = z.object({ kind: z.literal("private-backup-catalog-v1"), entries: z.array(entrySchema).max(512),
  prunePending: z.array(z.string().uuid()).max(512).optional(), lastPrunedAt: timestamp.optional() }).strict().refine(c => new Set(c.entries.map(e=>e.id)).size===c.entries.length, "DUPLICATE_BACKUP_ID");
export async function fingerprint(file: string) {
  const h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const before = await h.stat();
    if (!before.isFile() || (before.mode & 0o077) || before.nlink !== 1 || (process.getuid && before.uid !== process.getuid())) throw new Error("PRIVATE_DUMP_REQUIRED");
    const digest = createHash("sha256");
    for await (const chunk of h.createReadStream({ autoClose: false })) digest.update(chunk);
    const after = await h.stat();
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) throw new Error("DUMP_CHANGED");
    return { sha256: digest.digest("hex"), bytes: after.size };
  } finally { await h.close(); }
}
export async function backupCycle(raw: unknown, observedAt?: string) {
  const now = observedAt ?? new Date().toISOString();
  const c = configSchema.parse(raw), current = Date.parse(timestamp.parse(now)), snapshot = Date.parse(c.snapshotAt);
  if (snapshot > current || current - snapshot > 3600000) throw new Error("FRESH_SNAPSHOT_REQUIRED");
  const directory = await privateDirectory(c.directory), sourceDirectory = await privateDirectory(path.dirname(c.input)), keyDirectory = await privateDirectory(path.dirname(c.keyFile));
  if (inside(directory, keyDirectory) || inside(keyDirectory, directory) || inside(sourceDirectory, directory) || inside(directory, sourceDirectory)) throw new Error("SEPARATE_DIRECTORIES_REQUIRED");
  const keyInfo = await lstat(c.keyFile);
  if (!keyInfo.isFile() || (keyInfo.mode & 0o077) || keyInfo.nlink !== 1 || (process.getuid && keyInfo.uid !== process.getuid())) throw new Error("PRIVATE_KEY_REQUIRED");
  return withPrivateLock(directory, async () => {
    const file = path.join(directory, "catalog.json");
    const catalog = backupCatalogSchema.parse(await readOptionalJson(file) ?? { kind: "private-backup-catalog-v1", entries: [] });
    if (catalog.prunePending?.length) throw new Error("PRUNE_RECOVERY_REQUIRED");
    if (catalog.entries.some(e => Date.parse(e.snapshotAt) >= snapshot || Date.parse(e.completedAt) > current)) throw new Error("NON_MONOTONIC_BACKUP");
    // Bound local state without silently deleting receipts or encrypted copies.
    // Expired entries are candidates only until reviewed rotation is configured.
    const id = randomUUID(), sealed = path.join(directory, `${id}.saju-backup`), restored = path.join(directory, `.verify-${id}.dump`);
    let sealedCreated = false, restoredCreated = false, committed = false;
    try {
      const before = await fingerprint(c.input);
      await privateBackup("seal", c.input, c.keyFile, sealed); sealedCreated = true;
      await privateBackup("open", sealed, c.keyFile, restored); restoredCreated = true;
      const after = await fingerprint(c.input), decrypted = await fingerprint(restored);
      if (before.sha256 !== after.sha256 || before.bytes !== after.bytes || before.sha256 !== decrypted.sha256 || before.bytes !== decrypted.bytes) throw new Error("BACKUP_CHANGED_OR_CORRUPT");
      await unlink(restored); restoredCreated = false;
      const encrypted = await fingerprint(sealed);
      catalog.entries.push({ id, snapshotAt: c.snapshotAt, completedAt: observedAt ?? new Date().toISOString(), keyVersion: c.keyVersion,
        encryptedSha256: encrypted.sha256, sourceSha256: before.sha256, bytes: before.bytes,
        verification: "authenticated-byte-roundtrip", restoreVerifiedAt: null });
      backupCatalogSchema.parse(catalog);
      await atomicPrivateJson(file, catalog); committed = true;
      return { status: "completed", scope: "local-file-backup-cycle", catalogEntries: catalog.entries.length,
        expiredCopyCandidates: catalog.entries.filter(e => current - Date.parse(e.snapshotAt) >= 7 * 86400000).length,
        integrityChecked: true, restoreVerified: false, lastVerifiedBackupAt: null,
        databaseConnections: 0, externalCalls: 0, automaticallyDeleted: 0, schedulerInstalled: false } as const;
    } finally {
      if (restoredCreated) await unlink(restored);
      if (sealedCreated && !committed) await unlink(sealed);
    }
  });
}
export async function backupCycleCli(args: string[]) {
  try {
    if (args.length !== 2 || args[0] !== "--config") throw new Error();
    return { exitCode: 0, report: await backupCycle(await readPrivateJson(args[1])) };
  } catch { return { exitCode: 1, report: { status: "error", code: "BACKUP_CYCLE_FAILED", externalCalls: 0, databaseConnections: 0, schedulerInstalled: false } }; }
}
