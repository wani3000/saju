import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
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
  const sql = await readFile(
    path.join(process.cwd(), "db/migrations/001_core.sql"),
    "utf8",
  );
  // Serialize process-local initialization; migration is intentionally additive and idempotent.
  await db.transaction(async (tx) => {
    for (const statement of sql.split(";").filter((x) => x.trim()))
      await tx.query(statement);
  });
}
const globalDb = globalThis as unknown as { sajuDb?: Promise<Database> };
export function database() {
  return (globalDb.sajuDb ??= (async () => {
    assertMode();
    const db = await openDatabase();
    await migrate(db);
    return db;
  })());
}
export function assertMode() {
  if (process.env.SAJU_MODE && process.env.SAJU_MODE !== "research")
    throw new Error("PRODUCTION_RELEASE_NOT_APPROVED");
  if (
    process.env.PAYMENT_PROVIDER &&
    !["mock", "toss-test"].includes(process.env.PAYMENT_PROVIDER)
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
