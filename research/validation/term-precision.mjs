/** Candidate-model diagnostics only. Never import this into the app adapter. */
import lunar from 'lunar-javascript';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
if(require('lunar-javascript/package.json').version !== '1.7.7') throw new Error('UPSTREAM_VERSION_DRIFT');
const {Solar,ShouXingUtil:S}=lunar;
const cache=new Map();
const J2000=2451545, UNIX_JD=2440587.5, DAY=86400000;

export function preciseUpstreamTerm(year,index) {
  if(!Number.isInteger(year)||year<1908||year>2026||!Number.isInteger(index)||index<0||index>23)
    throw new Error('INVALID_TERM');
  if(!cache.has(year)) {
    const terms=Object.values(Solar.fromYmd(year,1,1).getLunar().getJieQiTable())
      .filter(s=>s.getYear()===year).sort((a,b)=>a.getJulianDay()-b.getJulianDay());
    if(terms.length!==24) throw new Error('UPSTREAM_TERM_COUNT');
    cache.set(year,terms);
  }
  const s=cache.get(year)[index];
  let ttDays,deltaTSeconds;
  const probe={...S,dtT(t){ttDays=t;deltaTSeconds=S.dtT(t)*86400;return deltaTSeconds/86400;}};
  probe.qiAccurate2(s.getJulianDay()-J2000);
  // Preserve the continuous root: Solar's integer-second API must not be the
  // input to a second rounding step when preparing a minute-level comparison.
  const utEpochMs=(J2000-UNIX_JD+ttDays)*DAY-deltaTSeconds*1000;
  const publicSecondEpochMs=Date.UTC(s.getYear(),s.getMonth()-1,s.getDay(),s.getHour(),s.getMinute(),s.getSecond())-8*3600000;
  return {ttDaysSinceJ2000:ttDays,deltaTSeconds,utEpochMs,publicSecondEpochMs,
    singleRoundedMinuteMs:Math.round(utEpochMs/60000)*60000};
}

export function nutationExperiment(reference) {
  const t=(reference.ttJulianDay-J2000)/36525;
  const angle=Math.round(S.saLon(t,-1)/(Math.PI/12))*Math.PI/12;
  const original=S.saLonT(angle);
  // A constant equal to full IAU2000A at the reference root isolates a local
  // sensitivity, not a replacement astronomical model for other dates.
  const replacement={...S,nutationLon2(){return reference.nutationLongitudeRadians;}}.saLonT(angle);
  return {
    nutationTerms:S.NUT_B.length/5,
    longitudeDifferenceArcseconds:(S.nutationLon2(t)-reference.nutationLongitudeRadians)*S.SECOND_PER_RAD,
    replacementShiftSeconds:(replacement-original)*36525*86400,
    residualAfterReplacementSeconds:(replacement-t)*36525*86400,
  };
}
