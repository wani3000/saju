/** Research definitions only. No strength, fate, personality or score model. */
import {readFileSync} from 'node:fs';
import {stems, branches, ruleCatalog} from './reading-rules.mjs';

const manifest = JSON.parse(readFileSync(new URL('./fixtures/reading-sources/natal-source.json', import.meta.url)));
const freeze = value => {
  if (value && typeof value === 'object') {Object.values(value).forEach(freeze); Object.freeze(value);}
  return value;
};
const source = (pdfPage, sectionId) => ({id:manifest.sourceId, pdfSha256:manifest.pdfSha256, pdfPage, sectionId});
const elements = ['목','화','토','금','수'];
const hanStems = '甲乙丙丁戊己庚辛壬癸';
const hanBranches = '子丑寅卯辰巳午未申酉戌亥';
const hidden = ['계','계신기','갑병무','을','을무계','경병무','정기','을기정','경임무','신','신정무','임갑'];
export const natalCatalog = freeze({
  version:'natal-definitions-research-v1', productionApproved:false,
  definitionReview:{status:'source-collated-with-explicit-terminology-policy', date:'2026-10-19', reviewer:'Codex'},
  terminologyReview:{status:'pending', policyId:'korean-ten-gods-research-v1',
    note:'비견/겁재 등 한국어 10분류 명칭은 연구 용어 정책이다. 원전의 敗財/劫財 방향 구분을 통합하지만 羊刃을 겁재로 치환하지 않는다.'},
  interpretationReview:{status:'pending'},
  hiddenStems:[...branches].map((branch, i) => ({branch, hanja:hanBranches[i],
    stems:[...hidden[i]], hanStems:[...hidden[i]].map(s => hanStems[stems.indexOf(s)]).join(''),
    order:'source-verse-only', weights:null, source:source(54,'hidden-stems')})),
  directions:[
    {delta:0, id:'same-element', labels:['비견','겁재'], sources:[source(52,'relation-directions'),source(112,'peer-terminology-variants')]},
    {delta:1, id:'day-produces-target', labels:['식신','상관'], sources:[source(51,'element-cycles'),source(57,'resource-output'),source(108,'food-god-examples')]},
    {delta:2, id:'day-controls-target', labels:['편재','정재'], sources:[source(51,'element-cycles'),source(56,'day-reference-officer-wealth'),source(107,'indirect-wealth-examples')]},
    {delta:3, id:'target-controls-day', labels:['편관','정관'], sources:[source(51,'element-cycles'),source(56,'day-reference-officer-wealth')]},
    {delta:4, id:'target-produces-day', labels:['편인','정인'], sources:[source(51,'element-cycles'),source(57,'resource-output')]},
  ],
  dayReferenceSource:source(56,'day-reference-officer-wealth'),
  monthContextSource:source(57,'month-context'),
  exclusions:['No seasonal day allocation or numeric weights','No 合化, strength, favorable element or outcome inference'],
});

export function stemDefinition(stem) {
  if (typeof stem !== 'string' || stem.length !== 1 || !stems.includes(stem)) throw new Error('INVALID_NATAL_STEM');
  const i = stems.indexOf(stem);
  return {stem, element:elements[Math.floor(i/2)], polarity:i%2 === 0 ? '양' : '음',
    source:{...ruleCatalog.stemElements[i].source}};
}

export function classifyTenGod(dayStem, targetStem) {
  const day = stemDefinition(dayStem), target = stemDefinition(targetStem);
  const delta = (elements.indexOf(target.element) - elements.indexOf(day.element) + 5) % 5;
  const rule = natalCatalog.directions.find(r => r.delta === delta);
  const samePolarity = day.polarity === target.polarity;
  return {dayStem, targetStem, direction:rule.id, samePolarity,
    label:rule.labels[samePolarity ? 0 : 1], terminologyPolicy:natalCatalog.terminologyReview.policyId,
    sources:rule.sources.map(s => ({...s}))};
}
