import { readFile, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { Pool } from 'pg';
import { assertMigrationsApplied, type Database } from '../src/server/db';
import { processWithdrawal } from '../src/server/withdrawal';
import { withdrawalProvider } from '../src/server/withdrawal-provider';
import { hostedRestoreTarget } from './hosted-restore-target';

let pool: Pool | undefined;
try {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== '--settings' || args[2] !== '--project' || !['--check','--apply-recorded-requests'].includes(args[4])) throw new Error();
  const stat = await lstat(args[1]);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || (stat.mode & 0o077) || stat.uid !== process.getuid?.()) throw new Error();
  const env = parseEnv(await readFile(args[1], 'utf8'));
  const runtime = new URL(env.DATABASE_URL!);
  // Reuse exact staging/TLS validation without taking or needing DB admin rights.
  const adminShape = new URL(runtime);
  adminShape.username = `postgres.${args[3]}`; adminShape.port = '5432';
  hostedRestoreTarget(env, { SUPABASE_PROJECT_REF: args[3], SUPABASE_ADMIN_DATABASE_URL: adminShape.href }, args[3]);
  const provider = withdrawalProvider(env);
  if (!provider || args[4] === '--check') {
    console.log(JSON.stringify({status: provider ? 'configured-not-provider-verified' : 'blocked', code: provider ? 'RECORDED_REQUESTS_ONLY' : 'WITHDRAWAL_CONFIGURATION_REQUIRED', externalCalls: 0, completed: 0}));
    process.exitCode = provider ? 0 : 2;
  } else {
    pool = new Pool({ connectionString: runtime.href, max: 1, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
    const db: Database = { query: (s,p) => pool!.query(s,p), close: async()=>{}, transaction: async fn => {
      const c = await pool!.connect();
      try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
      catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
    }};
    await assertMigrationsApplied(db);
    const requests = await db.query(`SELECT owner_id FROM withdrawal_requests WHERE state IN ('pending','blocked','running') ORDER BY requested_at LIMIT 10`);
    let advanced = 0, completed = 0;
    for (const row of requests.rows) {
      const result = await processWithdrawal(db,row.owner_id,provider);
      advanced += Number(result.advanced); completed += Number(result.completed === true);
    }
    const remaining = (await db.query(`SELECT count(*)::int AS n FROM withdrawal_requests WHERE state<>'completed'`)).rows[0].n;
    console.log(JSON.stringify({status: remaining ? 'pending-review' : 'no-pending-requests', advanced, completed, remaining}));
    process.exitCode = remaining ? 2 : 0;
  }
} catch {
  console.log(JSON.stringify({status:'error',code:'WITHDRAWAL_WORKER_FAILED'})); process.exitCode = 1;
} finally { await pool?.end(); }
