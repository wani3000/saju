import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { checkpoint, restoreNavigation } from "../src/domain/navigation";
const state = () => ({draft:{me:{id:randomUUID()},other:{id:randomUUID()}},results:[{id:randomUUID()}],pending:[{id:randomUUID()}]});
test("reload restores owned results and processing jobs, never a missing, refunded or foreign result", () => {
  const s=state();
  for(const id of [s.results[0].id,s.pending[0].id]) {
    const raw=JSON.stringify(checkpoint("result",id,s));
    assert.equal(restoreNavigation(raw,s).selected,id);
    assert.equal(restoreNavigation(raw,state()).view,"home");
    assert.equal(restoreNavigation(raw,{...s,results:[],pending:[]}).view,"home");
  }
  assert.equal(restoreNavigation(JSON.stringify(checkpoint("share",s.pending[0].id,s)),s).view,"result");
});
test("saved input stages require the same server draft and consent is never restored", () => {
  const s=state();
  for(const view of ["me","other","review"]) {
    const raw=JSON.stringify(checkpoint(view,null,s,true));
    assert.equal(restoreNavigation(raw,s).view,view);
    assert.equal(restoreNavigation(raw,{...s,draft:null}).view,"home");
    assert.equal(restoreNavigation(raw,state()).view,"home");
  }
  assert.equal(restoreNavigation(JSON.stringify(checkpoint("me",null,s,true)),s).editing,true);
  const withPrivateData={...s,draft:{...s.draft,me:{...s.draft.me,name:"PRIVATE",year:"1990"}}};
  const raw=JSON.stringify(checkpoint("review",s.results[0].id,withPrivateData));
  assert.ok(!/PRIVATE|"year"|consent|token|alias/.test(raw));
  assert.equal(JSON.parse(raw).selected,null);
});
test("malformed or expanded checkpoints fall back safely and never execute actions", () => {
  const s=state();
  for(const raw of ["{", "null", "[]",JSON.stringify({version:9,view:"result"}),JSON.stringify({...checkpoint("review",null,s),consent:true}),JSON.stringify({...checkpoint("result",s.results[0].id,s),view:"pay"})])
    assert.equal(restoreNavigation(raw,s).view,"home");
});
