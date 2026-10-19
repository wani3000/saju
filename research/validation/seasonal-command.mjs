/** A literal nominal-day source scheme; distinct from hidden stems and whole-chart strength. */
import {readFileSync} from 'node:fs';
import {calculateProfile,boundaryReviewSeconds} from './adapter.mjs';
import {getSolarTermsOfYear} from './build/manseryeok.mjs';
import {resolveSeoulDate} from './resolve-wall-time.mjs';
const manifest=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/seasonal-source.json',import.meta.url)));
const freeze=value=>{if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export const seasonalSource=(sectionId,pdfPages)=>({id:manifest.sourceId,pdfSha256:manifest.pdfSha256,
  transcriptionSha256:manifest.transcriptionSha256,sectionId,pdfPages:[...pdfPages]});
const table=[['자',[['임',10],['계',20]]],['축',[['계',9],['신',3],['기',18]]],
  ['인',[['무',7],['병',7],['갑',16]]],['묘',[['갑',10],['을',20]]],
  ['진',[['을',9],['계',3],['무',18]]],['사',[['경',9],['병',16],['무',5]]],
  ['오',[['병',10],['정',10],['기',9]]],['미',[['정',9],['을',3],['기',18]]],
  ['신',[['기',7],['무',3],['임',3],['경',17]]],['유',[['경',10],['신',20]]],
  ['술',[['신',9],['정',3],['무',18]]],['해',[['무',7],['갑',5],['임',18]]]];
export const seasonalCatalog=freeze({version:'yuanhai-command-nominal-days-v1',productionApproved:false,
  dayPolicy:'elapsed-86400-seconds; half-open intervals; no stretching or terminal clamping',
  source:seasonalSource('command-allocation',[53,54]),
  months:table.map(([branch,parts])=>{let end=0;return {branch,
    segments:parts.map(([stem,days])=>{const start=end;end+=days;return {stem,days,startDay:start,endDay:end};}),
    nominalDays:end,status:end===30?'source-scheme':'source-duration-conflict'};})});
export function commandForRange(branch,startDay,endDay) {
  const entry=seasonalCatalog.months.find(m=>m.branch===branch);
  if(!entry || !Number.isFinite(startDay) || !Number.isFinite(endDay) || startDay<0 || endDay<=startDay || endDay>366)
    throw new Error('INVALID_COMMAND_RANGE');
  const source=structuredClone(seasonalCatalog.source);
  if(entry.status==='source-duration-conflict') return {branch,status:entry.status,candidateStems:[],confirmedStem:null,
    unallocated:true,source,nominalDays:entry.nominalDays};
  const candidateStems=entry.segments.filter(s=>startDay<s.endDay && endDay>s.startDay).map(s=>s.stem);
  const unallocated=endDay>30;
  return {branch,status:unallocated?'outside-source-scheme':candidateStems.length===1?'single-command':'command-boundary',
    candidateStems,confirmedStem:!unallocated && candidateStems.length===1?candidateStems[0]:null,unallocated,source,nominalDays:30};
}

// Only birth input enters this public calculation path; supplied profile/command fields cannot override it.
export function calculateSeasonalCommand(input) {
  const profile=calculateProfile(input),branches=[...new Set(profile.pillars.month===null?
    profile.candidates.month.map(p=>p[1]):[profile.pillars.month[1]])].sort();
  const base={ruleVersion:seasonalCatalog.version,engineVersion:profile.policy.version,productionApproved:false,
    elapsedPolicy:seasonalCatalog.dayPolicy,source:structuredClone(seasonalCatalog.source),
    reviewMarginSeconds:boundaryReviewSeconds,verifiedErrorBound:false,
    timeKnown:profile.timeKnown,monthBranches:branches,confirmedStem:null};
  // Do not borrow the prior month's elapsed range for a different month candidate.
  if(profile.clockReview) return {...base,status:'historical-clock-review',alternatives:[]};
  if(branches.length!==1 || profile.boundaryReview) return {...base,status:'solar-term-boundary-review',alternatives:[]};
  const intervals=profile.timeKnown?[{startUTCms:Date.parse(profile.civilTime.candidates[0].utc),
    endUTCms:Date.parse(profile.civilTime.candidates[0].utc)+60000}]:resolveSeoulDate(profile.solar).intervals;
  const terms=[profile.solar.year-1,profile.solar.year,profile.solar.year+1]
    .flatMap(y=>getSolarTermsOfYear(y)).filter(t=>t.index%2===0).sort((a,b)=>a.date-b.date);
  const alternatives=intervals.map(interval=>{
    const previous=terms.filter(t=>t.date.getTime()<=interval.startUTCms).at(-1);
    if(!previous) throw new Error('MISSING_COMMAND_TERM');
    const margin=boundaryReviewSeconds*1000;
    const startDay=(interval.startUTCms-previous.date.getTime()-margin)/86400000;
    const endDay=(interval.endUTCms-previous.date.getTime()+margin)/86400000;
    if(startDay<0) throw new Error('COMMAND_MONTH_BOUNDARY_UNGUARDED');
    return commandForRange(branches[0],startDay,endDay);
  });
  const confirmed=alternatives[0]?.confirmedStem;
  return {...base,status:alternatives.some(a=>a.unallocated)?'source-scheme-unresolved':
    confirmed && alternatives.every(a=>a.confirmedStem===confirmed)?'single-command':'command-boundary',
    confirmedStem:confirmed && alternatives.every(a=>a.confirmedStem===confirmed)?confirmed:null,alternatives};
}
