import {build} from 'esbuild';
import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const web=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(web,'.preview-dist');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await build({entryPoints:[path.join(web,'preview/main.tsx')],bundle:true,platform:'browser',format:'esm',target:'es2022',
  jsx:'automatic',minify:true,entryNames:'app-[hash]',assetNames:'files/[name]-[hash]',outdir:out,metafile:true,
  external:['/assets/*'],define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'file','.woff':'file'},
  tsconfig:path.join(web,'tsconfig.json'),
}).then(async r=>{
 for (const file of Object.keys(r.metafile.inputs)) {
  if (/src\/server\//.test(file) && !/src\/server\/(engine|readings)\.ts$/.test(file)) throw new Error('Unexpected server module in preview');
  if (/(?:^|\/)\.env|\.data\//.test(file)) throw new Error('Private file in preview');
 }
 const outputs=Object.keys(r.metafile.outputs);const js=outputs.find(f=>f.endsWith('.js'));const css=outputs.find(f=>f.endsWith('.css'));
 await writeFile(path.join(out,'index.html'),`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><meta name="referrer" content="no-referrer"><title>김춘배 훈장 · 임시 체험판</title><link rel="stylesheet" href="/${path.basename(css)}"></head><body><div id="root"></div><script type="module" src="/${path.basename(js)}"></script></body></html>`);
});
await cp(path.join(web,'public/assets/chunbae-v1'),path.join(out,'assets/chunbae-v1'),{recursive:true});
await cp(path.join(web,'public/assets/kakao'),path.join(out,'assets/kakao'),{recursive:true});
await cp(path.join(web,'licenses'),path.join(out,'licenses'),{recursive:true});
await writeFile(path.join(out,'robots.txt'),'User-agent: *\nDisallow: /\n');
await writeFile(path.join(out,'vercel.json'),JSON.stringify({framework:null,headers:[{source:'/(.*)',headers:[
 {key:'X-Robots-Tag',value:'noindex, nofollow'},{key:'Referrer-Policy',value:'no-referrer'},
 {key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},
 {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"},
 {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
]}]},null,2)+'\n');
console.log('Static preview built; no server functions, credentials, database files, or session data included.');
