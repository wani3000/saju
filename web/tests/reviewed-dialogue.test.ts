import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chart} from '../src/server/engine';
import {samplePerson,publicCard} from '../src/domain/model';
import {readingForVersion,currentReadingVersion} from '../src/server/readings';
import {addReviewedDialogue,reviewedDialogueVersion} from '../src/domain/reviewed-dialogue';
import {coherentReadingVersion} from '../src/domain/coherent-reading';

for(const relation of ['친구','연인','가족','동료'])test(`${relation}: duplicate dialogue is shortened without reinterpreting v8 facts or private/public snapshots`,()=>{
  const c=chart({...samplePerson(),year:'1981',month:'7',day:'10'}),context={charts:{me:c,other:c},relation};
  const old=readingForVersion(coherentReadingVersion,context),before=structuredClone(old);
  const next=readingForVersion(currentReadingVersion,context);
  assert.equal(currentReadingVersion,reviewedDialogueVersion);
  const section=(r:typeof old)=>r.wholeChart!.pair.sections.find(s=>s.id==='conversation')!;
  assert.equal(section(old).text.split('\n').slice(-4).filter(s=>s.includes('내가 고를 수 있는')).length,2);
  assert.equal(section(next).text.split('\n').slice(-2).filter(s=>s.includes('내가 고를 수 있는')).length,1);
  assert.deepEqual(old,before);assert.deepEqual(readingForVersion(coherentReadingVersion,context),before);
  const normalized=structuredClone(next);normalized.ruleVersion=old.ruleVersion;normalized.wholeChart!.version=old.wholeChart!.version;
  normalized.wholeChart!.pair.sections.find(s=>s.id==='conversation')!.text=section(old).text;
  assert.deepEqual(normalized,old);
  const card=publicCard(['가','나'],next);card.reading.ruleVersion=old.ruleVersion;
  assert.deepEqual(card,publicCard(['가','나'],old));
});
test('different requests or different replies are retained; malformed review context fails',()=>{
  const c=chart(samplePerson()),base=readingForVersion(coherentReadingVersion,{charts:{me:c,other:c},relation:'친구'});
  for(const text of ['설명\n자네: “질문”\n상대: “답”\n상대: “다른 질문”\n자네: “답”','설명\n자네: “질문”\n상대: “답”\n상대: “질문”\n자네: “다른 답”']){
    const fixture=structuredClone(base);fixture.wholeChart!.pair.sections.find(s=>s.id==='conversation')!.text=text;
    assert.equal(addReviewedDialogue(fixture).wholeChart!.pair.sections.find(s=>s.id==='conversation')!.text,text);
  }
  assert.throws(()=>addReviewedDialogue({...base,ruleVersion:'example-copy-v1'}));
});
