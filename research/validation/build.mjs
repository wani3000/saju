import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

// Resolve sources and output relative to this script, including root-level runs.
const validationDir = fileURLToPath(new URL('.', import.meta.url));
for(const [entry,name] of [['../engines/ssaju/src/calculate.ts','ssaju'],['../engines/manseryeok/src/index.ts','manseryeok'],['../engines/manseryeok/src/time/korea-timezone.ts','korea-timezone']]) await build({absWorkingDir:validationDir,entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:`build/${name}.mjs`});
