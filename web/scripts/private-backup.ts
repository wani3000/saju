// File-only envelope. No DB connection, uploads, scheduler, key generation or pruning.
import { constants } from "node:fs";
import { open, realpath, link, unlink } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const magic = Buffer.from("SAJUBK01");
const repo = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
const inside = (candidate: string, directory: string) => candidate === directory || candidate.startsWith(directory + path.sep);
async function privateFile(file: string) {
  const actual = await realpath(file);
  if (inside(actual, repo)) throw new Error("PRIVATE_BACKUP_PATH_REQUIRED");
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0) throw new Error("PRIVATE_FILE_REQUIRED");
    return { handle, stat, actual };
  } catch (error) { await handle.close(); throw error; }
}

export async function privateBackup(mode: "seal" | "open", input: string, keyFile: string, output: string) {
  if (!["seal", "open"].includes(mode)) throw new Error("INVALID_BACKUP_MODE");
  const parent = await realpath(path.dirname(output));
  const destination = path.join(parent, path.basename(output));
  if (inside(destination, repo)) throw new Error("PRIVATE_BACKUP_PATH_REQUIRED");
  const directory = await open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { if (((await directory.stat()).mode & 0o077) !== 0) throw new Error("PRIVATE_DIRECTORY_REQUIRED"); }
  finally { await directory.close(); }
  const source = await privateFile(input);
  let key: Buffer | undefined;
  let temporary: string | undefined;
  let sink: Awaited<ReturnType<typeof open>> | undefined;
  try {
    const secret = await privateFile(keyFile);
    try {
      const keyDirectory = await open(path.dirname(secret.actual), constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
      try { if (((await keyDirectory.stat()).mode & 0o077) !== 0) throw new Error("PRIVATE_KEY_DIRECTORY_REQUIRED"); }
      finally { await keyDirectory.close(); }
      if (secret.stat.size !== 32 || inside(source.actual, path.dirname(secret.actual)) || inside(parent, path.dirname(secret.actual)))
        throw new Error("SEPARATE_KEY_DIRECTORY_REQUIRED");
      key = await secret.handle.readFile();
      if (key.length !== 32) throw new Error("INVALID_BACKUP_KEY");
    } finally { await secret.handle.close(); }
    temporary = path.join(parent, `.saju-backup-${randomUUID()}.partial`);
    sink = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    let bytes = 0;
    if (mode === "seal") {
      const header = Buffer.concat([magic, randomBytes(12)]);
      const cipher = createCipheriv("aes-256-gcm", key, header.subarray(8));
      cipher.setAAD(header);
      await sink.writeFile(header);
      for await (const chunk of source.handle.createReadStream({ autoClose: false })) {
        bytes += chunk.length;
        await sink.writeFile(cipher.update(chunk));
      }
      await sink.writeFile(cipher.final());
      await sink.writeFile(cipher.getAuthTag());
    } else {
      if (source.stat.size < 36) throw new Error("INVALID_BACKUP_ENVELOPE");
      const header = Buffer.alloc(20), tag = Buffer.alloc(16);
      await source.handle.read(header, 0, 20, 0);
      await source.handle.read(tag, 0, 16, source.stat.size - 16);
      if (!header.subarray(0, 8).equals(magic)) throw new Error("INVALID_BACKUP_ENVELOPE");
      const cipher = createDecipheriv("aes-256-gcm", key, header.subarray(8));
      cipher.setAAD(header); cipher.setAuthTag(tag);
      if (source.stat.size > 36) {
        for await (const chunk of source.handle.createReadStream({ start: 20, end: source.stat.size - 17, autoClose: false })) {
          const plaintext = cipher.update(chunk); bytes += plaintext.length;
          await sink.writeFile(plaintext);
        }
      }
      const last = cipher.final(); bytes += last.length; await sink.writeFile(last);
    }
    await sink.sync(); await sink.close(); sink = undefined;
    // Publish only after authentication succeeds. link is atomic and never overwrites.
    await link(temporary, destination);
    await unlink(temporary); temporary = undefined;
    return { status: "completed", operation: mode, bytes, externalCalls: 0, databaseConnections: 0 };
  } finally {
    key?.fill(0);
    await source.handle.close();
    await sink?.close();
    if (temporary) await unlink(temporary).catch(() => {});
  }
}

export async function backupCli(args: string[]) {
  try {
    if (args.length !== 7 || !["seal", "open"].includes(args[0]) || args[1] !== "--input" || args[3] !== "--key-file" || args[5] !== "--output") throw new Error();
    return { exitCode: 0, report: await privateBackup(args[0] as "seal" | "open", args[2], args[4], args[6]) };
  } catch {
    // No raw exceptions, paths, source content or key material in terminal output.
    return { exitCode: 1, report: { status: "error", code: "PRIVATE_BACKUP_FAILED", externalCalls: 0, databaseConnections: 0 } };
  }
}
