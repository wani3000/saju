/** Research-only symbol definitions. Pair membership is NOT 合化 or compatibility. */
import {readFileSync} from 'node:fs';

const source = JSON.parse(readFileSync(new URL('./fixtures/reading-sources/source.json', import.meta.url)));
const freeze = value => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
export const stems = '갑을병정무기경신임계';
export const branches = '자축인묘진사오미신유술해';
const hanStems = '甲乙丙丁戊己庚辛壬癸';
const hanBranches = '子丑寅卯辰巳午未申酉戌亥';
const families = [
  ['stem-combination', '천간 합', 'stem', '갑기 을경 병신 정임 무계', 23, 'stem-combinations'],
  ['branch-combination', '지지 육합', 'branch', '자축 인해 묘술 진유 사신 오미', 25, 'branch-combinations'],
  ['branch-clash', '지지 육충', 'branch', '자오 축미 인신 묘유 진술 사해', 26, 'branch-clashes'],
];
export const ruleCatalog = freeze({
  version: 'symbol-relations-research-v1',
  productionApproved: false,
  definitionReview: {status: 'source-collated', reviewer: 'Codex', date: '2026-10-19'},
  interpretationReview: {status: 'pending'},
  score: null,
  rules: families.flatMap(([family, label, component, pairs, pdfPage, sectionId]) =>
    pairs.split(' ').map(pair => {
      const alphabet = component === 'stem' ? stems : branches;
      const han = component === 'stem' ? hanStems : hanBranches;
      return {id: `${family}:${pair}`, family, label, component, symbols: [...pair],
        hanja: [...pair].map(s => han[alphabet.indexOf(s)]).join(''),
        source: {id: source.sourceId, pdfSha256: source.pdfSha256, pdfPage, sectionId},
        effect: 'classify-symbol-pair-only', interpretation: null, weight: null};
    })),
  stemElements: [...stems].map((symbol, i) => ({symbol, hanja: hanStems[i],
    element: ['목','화','토','금','수'][Math.floor(i / 2)],
    source: {id: source.sourceId, pdfSha256: source.pdfSha256, pdfPage: 23, sectionId: 'stem-elements'}})),
});

export function classifySymbols(component, first, second) {
  const alphabet = component === 'stem' ? stems : component === 'branch' ? branches : null;
  if (!alphabet || typeof first !== 'string' || typeof second !== 'string' ||
      first.length !== 1 || second.length !== 1 || !alphabet.includes(first) || !alphabet.includes(second)) {
    throw new Error('INVALID_SYMBOL_PAIR');
  }
  return ruleCatalog.rules.filter(r => r.component === component &&
    ((r.symbols[0] === first && r.symbols[1] === second) ||
     (r.symbols[1] === first && r.symbols[0] === second)));
}
