import {writeFileSync} from 'node:fs';
import {chart} from '../src/server/engine';
import {samplePerson,publicCard,type Reading} from '../src/domain/model';
import {readingForVersion} from '../src/server/readings';
const currentReadingVersion='chunbae-coherent-whole-chart-v8';
const relations=['연인','친구','가족','동료'];
const people=Array.from({length:120},(_,i)=>({...samplePerson(),name:`가상${i+1}`,year:String(1975+i%40),month:String(1+i%12),day:String(8+(i*7)%20),timeKnown:i%2===0,hour:String((i*5)%24),minute:'30'}));
const charts=people.map(p=>chart(p));
const section=(r:Reading,id:string)=>r.wholeChart!.pair.sections.find(s=>s.id===id)!;
const body=(r:Reading)=>JSON.stringify({summary:r.wholeChart!.pair.summary,sections:r.wholeChart!.pair.sections.map(s=>({id:s.id,text:s.text})),closing:r.interpretation!.closing});
const histogram=(xs:string[])=>Object.entries(xs.reduce((a,x)=>(a[x]=(a[x]??0)+1,a),{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
const metrics:any={version:currentReadingVersion,syntheticPairs:120,totalResults:480,relations:{},invariants:{generationErrors:0,unmappedFacts:0,traitMismatch:0,nonNullScores:0,factChanges:0,unknownHourFacts:0,categoryLeak:0,publicChangesWithinCategory:0},samples:[]};
for(const relation of relations){
 const results:Reading[]=[];
 for(let i=0;i<120;i++){
  const j=(i*37+17)%120,c={charts:{me:charts[i],other:charts[j]},relation};
  try{
   const r=readingForVersion(currentReadingVersion,c),old=readingForVersion('chunbae-everyday-copy-v6',c);results.push(r);
   for(const person of r.wholeChart!.people){
    const ids=new Set(person.narrative!.flatMap(t=>t.evidenceIds));
    metrics.invariants.unmappedFacts+=person.evidence.filter(e=>!ids.has(e.id)).length;
    metrics.invariants.traitMismatch+=person.narrative!.filter(t=>!person.summary.strength.includes(t.habit)||!person.summary.watch.includes(t.risk)||!person.summary.affection.includes(t.need)).length;
   }
   if(r.score!==null)metrics.invariants.nonNullScores++;
   if(JSON.stringify(r.wholeChart!.people.map(p=>p.evidence))!==JSON.stringify(old.wholeChart!.people.map(p=>p.evidence)))metrics.invariants.factChanges++;
   if(r.wholeChart!.people.some(p=>p.omittedPositions.includes('hour')&&p.evidence.some(e=>e.position==='hour')))metrics.invariants.unknownHourFacts++;
   if(relation!=='연인'&&/데이트|사랑받|애정|결혼/.test(body(r)))metrics.invariants.categoryLeak++;
   if(JSON.stringify(publicCard(['가','나'],r))!==JSON.stringify(publicCard(['가','나'],results[0])))metrics.invariants.publicChangesWithinCategory++;
   if(i===0)metrics.samples.push({relation,inputs:[people[i],people[j]].map(({year,month,day,hour,minute,timeKnown})=>({year,month,day,hour,minute,timeKnown})),people:r.wholeChart!.people.map(p=>({summary:p.summary,anchor:p.anchor})),summary:r.wholeChart!.pair.summary,sections:r.wholeChart!.pair.sections,closing:r.interpretation!.closing});
  }catch(e){metrics.invariants.generationErrors++;}
 }
 metrics.relations[relation]={count:results.length,uniqueBodies:new Set(results.map(body)).size,uniquePersonalTitles:new Set(results.flatMap(r=>r.wholeChart!.people.map(p=>p.summary.title))).size,legacyAnchorPositionsNotUsed:histogram(results.flatMap(r=>r.wholeChart!.people.map(p=>`${p.anchor?.position}:${p.anchor?.layer}`))),legacyFirstCommonNotUsed:histogram(results.map(r=>r.wholeChart!.pair.commonFamilies[0]??'none')),sections:Object.fromEntries(results[0].wholeChart!.pair.sections.map(s=>[s.id,{unique:new Set(results.map(r=>section(r,s.id).text)).size,largestDuplicateGroup:histogram(results.map(r=>section(r,s.id).text))[0][1]}])),duplicatedFinalAdvice:results.filter(r=>section(r,'together').text===r.interpretation!.relationship.suggestion).length,duplicatedPersonalHelp:results.filter(r=>r.wholeChart!.people[0].summary.work===section(r,'gift-me').text&&r.wholeChart!.people[1].summary.work===section(r,'gift-other').text).length,averageCharsIncludingJsonKeys:Math.round(results.reduce((n,r)=>n+r.wholeChart!.people.map(p=>p.summary.text+p.summary.strength+p.summary.watch).join('').length+body(r).length+JSON.stringify(r.interpretation!.relationship).length,0)/results.length)};
}
metrics.hourSensitivity=[];
for(let i=0;i<10;i++){
 const me={...people[i],year:'1990',timeKnown:true},other=charts[17];
 const results=Array.from({length:12},(_,h)=>readingForVersion(currentReadingVersion,{charts:{me:chart({...me,hour:String(h*2),minute:'30'}),other},relation:'연인'}));
 const groups=new Map<string,number[]>();results.forEach((r,h)=>{const key=body(r);groups.set(key,[...(groups.get(key)??[]),h*2]);});
 metrics.hourSensitivity.push({date:[me.year,me.month,me.day].join('-'),distinctCharts:new Set(results.map(r=>JSON.stringify(r.wholeChart!.people[0].evidence))).size,distinctPersonalTraits:new Set(results.map(r=>r.wholeChart!.people[0].summary.strength)).size,distinctPairBodies:groups.size,identicalHours:[...groups.values()].filter(g=>g.length>1),distinctObservationSets:new Set(results.map(r=>JSON.stringify(r.wholeChart!.pair.observations))).size});
}
writeFileSync(new URL('../../docs/audits/reading-v8-output-audit.json',import.meta.url),JSON.stringify(metrics,null,2)+'\n');
const {samples,...report}=metrics;
console.log(JSON.stringify(report,null,2));
