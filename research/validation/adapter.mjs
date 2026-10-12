/** Research-only adapter. Not approved for paid production readings. */
import {calculateFourPillars, lunarToSolar, solarToLunar} from './build/manseryeok.mjs';
import {resolveSeoulWallTime} from './resolve-wall-time.mjs';
const policy=Object.freeze({version:'research-midnight-v2',dayBoundary:'midnight',solarCorrection:false,productionApproved:false});
export function calculateProfile(input){
 if(!input || !['solar','lunar'].includes(input.calendar)) throw new Error('INVALID_CALENDAR');
 const {year,month,day}=input;
 for(const n of [year,month,day]) if(!Number.isInteger(n)) throw new Error('INVALID_DATE');
 if(year<1908 || year>2026) throw new Error('OUT_OF_RESEARCH_RANGE');
 if(typeof input.timeKnown!=='boolean') throw new Error('TIME_KNOWN_REQUIRED');
 if(typeof input.leap!=='boolean') throw new Error('LEAP_FLAG_REQUIRED');
 if(input.calendar==='solar' && input.leap) throw new Error('LEAP_REQUIRES_LUNAR');
 const solar=input.calendar==='lunar'?lunarToSolar(year,month,day,input.leap):{year,month,day};
 solarToLunar(solar.year,solar.month,solar.day); // actual date validation, no Date overflow normalization
 if(solar.year<1908 || solar.year>2026) throw new Error('OUT_OF_RESEARCH_RANGE');
 const base={...solar,dayBoundary:'midnight'};
 if(input.timeKnown){
  if(!Number.isInteger(input.hour)||!Number.isInteger(input.minute)) throw new Error('INVALID_TIME');
  const civilTime=resolveSeoulWallTime({...solar,hour:input.hour,minute:input.minute});
  if(civilTime.status==='nonexistent') throw new Error('NONEXISTENT_BIRTH_TIME');
  if(civilTime.status==='ambiguous') throw new Error('AMBIGUOUS_BIRTH_TIME');
  const chart=calculateFourPillars({...base,hour:input.hour,minute:input.minute}).toObject();
  return {solar,timeKnown:true,civilTime,pillars:chart,policy,limitations:['Historical wall-clock conversion is not yet production-validated.']};
 }
 if(input.hour!=null || input.minute!=null) throw new Error('UNKNOWN_TIME_HAS_VALUE');
 // Interval endpoints are probes, NOT an assumed birth time. Preserve ambiguity on term days.
 const start=calculateFourPillars({...base,hour:0,minute:0}).toObject();
 const end=calculateFourPillars({...base,hour:23,minute:59}).toObject();
 const pillars={}; const candidates={};
 for(const key of ['year','month','day']){
  const options=[...new Set([start[key],end[key]])];
  pillars[key]=options.length===1?options[0]:null;
  if(options.length>1)candidates[key]=options;
 }
 pillars.hour=null;
 return {solar,timeKnown:false,pillars,candidates,policy,limitations:['No hour pillar or hour-derived analysis.',...(Object.keys(candidates).length?['Solar-term boundary occurs on this date; no single year/month pillar is asserted.']:[])]};
}
