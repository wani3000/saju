/** Verification only. TT -> UTC for ordinary instants covered by the IERS file.
 * Never reinterpret pre-1972 UT as modern UTC or normalize a leap second.
 */
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./fixtures/time-standards/Leap_Second.dat',import.meta.url),'utf8');
const expiry=source.match(/File expires on (\d+ \w+ \d{4})/);
if(!expiry) throw new Error('LEAP_SOURCE_EXPIRY_MISSING');
export const utcCoverageEnd=Date.parse(`${expiry[1]} 00:00:00 GMT`);
export const leapRows=source.split('\n').filter(s=>/^\s*\d/.test(s)).map(line=>{
  const [mjd,day,month,year,taiMinusUtc]=line.trim().split(/\s+/).map(Number);
  const utcMs=Date.UTC(year,month-1,day);
  if(utcMs!==(mjd-40587)*86400000) throw new Error('LEAP_DATE_MISMATCH');
  return {utcMs,taiMinusUtc,ttMs:utcMs+(taiMinusUtc+32.184)*1000};
});
export function ttEpochToUtcMs(ttMs) {
  if(!Number.isFinite(ttMs)||ttMs<leapRows[0].ttMs) throw new Error('PRE_1972_UTC_UNSUPPORTED');
  let active=leapRows[0];
  for(let i=1;i<leapRows.length;i++) {
    const next=leapRows[i];
    if(ttMs<next.ttMs) {
      if(ttMs>=next.ttMs-(next.taiMinusUtc-active.taiMinusUtc)*1000)
        throw new Error('LEAP_SECOND_NOT_REPRESENTABLE');
      break;
    }
    active=next;
  }
  const utcMs=ttMs-(active.taiMinusUtc+32.184)*1000;
  if(utcMs>=utcCoverageEnd) throw new Error('LEAP_SOURCE_EXPIRED_FOR_INSTANT');
  return utcMs;
}
export function termUtcMs(term) {
  return ttEpochToUtcMs((term.ttJulianDay-2440587.5)*86400000);
}
