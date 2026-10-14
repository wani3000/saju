import { readFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
// JSONB columns carry domain snapshots; callers validate inputs before insertion.
export type Row = Record<string, any>;
export interface Sql {
  query<T extends Row = Row>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[] }>;
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function openDatabase(location?: string): Promise<Database> {
  if (process.env.DATABASE_URL && !location) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
    return {
      query: async (sql, params) => await pool.query(sql, params),
      close: () => pool.end(),
      transaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const out = await fn(client);
          await client.query("COMMIT");
          return out;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        } finally {
          client.release();
        }
      },
    };
  }
  const dataDir = location ?? path.join(process.cwd(), ".data/postgres");
  if (dataDir !== "memory://")
    await mkdir(path.dirname(dataDir), { recursive: true, mode: 0o700 });
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  return {
    query: (s, p) => pg.query(s, p),
    transaction: (fn) => pg.transaction(fn),
    close: () => pg.close(),
  };
}
export async function migrate(db: Database) {
  const dir = path.join(process.cwd(), "db/migrations");
  const files = (await readdir(dir))
    .filter((f) => /^\d+.*\.sql$/.test(f))
    .sort();
  await db.transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(73410614)");
    await tx.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of files) {
      const sql = await readFile(path.join(dir, file), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const old = await one(
        tx,
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [file],
      );
      if (old) {
        if (old.checksum !== checksum)
          throw new Error("MIGRATION_CHECKSUM_CHANGED");
        continue;
      }
      for (const statement of sql.split(";").filter((x) => x.trim()))
        await tx.query(statement);
      await tx.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [file, checksum],
      );
    }
  });
}
const globalDb = globalThis as unknown as { sajuDb?: Promise<Database> };
export function database() {
  return (globalDb.sajuDb ??= (async () => {
    assertMode();
    const db = await openDatabase();
    if (!process.env.DATABASE_URL) await migrate(db);
    else if (
      !(await one(
        db,
        "SELECT name FROM schema_migrations WHERE name='002_operations.sql'",
      ))
    )
      throw new Error("RUN_MIGRATIONS_FIRST");
    return db;
  })());
}
export function assertMode() {
  if (process.env.SAJU_MODE && process.env.SAJU_MODE !== "research")
    throw new Error("PRODUCTION_RELEASE_NOT_APPROVED");
  if (
    process.env.PAYMENT_PROVIDER &&
    !["mock", "toss-test", "nicepay-test"].includes(
      process.env.PAYMENT_PROVIDER,
    )
  )
    throw new Error("LIVE_PAYMENTS_DISABLED");
}
export async function one<T extends Row = Row>(
  db: Sql,
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  return (await db.query<T>(sql, params)).rows[0];
}
