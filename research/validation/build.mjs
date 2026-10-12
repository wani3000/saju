import {build} from 'esbuild';
for(const [entry,name] of [['../engines/ssaju/src/calculate.ts','ssaju'],['../engines/manseryeok/src/index.ts','manseryeok'],['../engines/manseryeok/src/time/korea-timezone.ts','korea-timezone']]) await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile:`build/${name}.mjs`});
