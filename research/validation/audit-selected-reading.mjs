import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chart} from './audit-extended-sources.mjs';
import {calculateProfile} from './adapter.mjs';
import {buildSelectedReading,selectedReadingPolicy} from './selected-reading.mjs';
export function buildSelectedAudit() {
 const first=chart({year:'갑자',month:'갑자',day:'갑자',hour:'갑자'});
 const second=chart({year:'기축',month:'기축',day:'기축',hour:'기축'});
 const uncertain={...first,pillars:{...first.pillars,day:null},candidates:{day:['갑자','병자']}};
 const coexisting={...second,pillars:{...second.pillars,day:'병오'}};
 const ordinary=calculateProfile({calendar:'solar',leap:false,timeKnown:false,year:1990,month:3,day:12});
 const boundary=calculateProfile({calendar:'solar',leap:false,timeKnown:true,year:1954,month:12,day:7,hour:23,minute:58});
 return {version:selectedReadingPolicy.version,productionApproved:false,policy:selectedReadingPolicy,
   fixtures:'Structural fixtures are synthetic, not calendar-valid birth charts. Integrated cases use synthetic dates.',
   cases:[...['친구','가족','연인','동료'].map(relation=>({id:relation,reading:buildSelectedReading(first,second,relation)})),
    {id:'no-common-pair',reading:buildSelectedReading(first,first,'친구')},
    {id:'candidate-dependent',reading:buildSelectedReading(uncertain,second,'친구')},
    {id:'coexisting-families',reading:buildSelectedReading(first,coexisting,'친구')},
    {id:'unknown-hour-calendar',reading:buildSelectedReading(ordinary,ordinary,'친구')},
    {id:'boundary-calendar',reading:buildSelectedReading(boundary,ordinary,'친구')} ]};
}
export function renderSelectedAudit(report) {
 const lines=['# 앱 연결용 기호 풀이 검토판','','채택 범위: 일간 오행과 연·월·일 기호의 합·충 관찰. 운영 계산·명리 해석 승인은 pending이며 점수는 제공하지 않습니다.',''];
 for(const c of report.cases){const r=c.reading;lines.push(`## ${c.id}`,'',r.strength,'',r.difference,'',`대화 제안: ${r.advice}`,'',r.basis.adviceNotice,'',...r.basis.cautions.map(t=>'- '+t),'');}
 lines.push('[기계 판독 결과](selected-reading-audit.json) · [채택 정책](../../../docs/selected-reading-release.md)','');return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const flags=process.argv.slice(2);if(flags.some(f=>!['--check','--release-check'].includes(f)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildSelectedAudit();for(const [name,content]of [['selected-reading-audit.json',JSON.stringify(r,null,2)+'\n'],['selected-reading-drafts.md',renderSelectedAudit(r)]]){
  const file=new URL('./reports/'+name,import.meta.url);if(flags.length){if(readFileSync(file,'utf8')!==content)throw new Error('SELECTED_READING_AUDIT_STALE');}else writeFileSync(file,content);
 }
 console.log('PASS: nine selected reading cases reproduce.');if(flags.includes('--release-check')){console.log('BLOCKED: calendar and domain interpretation production approval pending.');process.exitCode=2;}
}
