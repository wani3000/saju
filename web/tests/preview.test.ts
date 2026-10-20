import {test} from "node:test";
import assert from "node:assert/strict";
import {previewController} from "../preview/controller";
import {samplePerson} from "../src/domain/model";
import {validatePair} from "../src/server/engine";
import {currentReadingVersion,readingForVersion} from "../src/server/readings";
const pair=()=>({me:samplePerson(),other:samplePerson(true)});
const store=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};};
async function free(c:ReturnType<typeof previewController>) {
 const p=pair(), {id}=await c.request("comparisons",{pair:p,key:crypto.randomUUID(),consent:true});
 await c.request("process",{});return {p,id};
}
test("browser preview uses the current calculation and reading, preserves reloads, and isolates another tab",async()=>{
 const storage=store(),c=previewController(storage),{p,id}=await free(c),s=await c.request("state");
 const expected=validatePair(p);
 assert.equal(s.results[0].id,id);
 assert.deepEqual(s.results[0].charts,expected.charts);
 assert.deepEqual(s.results[0].reading,readingForVersion(currentReadingVersion,{charts:expected.charts,relation:p.other.relation}));
 assert.deepEqual((await previewController(storage).request("state")).results,s.results);
 assert.equal((await previewController(store()).request("state")).results.length,0);
 assert.equal(s.authEnabled,false);assert.equal(s.tossClientKey,null);
});
test("preview rejects consent, invalid birth dates, and protected historical clock inputs before consuming a free result",async()=>{
 const c=previewController();
 await assert.rejects(c.request("comparisons",{pair:pair(),key:"a",consent:false}),{code:"CONSENT_REQUIRED"});
 const p=pair();p.me.year="1988";p.me.month="5";p.me.day="8";p.me.timeKnown=true;p.me.hour="2";p.me.minute="30";
 await assert.rejects(c.request("comparisons",{pair:p,key:"b",consent:true}),{code:"NONEXISTENT_BIRTH_TIME"});
 assert.equal((await c.request("state")).free,"available");
 assert.equal((await c.request("state")).results.length,0);
});
test("preview draft revisions, duplicate comparisons and mock confirmations cannot silently duplicate results",async()=>{
 const c=previewController(), p=pair();
 await c.request("draft",{pair:p,revision:0});
 await assert.rejects(c.request("draft",{pair:p,revision:0}),{code:"REVISION_CONFLICT"});
 const request={pair:p,key:"first",consent:true};
 const first=await c.request("comparisons",request);
 assert.deepEqual(await c.request("comparisons",request),first);
 await c.request("process",{});await c.request("process",{});
 assert.equal((await c.request("state")).results.length,1);
 const second=await c.request("comparisons",{pair:pair(),key:"next",consent:true});
 const state=await c.request("state"),order=state.orders[0];
 assert.equal(state.results.length,1);assert.equal(order.provider,"mock");
 await assert.rejects(c.request(`orders/${order.id}/confirm`,{paymentKey:`mock_${order.id}`,amount:1}),{code:"INVALID_PAYMENT"});
 await c.request(`orders/${order.id}/confirm`,{paymentKey:`mock_${order.id}`,amount:2900});
 await c.request("process",{});
 await c.request(`orders/${order.id}/confirm`,{paymentKey:`mock_${order.id}`,amount:2900});
 await c.request("process",{});
 assert.equal((await c.request("state")).results.filter((r:any)=>r.id===second.id).length,1);
});
test("preview never provides real auth, recovery, external checkout or public share links, and reset affects its namespace only",async()=>{
 const storage=store();storage.setItem("unrelated","keep");
 const c=previewController(storage);const {id}=await free(c);
 for(const path of ["auth/start","recover","recovery-code",`results/${id}/shares`,"orders/unknown/prepare"])
  await assert.rejects(c.request(path,{}),{code:"PREVIEW_ONLY"});
 c.reset();assert.equal(storage.getItem("unrelated"),"keep");
 await assert.rejects(c.request("draft",{pair:pair(),revision:0}),{code:"PREVIEW_RESET"});
 assert.equal((await previewController(storage).request("state")).results.length,0);
 const bad={getItem:()=>"invalid-json",setItem:()=>{throw new Error();},removeItem:()=>{throw new Error();}};
 assert.equal((await previewController(bad).request("state")).results.length,0);
});
