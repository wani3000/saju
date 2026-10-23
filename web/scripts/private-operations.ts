// Local-only files. No DB/network, scheduler installation, key generation or sender.
import { constants } from "node:fs";
import { open, realpath, lstat, mkdir, unlink, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
const repo = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
export const inside = (a: string, b: string) => a === b || a.startsWith(b + path.sep);
export async function privateDirectory(input: string) {
  const actual = await realpath(input), info = await lstat(input);
  if (inside(actual, repo) || info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o077) || (process.getuid && info.uid !== process.getuid())) throw new Error("PRIVATE_DIRECTORY_REQUIRED");
  return actual;
}
export async function readPrivateJson(file: string) {
  await privateDirectory(path.dirname(file));
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 262144 || (info.mode & 0o077) || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())) throw new Error("PRIVATE_JSON_REQUIRED");
    const value = await handle.readFile("utf8");
    if (Buffer.byteLength(value) > 262144) throw new Error("PRIVATE_JSON_TOO_LARGE");
    return JSON.parse(value);
  } finally { await handle.close(); }
}
export async function readOptionalJson(file: string) {
  try { return await readPrivateJson(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function atomicPrivateJson(file: string, value: unknown) {
  const parent = await privateDirectory(path.dirname(file));
  // Validate existing destination before replacing it. A dangling symlink is also refused.
  try {
    const info = await lstat(file);
    if (!info.isFile() || (info.mode & 0o077) || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())) throw new Error("PRIVATE_JSON_REQUIRED");
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const encoded = JSON.stringify(value) + "\n";
  if (Buffer.byteLength(encoded) > 262144) throw new Error("PRIVATE_JSON_TOO_LARGE");
  const temporary = path.join(parent, `.operations-${randomUUID()}.partial`);
  let published = false;
  try {
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(encoded); await handle.sync(); } finally { await handle.close(); }
    await rename(temporary, file); published = true;
  } finally { if (!published) await unlink(temporary).catch(() => {}); }
}
export async function withPrivateLock<T>(directory: string, operation: () => Promise<T>) {
  const parent = await privateDirectory(directory), lock = path.join(parent, ".operations.lock");
  // Crash leftovers intentionally require inspection; never steal a live/stale lock.
  await mkdir(lock, { mode: 0o700 });
  try { return await operation(); } finally { await rmdir(lock); }
}
