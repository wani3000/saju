import {writeFile} from 'node:fs/promises';
import {samplePerson} from '../src/domain/model';
import {validatePair} from '../src/server/engine';
import {currentReadingVersion,readingForVersion} from '../src/server/readings';

// Public, synthetic fixtures only. Never read accounts, saved results or service keys.
export function buildLandingSample() {
  const charts=validatePair({me:samplePerson(),other:samplePerson(true)}).charts;
  const relations=['연인','친구','가족','동료'] as const;
  const readings=relations.map(relation=>{
    const reading=readingForVersion(currentReadingVersion,{charts,relation});
    const whole=reading.wholeChart!;
    const section=(id:string)=>whole.pair.sections.find(s=>s.id===id)!.text;
    return {
      relation,
      people:whole.people.map((p,i)=>{
        // Same two situational traits used in this fixture's conversation below.
        const trait=p.narrative!.find(t=>t.role===(i?'편인':'상관'))!;
        return {name:i?'도하':'보라',scene:trait.scene,habit:trait.habit,risk:trait.risk};
      }),
      giftMe:section('gift-me').split('\n')[0],
      giftOther:section('gift-other').split('\n')[0],
      conversation:section('conversation').split('\n').slice(-4),
      together:section('together').split('\n')[0],
    };
  });
  return {kind:'synthetic-reading-excerpts',readingVersion:currentReadingVersion,fixtures:'samplePerson: solar 1990-03-12 / 1992-05-21; both hour unknown',readings};
}

if(process.argv[1]?.endsWith('prepare-landing-sample.ts')) {
  await writeFile(new URL('../content/landing-sample.json',import.meta.url),JSON.stringify(buildLandingSample(),null,2)+'\n');
  console.log('Prepared public synthetic landing excerpts. No account data accessed.');
}
