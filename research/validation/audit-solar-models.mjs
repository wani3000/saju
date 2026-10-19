import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {preciseUpstreamTerm,nutationExperiment} from './term-precision.mjs';
import {getSolarTerm} from './build/manseryeok.mjs';
const reference=JSON.parse(readFileSync(new URL('./fixtures/jpl-de440s-terms.json',import.meta.url)));
const naoj=JSON.parse(readFileSync(new URL('./fixtures/naoj-terms.json',import.meta.url)));
const thresholds=JSON.parse(readFileSync(new URL('./fixtures/naoj-threshold/sources.json',import.meta.url)));
const second=(n)=>Number(n.toFixed(3));
const calendar=(ms)=>new Date(Math.round(ms)).toISOString().replace(/Z$/,'');
export const referenceTerms=reference.terms;
export function referenceUtMs(term,deltaTSeconds) {
  if(!Number.isFinite(deltaTSeconds)) throw new Error('DELTA_T_REQUIRED');
  return (term.ttJulianDay-2440587.5)*86400000-deltaTSeconds*1000;
}

export function auditSolarModels() {
  const offsets=[],doubleRounding=[];
  for(const term of reference.terms) {
    const upstream=preciseUpstreamTerm(term.year,term.index);
    const offset=(upstream.ttDaysSinceJ2000-(term.ttJulianDay-2451545))*86400;
    offsets.push({year:term.year,index:term.index,seconds:offset});
    const legacy=getSolarTerm(term.year,term.index).date.getTime();
    if(legacy!==upstream.singleRoundedMinuteMs) doubleRounding.push({
      year:term.year,index:term.index,unroundedUT:calendar(upstream.utEpochMs),
      publicSecondUT:calendar(upstream.publicSecondEpochMs),
      legacyMinuteUT:calendar(legacy),singleRoundedMinuteUT:calendar(upstream.singleRoundedMinuteMs),
    });
  }
  const naojMismatches=[];
  for(const term of naoj.terms) {
    const r=reference.terms.find(t=>t.year===term.sourceYear&&t.index===term.index);
    // This tests the source's printed yearly delta-T convention. It must not
    // be confused with a measured per-event historical UT1/UTC correction.
    const ut=referenceUtMs(r,parseFloat(term.deltaT));
    if(Math.round(ut/60000)*60000!==Date.parse(term.ut)) naojMismatches.push({year:r.year,index:r.index});
  }
  const cases=[[1988,18,'55','55.1'],[2024,21,'68.9','69']].map(([year,index,lowDt,highDt])=>{
    const term=reference.terms.find(t=>t.year===year&&t.index===index);
    const upstream=preciseUpstreamTerm(year,index);
    const later=thresholds.find(t=>t.year===year&&t.deltaTInput===lowDt);
    const earlier=thresholds.find(t=>t.year===year&&t.deltaTInput===highDt);
    const inferredLow=Date.parse(later.term.ut)-30000+Number(lowDt)*1000;
    const inferredHigh=Date.parse(earlier.term.ut)+30000+Number(highDt)*1000;
    const tt=referenceUtMs(term,0);
    const experiment=nutationExperiment(term);
    return {year,index,upstreamMinusReferenceSeconds:second(offsets.find(t=>t.year===year&&t.index===index).seconds),
      upstreamUTSameDeltaT:calendar(upstream.utEpochMs),referenceUTSameDeltaT:calendar(referenceUtMs(term,upstream.deltaTSeconds)),
      deltaTSeconds:upstream.deltaTSeconds,
      referenceTT:calendar(tt),
      naojTransition:{lowerDeltaT:lowDt,upperDeltaT:highDt,
        laterDisplayedUT:later.term.ut,earlierDisplayedUT:earlier.term.ut,
        assumption:'If the display rounds to the nearest minute, TT lies in [lower, upper). The CGI does not publish exact seconds.',
        inferredTTLower:calendar(inferredLow),inferredTTUpper:calendar(inferredHigh),
        referenceInsideConditionalInterval:tt>=inferredLow&&tt<inferredHigh},
      nutationSensitivity:Object.fromEntries(Object.entries(experiment).map(([k,v])=>[k,second(v)])),
      interpretation:'Small astronomical-model differences cross the 30-second rounding threshold. Nutation explains part, not all, of the offset; no evidence of a one-minute clock conversion error.',
    };
  });
  const worst=offsets.reduce((a,b)=>Math.abs(a.seconds)>Math.abs(b.seconds)?a:b);
  return {reference:'JPL DE440s / Skyfield 1.54 / IAU2000A, geocentric apparent solar longitude, TT',
    comparedTerms:offsets.length,years:[1908,2026],
    candidateMinusReferenceTT:{maxAbsoluteSeconds:second(Math.abs(worst.seconds)),worst:{...worst,seconds:second(worst.seconds)},
      meanAbsoluteSeconds:second(offsets.reduce((s,t)=>s+Math.abs(t.seconds),0)/offsets.length)},
    naojDisplayedMinuteCheck:{compared:naoj.terms.length,mismatches:naojMismatches,
      convention:'Reference TT minus NAOJ printed annual delta-T, nearest-minute display; agreement is not a UTC-second accuracy claim.'},
    cases,doubleRounding:{count:doubleRounding.length,cases:doubleRounding,
      correction:'Use the continuous root and round once for display. Both cases above retain a model difference after this correction; do not claim double rounding caused them.'},
    productionApproved:false,
    limitations:['JPL-derived roots are a computed independent reference, not measured birth-time truth.',
      'The local nutation substitution is a sensitivity experiment; residual ephemeris, precession, aberration and other model contributions are not individually isolated.',
      'The application retains its existing v4 boundary review window and immutable saved snapshots; these diagnostics do not silently replace its engine.'],
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=auditSolarModels(),serialized=JSON.stringify(report,null,2)+'\n';
  const file=new URL('./reports/solar-model-audit.json',import.meta.url);
  if(process.argv.includes('--check')) {if(readFileSync(file,'utf8')!==serialized) throw new Error('SOLAR_MODEL_AUDIT_DRIFT');}
  else writeFileSync(file,serialized);
  console.log(JSON.stringify({terms:report.comparedTerms,maxTTDifferenceSeconds:report.candidateMinusReferenceTT.maxAbsoluteSeconds,
    naojMismatches:report.naojDisplayedMinuteCheck.mismatches.length,doubleRoundingCases:report.doubleRounding.count,productionApproved:false}));
  if(process.argv.includes('--release-check')) process.exitCode=2;
}
