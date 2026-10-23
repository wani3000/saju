// Owns its loopback server and disposable DB. Never reads .env files or inherits service keys.
import { cp, copyFile, mkdtemp, rm, symlink, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { once } from "node:events";
const args=process.argv.slice(2);
if(args.length>1||args.some(a=>!["--kakao-required","--nicepay-sandbox"].includes(a))) {
  // A typo must not silently pass the default mock journey instead of the
  // intended authentication/payment scope. Never echo arbitrary arguments.
  console.error("INVALID_JOURNEY_ARGUMENTS");process.exit(1);
}
const required=args[0]==="--kakao-required";
const nicepay=args[0]==="--nicepay-sandbox";
const web = fileURLToPath(new URL("../",import.meta.url));
await access(path.join(web,".next/BUILD_ID"));
const temp = await mkdtemp(path.join(tmpdir(),"saju-journey-"));
const portServer = createServer();
await new Promise((resolve,reject) => portServer.once("error",reject).listen(0,"127.0.0.1",resolve));
const port = portServer.address().port;
await new Promise((resolve,reject)=>portServer.close(e=>e?reject(e):resolve()));
const origin = `http://127.0.0.1:${port}`;
const env = Object.fromEntries(["PATH","HOME","TMPDIR","TEMP","SystemRoot","CI","PLAYWRIGHT_BROWSERS_PATH"].filter(k=>process.env[k]!==undefined).map(k=>[k,process.env[k]]));
Object.assign(env,{NODE_ENV:"production",NEXT_TELEMETRY_DISABLED:"1",SAJU_MODE:"research",SAJU_AUTH_MODE:required?'kakao-required':'local-demo',APP_ORIGIN:origin,PAYMENT_PROVIDER:"mock",SAJU_LOCAL_RUN:"1",TEST_ORIGIN:origin});
if(nicepay)Object.assign(env,{PAYMENT_PROVIDER:"nicepay-test",NICEPAY_MODE:"sandbox",NICEPAY_CLIENT_KEY:"S2_http_fixture",NICEPAY_SECRET_KEY:"http-synthetic-secret"});
let server;
let serverLog = "";
let active;
const run = args => new Promise((resolve,reject)=>{
  const child = spawn(process.execPath,args,{cwd:web,env,stdio:"inherit"});active=child;
  child.once("error",reject);
  child.once("exit",code=>{active=undefined;code===0?resolve():reject(new Error(`Local check exited ${code}`));});
});
const terminate = signal => { active?.kill(signal);server?.kill(signal); };
const interrupt = () => terminate("SIGTERM");
process.once("SIGINT",interrupt);process.once("SIGTERM",interrupt);
try {
  for(const name of ["package.json","next.config.ts"])await copyFile(path.join(web,name),path.join(temp,name));
  await cp(path.join(web,".next"),path.join(temp,".next"),{recursive:true,filter:src=>!src.startsWith(path.join(web,".next/cache"))});
  for(const name of ["node_modules","public","db"])await symlink(path.join(web,name),path.join(temp,name),"dir");
  server=spawn(process.execPath,[path.join(web,"node_modules/next/dist/bin/next"),"start","--hostname","127.0.0.1","--port",String(port)],{cwd:temp,env,stdio:["ignore","pipe","pipe"]});
  server.on("error",e=>{serverLog+=e.message;});
  for(const stream of [server.stdout,server.stderr])stream.on("data",b=>{serverLog=(serverLog+b.toString()).slice(-6000);});
  let ready=false;
  for(let attempt=0;attempt<60;attempt++) {
    if(server.exitCode!==null)throw new Error("Isolated server stopped before readiness");
    try { const res=await fetch(origin,{signal:AbortSignal.timeout(1000)});if(res.ok){ready=true;break;} } catch { /* Startup in progress. */ }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!ready)throw new Error("Isolated server readiness timeout");
  console.log("Isolated local checks: synthetic credentials, temporary DB, disposable accounts.");
  await run([nicepay?"tests/nicepay-http.mjs":required?"tests/kakao-required-http.mjs":"tests/http.mjs"]);
  await run(["node_modules/@playwright/test/cli.js","test"]);
  console.log(nicepay?"PASS: local NICEPAY HTTP guards and synthetic-SDK mobile launch; no external payment or production readiness is implied.":"PASS: local HTTP and mobile browser journeys; no production readiness is implied.");
} catch(error) {
  console.error("LOCAL_JOURNEY_FAILED",error.message);
  // Only this isolated server sees synthetic inputs; service credentials were not inherited.
  if(serverLog)console.error(serverLog);
  process.exitCode=1;
} finally {
  terminate("SIGTERM");
  if(server && server.exitCode===null && server.signalCode===null) {
    const ended=once(server,"exit");
    const force=setTimeout(()=>server.kill("SIGKILL"),3000);
    await ended;clearTimeout(force);
  }
  await rm(temp,{recursive:true,force:true});
  process.removeListener("SIGINT",interrupt);process.removeListener("SIGTERM",interrupt);
}
