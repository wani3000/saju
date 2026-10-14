import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

// Resolve sources and output relative to this script, including root-level runs.
const validationDir = fileURLToPath(new URL('.', import.meta.url));
execFileSync(process.execPath, [fileURLToPath(new URL('./restore-engines.mjs', import.meta.url)), '--check'], {stdio:'inherit'});
for(const [entry,name] of [['../engines/ssaju/src/calculate.ts','ssaju'],['../engines/manseryeok/src/index.ts','manseryeok'],['../engines/manseryeok/src/time/korea-timezone.ts','korea-timezone'],['../engines/manseryeok/src/pillars.ts','pillars']]) await build({absWorkingDir:validationDir,entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:`build/${name}.mjs`});
