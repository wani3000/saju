import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildBetaQualityPack} from './beta-quality-pack.mjs';
export function renderBetaQuality(r) {
 const lines=['# 비공개 베타 범위와 풀이 품질 검토','','범위: 점수 없는 일간 오행·공통 합충 기호·관계별 대화 제안. 실결제·강약/합화 최종 판정·공개 출시는 제외합니다.','',
  `문장·조건 사례 ${r.cases.length}개, 원문 기준 ${r.sourceReferenceBank.length}명조. 원문·편집·기술 검토는 Codex가 수행했으며 명리 전문가·실제 사용자 검토를 대신하지 않습니다.`,
  '','## 원문 대표 사례','','| 사례 | 원문 판어 | 쪽 |','|---|---|---|'];
 for(const c of r.sourceReferenceBank)lines.push(`| ${c.id} | ${c.sourceLabel} | ${c.pdfPage} |`);
 for(const c of r.cases){lines.push('',`## ${c.id}`,'',`검토 기준: ${c.expectation}`,'',c.reading.strength,'',c.reading.difference,'',`대화 제안: ${c.reading.advice}`,'',...c.reading.basis.cautions.map(t=>'- '+t),'',`기호 근거·범위·분량 자동 검사: ${Object.values(c.checks).every(Boolean)?'통과':'실패'}`);}
 lines.push('','## 실제 사용자 확인 질문','',...r.comprehensionQuestions.map(q=>`- ${q.question} → 기대 이해: ${q.expected}`),
  '',`실제 관찰 참여자: ${r.humanParticipantsObserved}명. 테스트 실행을 사용자 이해도 검증으로 표시하지 않습니다.`,
  '','[전체 검토 결과](beta-quality-audit.json) · [출시 범위·유료 전환 조건](../../../docs/beta-scope-and-quality.md)','');return lines.join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const flags=process.argv.slice(2);if(flags.some(f=>!['--check','--release-check'].includes(f)))throw new Error('UNKNOWN_ARGUMENT');
 const r=buildBetaQualityPack();if(!r.checksPassed)throw new Error('BETA_QUALITY_CHECK_FAILED');
 for(const [name,content]of [['beta-quality-audit.json',JSON.stringify(r,null,2)+'\n'],['beta-quality-drafts.md',renderBetaQuality(r)]]){
  const file=new URL('./reports/'+name,import.meta.url);if(flags.length){if(readFileSync(file,'utf8')!==content)throw new Error('BETA_QUALITY_AUDIT_STALE');}else writeFileSync(file,content);
 }
 console.log('PASS: 17 beta readings and 22 source references reproduce.');
 if(flags.includes('--release-check')){console.log('BLOCKED: expert, calendar, user-study and external pilot gates remain incomplete.');process.exitCode=2;}
}
