import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewStoredChart } from "../src/domain/chart-review";
import { calculateProfile } from "../src/generated/research.mjs";
const input={calendar:"solar",year:2024,month:2,day:4,leap:false,timeKnown:false};
test("saved boundary candidates are visible without choosing a year/month or inventing an hour",()=>{
  const c=calculateProfile(input),before=structuredClone(c),r=reviewStoredChart(c);
  assert.equal(r.solarLabel,"2024년 2월 4일");
  assert.equal(r.pillars.find(p=>p.key==="year")!.value,c.candidates!.year.join(" / "));
  assert.equal(r.pillars.find(p=>p.key==="month")!.value,c.candidates!.month.join(" / "));
  assert.equal(r.pillars.find(p=>p.key==="hour")!.value,"시간 모름");
  assert.ok(r.warnings.some(w=>w.includes("확률")));assert.deepEqual(c,before);
});
test("known historical limitations are explained from the saved solar date and policy",()=>{
  const early=reviewStoredChart(calculateProfile({...input,year:1908,month:1,day:1}));
  assert.ok(early.warnings.some(w=>w.includes("서울 지역 평균시")));
  assert.ok(early.warnings.some(w=>w.includes("1972년 이전")));
  const after=reviewStoredChart(calculateProfile({...input,year:1908,month:4,day:1}));
  assert.ok(!after.warnings.some(w=>w.includes("서울 지역 평균시")));
  const disputed=reviewStoredChart(calculateProfile({...input,year:1954,month:3,day:21}));
  assert.ok(disputed.warnings.some(w=>w.includes("자료가 서로 달라")));
  const modern=reviewStoredChart(calculateProfile({...input,month:2,day:10}));
  assert.equal(modern.warnings.length,0);
  assert.ok(modern.conventions.some(w=>w.includes("자정(00:00)")));
  assert.ok(modern.conventions.some(w=>w.includes("음력의 해·달")));
});
test("legacy policies remain explicit and an unsupported policy never inherits the latest convention",()=>{
  const c=structuredClone(calculateProfile(input));
  for(const version of ["research-civil-midnight-v3","research-civil-midnight-v4"]) {
    c.policy.version=version;assert.ok(reviewStoredChart(c).conventions.some(w=>w.includes("자정")));
  }
  c.policy.version="unreviewed-engine";
  assert.equal(reviewStoredChart(c).conventions.length,1);
  assert.ok(reviewStoredChart(c).conventions[0].includes("현재 기준으로 바꾸어"));
  const malformed=reviewStoredChart({solar:{year:2024,month:2,day:30},pillars:{year:"<script>"},candidates:{month:["갑자","갑자"]},policy:{}});
  assert.equal(malformed.solarLabel,null);assert.ok(malformed.pillars.every(p=>p.value==="미확정"));
  assert.equal(reviewStoredChart(null).solarLabel,null);
});
