/** Research v5: source disagreement must not become a definite birth instant. */
import {calculateProfile as baseline} from './baseline-v4.mjs';
export {boundaryReviewSeconds} from './baseline-v4.mjs';

export function calculateProfile(input) {
  const result=baseline(input); // validates and normalizes lunar dates first
  const {year,month,day}=result.solar;
  const disputedDate=year===1954&&month===3&&(day===20||day===21);
  // IANA folds Mar 20 23:30..24:00; the National Archives describes the
  // transition at Mar 21 00:30. Existing IANA fold rejection remains in v4.
  // Also reject 00:00..00:30 pending gazette/old-vs-new clock review.
  // Do not silently patch the timezone table.
  if(disputedDate&&day===21&&input.timeKnown&&input.hour===0&&input.minute<30)
    throw new Error('HISTORICAL_CLOCK_SOURCE_DISPUTE');
  const review=disputedDate&&!input.timeKnown;
  return {...result,
    policy:Object.freeze({...result.policy,version:'research-civil-midnight-v5',
      historicalClockReview:'iana-2025b-archives-1954-v1'}),
    ...(review?{clockReview:{reason:'HISTORICAL_CLOCK_SOURCE_DISPUTE',
      sourceIds:['iana-2025b-asia','archives-1954'],instantConfirmed:false}}:{}),
    limitations:[...result.limitations,
      ...(year<1972?['Pre-1972 ISO Z values are proleptic timezone coordinates, not proof of a modern UTC realization.']:[]),
      ...(year===1908&&month<4?['Pre-standardization Seoul local mean time does not establish the recorded clock convention at every birthplace.']:[]),
      ...(review?['The 1954 transition time differs between sources. With unknown time, only date-based research output is retained; no birth instant is confirmed.']:[])]};
}
