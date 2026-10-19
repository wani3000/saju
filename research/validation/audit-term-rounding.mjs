/** Provenance audit of the candidate's own upstream table, not an independent oracle. */
import lunar from 'lunar-javascript';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {getSolarTerm} from './build/manseryeok.mjs';
const {Solar,ShouXingUtil:S}=lunar;
const fixture=JSON.parse(readFileSync(new URL('./fixtures/naoj-terms.json',import.meta.url)));
const sensitivity=JSON.parse(readFileSync(new URL('./fixtures/naoj-sensitivity/sources.json',import.meta.url)));

export function auditTermRounding() {
  let checked=0;
  const mismatches=[], differences=[];
  for(let year=1908;year<=2026;year++) {
    const terms=Object.values(Solar.fromYmd(year,1,1).getLunar().getJieQiTable())
      .filter(s=>s.getYear()===year).sort((a,b)=>a.getJulianDay()-b.getJulianDay());
    if(terms.length!==24) throw new Error('UPSTREAM_TERM_COUNT');
    for(const [index,s] of terms.entries()) {
      const ms=Date.UTC(s.getYear(),s.getMonth()-1,s.getDay(),s.getHour(),s.getMinute(),s.getSecond())-8*3600000;
      const rounded=Math.round(ms/60000)*60000;
      const engine=getSolarTerm(year,index).date.getTime();
      checked++;
      if(rounded!==engine) mismatches.push({year,index,rounded,engine});
      const source=fixture.terms.find(t=>t.sourceYear===year&&t.index===index);
      if(!source||Date.parse(source.ut)===engine) continue;
      // Use a separate receiver to observe the exact delta-T argument without
      // mutating package globals or injecting that model into the application.
      let deltaT;
      const probe={...S,dtT(t){deltaT=S.dtT(t)*86400;return deltaT/86400;}};
      const unrounded=probe.qiAccurate2(s.getJulianDay()-2451545);
      const rawMs=(unrounded+2451545-2440587.5-1/3)*86400000;
      differences.push({year,index,sourceUT:source.ut,engineUTC:new Date(engine).toISOString(),
        upstreamSecondUTC:new Date(ms).toISOString(),roundingShiftSeconds:(rounded-ms)/1000,
        upstreamDeltaTSeconds:Number(deltaT.toFixed(6)),
        upstreamSubsecondUT:new Date(Math.round(rawMs)).toISOString(),
        naojDefaultDeltaTHeader:source.deltaT,
        naojControlled:sensitivity.filter(s=>s.year===year).map(s=>({
          deltaTInput:s.deltaTInput,deltaTDisplayed:s.deltaTDisplayed,ut:s.term.ut})),
      });
    }
  }
  return {upstream:'lunar-javascript@1.7.7 (same dependency as pinned engine generator)',
    range:[1908,2026],checked,roundingReproductionMismatches:mismatches,differences,
    productionApproved:false,
    conclusion:'The minute table reproduces upstream rounding; seconds near the 30-second threshold amplify small differences. Matching delta-T changes the 1954 displayed minute, but does not reconcile 1988 or 2024. NAOJ minute-only output cannot establish exact second errors or isolate the remaining model/time-scale differences.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=auditTermRounding();
  const serialized=JSON.stringify(report,null,2)+'\n';
  const output=new URL('./reports/term-rounding-audit.json',import.meta.url);
  if(process.argv.includes('--check')) {
    if(readFileSync(output,'utf8')!==serialized) throw new Error('ROUNDING_AUDIT_DRIFT');
  } else writeFileSync(output,serialized);
  console.log(JSON.stringify({checked:report.checked,roundingMismatches:report.roundingReproductionMismatches.length,differences:report.differences.length}));
}
