import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chart} from '../src/server/engine';
import {samplePerson,publicCard,type Reading} from '../src/domain/model';
import {readingForVersion,currentReadingVersion} from '../src/server/readings';
import {coherentReadingVersion} from '../src/domain/coherent-reading';
const args=process.argv.slice(2);
if(args.length>1||args.some(a=>a!=='--check'))throw new Error('INVALID_AUDIT_ARGUMENTS');
const relations=['연인','친구','가족','동료'];
const people=Array.from({length:120},(_,i)=>({...samplePerson(),year:String(1975+i%40),month:String(1+i%12),day:String(8+i*7%20),timeKnown:i%2===0,hour:String(i*5%24),minute:'30'}));
const charts=people.map(p=>chart(p));
const section=(r:Reading)=>r.wholeChart!.pair.sections.find(s=>s.id==='conversation')!;
const duplicate=(r:Reading)=>{const lines=section(r).text.split('\n').filter(s=>/^(자네|상대): /.test(s)).map(s=>s.replace(/^(자네|상대): /,''));return lines.length===4&&lines[0]===lines[2]&&lines[1]===lines[3];};
const counts={crossChart:0,sameChart:0,boundary:0,duplicateBefore:0,duplicateAfter:0,shortened:0};
const hash=createHash('sha256');
function review(me:unknown,other:unknown,relation:string){
  const context={charts:{me,other},relation},old=readingForVersion(coherentReadingVersion,context),before=structuredClone(old),next=readingForVersion(currentReadingVersion,context);
  hash.update(JSON.stringify(old));
  if(duplicate(old))counts.duplicateBefore++;
  if(duplicate(next))counts.duplicateAfter++;
  if(section(old).text!==section(next).text){assert.ok(duplicate(old));counts.shortened++;}
  const normalized=structuredClone(next);normalized.ruleVersion=old.ruleVersion;normalized.wholeChart!.version=old.wholeChart!.version;section(normalized).text=section(old).text;
  assert.deepEqual(normalized,old);assert.deepEqual(old,before);
  const shared=publicCard(['가','나'],next);shared.reading.ruleVersion=old.ruleVersion;assert.deepEqual(shared,publicCard(['가','나'],old));
  assert.equal(next.score,null);assert.equal(next.basis!.productionApproved,false);
  if(relation!=='연인')assert.doesNotMatch(JSON.stringify(next.wholeChart!.pair),/데이트|사랑받|애정|결혼/);
  for(const person of next.wholeChart!.people){
    assert.deepEqual(new Set(person.narrative!.flatMap(t=>t.evidenceIds)),new Set(person.evidence.map(e=>e.id)));
    if(person.omittedPositions.includes('hour'))assert.ok(person.evidence.every(e=>e.position!=='hour'));
  }
}
for(const relation of relations)for(let i=0;i<120;i++){
  review(charts[i],charts[(i*37+17)%120],relation);counts.crossChart++;
  const c=chart({...people[i],timeKnown:false});review(c,c,relation);counts.sameChart++;
}
for(const relation of relations)for(const [year,month,day] of [['2024','2','4'],['1954','3','21']]){
  review(chart({...samplePerson(),year,month,day}),charts[17],relation);counts.boundary++;
}
assert.ok(counts.duplicateBefore>0);assert.equal(counts.duplicateAfter,0);assert.equal(counts.shortened,counts.duplicateBefore);
const report={version:currentReadingVersion,previousVersion:coherentReadingVersion,scope:'synthetic-editorial-audit-not-expert-approval',counts,previousOutputsSha256:hash.digest('hex'),invariants:{factsAndPersonalCopyPreserved:true,publicCopyPreservedExceptVersion:true,unknownTimeNotFilled:true,relationshipCategoriesSeparated:true,score:null,expertApproval:false,externalCalls:0}};
const output=JSON.stringify(report,null,2)+'\n',file=new URL('../../docs/audits/reading-v9-dialogue-review.json',import.meta.url);
if(args.length)assert.equal(readFileSync(file,'utf8'),output,'READING_REVIEW_STALE');else writeFileSync(file,output);
console.log(JSON.stringify(report));
