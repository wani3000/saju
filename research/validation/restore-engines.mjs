/** Restore exact source revisions. Existing checkouts are verified, never reset. */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const lock = JSON.parse(readFileSync(resolve(here, 'engines.lock.json')));
const checkOnly = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw new Error('Usage: node restore-engines.mjs [--check]');
function git(cwd, ...args) {
  return execFileSync('git', args, {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
}
for (const engine of lock) {
  if (!/^[a-z0-9-]+$/.test(engine.name) || !/^[a-f0-9]{40}$/.test(engine.commit)) throw new Error('Invalid engine lock');
  const dir = resolve(here, '../engines', engine.name);
  if (!existsSync(dir)) {
    if (checkOnly) throw new Error(`Missing ${engine.name}; run node research/validation/restore-engines.mjs`);
    mkdirSync(resolve(here, '../engines'), {recursive:true});
    execFileSync('git', ['clone','--no-checkout','--',engine.repository,dir], {stdio:'inherit'});
    git(dir, 'checkout', '--detach', engine.commit);
  }
  const head = git(dir, 'rev-parse', 'HEAD');
  if (head !== engine.commit) throw new Error(`${engine.name}: expected ${engine.commit}, found ${head}. Preserve local work and restore the pinned revision manually.`);
  if (git(dir, 'status', '--porcelain', '--untracked-files=all')) throw new Error(`${engine.name}: dirty source checkout. Preserve local work before validation.`);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json')));
  if (pkg.version !== engine.packageVersion) throw new Error(`${engine.name}: package version differs from lock`);
  if (!existsSync(resolve(dir, 'LICENSE'))) throw new Error(`${engine.name}: LICENSE is missing`);
  console.log(`${engine.name}: ${head} verified`);
}
