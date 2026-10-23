import {test} from 'node:test';
import assert from 'node:assert/strict';
import sample from '../content/landing-sample.json';
import {buildLandingSample} from '../scripts/prepare-landing-sample';

test('public landing excerpts stay tied to synthetic current readings and their matching personal traits',()=>{
  assert.deepEqual(sample,buildLandingSample(),'Regenerate with tsx scripts/prepare-landing-sample.ts when the active reading changes');
  assert.deepEqual(sample.readings.map(r=>r.relation),['연인','친구','가족','동료']);
  assert.doesNotMatch(JSON.stringify(sample),/"(?:id|createdAt|profile|token|order|score)"/);
  for(const reading of sample.readings){
    assert.match(reading.people[0].habit,/솔직하게 말/);
    assert.match(reading.people[1].habit,/혼자 생각/);
    assert.match(reading.conversation[0],/끝까지 들어/);
    assert.match(reading.conversation[2],/생각할 시간/);
  }
  assert.equal(new Set(sample.readings.map(r=>r.together)).size,4);
});
