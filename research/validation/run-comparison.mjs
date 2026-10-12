import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as ss from './build/ssaju.mjs';
import * as ms from './build/manseryeok.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/kasi-derived.json',import.meta.url)));
const hanja='甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥';
const korean='갑을병정무기경신임계자축인묘진사오미신유술해';
const ko=s=>[...s].map(x=>korean[hanja.indexOf(x)]??x).join('');
const engines={ssaju:{...ss,pillars:(x)=>Object.fromEntries(Object.entries(ss.calculateSaju({...x,now:'2026-10-09T00:00:00Z'}).pillars).map(([k,v])=>[k,ko(v)]))},manseryeok:{...ms,pillars:x=>ms.calculateFourPillars({...x,dayBoundary:'midnight'}).toObject()}};
const report={fixtureDates:fixtures.dates.length,fixtureTerms:fixtures.terms.length,engines:{}};
for(const [name,e] of Object.entries(engines)){
 const r={checks:{},failures:[]}; report.engines[name]=r;
 function check(type,input,expected,fn){const c=r.checks[type]??={passed:0,failed:0};try{const actual=fn();assert.deepEqual(actual,expected);c.passed++;}catch(err){c.failed++;r.failures.push({type,input,expected,message:err.message});}}
 for(const f of fixtures.dates){
  const [y,m,d,l]=f.lunar;const [sy,sm,sd]=f.solar;
  check('solarToLunar',f.solar,{year:y,month:m,day:d,isLeapMonth:l},()=>e.solarToLunar(sy,sm,sd));
  check('lunarToSolar',f.lunar,{year:sy,month:sm,day:sd},()=>e.lunarToSolar(y,m,d,l));
  check('dayPillar',f.solar,f.dayPillar,()=>e.pillars({year:sy,month:sm,day:sd,hour:12,minute:0}).day);
 }
 const branch='자축인묘진사오미신유술해';
 for(const t of fixtures.terms.filter(t=>t.index%2===0)){
  const [year,month,day,hour,minute]=t.local;
  for(const offset of [-1,1]){
   const z=new Date(Date.UTC(year,month-1,day,hour,minute+offset));
   const x={year:z.getUTCFullYear(),month:z.getUTCMonth()+1,day:z.getUTCDate(),hour:z.getUTCHours(),minute:z.getUTCMinutes()};
   const b=(t.index/2+1+(offset<0?-1:0))%12;
   check('solarTermBoundary',{name:t.name,...x},branch[b],()=>e.pillars(x).month.slice(1));
  }
 }
 for(const x of [{year:2023,month:2,day:29,hour:12,minute:0},{year:2024,month:2,day:30,hour:12,minute:0},{year:2024,month:1,day:1,hour:24,minute:0}])
  check('invalidInput',x,true,()=>{try{e.pillars(x);return false;}catch{return true;}});
 const midnight={year:2024,month:2,day:10,hour:23,minute:30};
 check('midnightPolicy',midnight,'갑진',()=>e.pillars(midnight).day);
}
fs.writeFileSync(new URL('./reports/comparison.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({fixtureDates:report.fixtureDates,engines:Object.fromEntries(Object.entries(report.engines).map(([k,v])=>[k,v.checks]))},null,2));
// This is an evaluation report, not a CI pass: candidates may fail. Print the verdict explicitly.
console.log('Full failures saved. Candidate failures do NOT constitute a passing test suite.');
