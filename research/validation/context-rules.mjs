import {readFileSync} from 'node:fs';
const source = JSON.parse(readFileSync(new URL('./fixtures/reading-sources/context-source.json',import.meta.url)));
const freeze = obj => {
  if (obj && typeof obj === 'object') {Object.values(obj).forEach(freeze); Object.freeze(obj);}
  return obj;
};
export const contextCatalog = freeze({
  version:'month-combination-context-research-v1', productionApproved:false,
  definitionReview:{status:'source-collated',reviewer:'Codex',date:'2026-10-19'},
  interpretationReview:{status:'pending'},
  rules:[
    ['month-exposure',[26,27]],['root-context',[21,22]],['month-not-whole-strength',[21]],
    ['intervening-stem',[20]],['distant-pair',[20]],['day-involvement',[20]],
    ['multiple-partners',[20]],['coexisting-branch-relations',[22,23]],['month-as-context',[23]],
  ].map(([id,pdfPages]) => ({id,effect:'record-context-only',
    source:{id:source.sourceId,pdfSha256:source.pdfSha256,pdfPages,sectionId:id}})),
  unresolved:['Seasonal strength and root grades','Complete 合化 conditions and conflict priority',
    'Cross-profile interpretation','Compatibility weights and comparable map scale'],
});
export const contextSource = id => {
  const rule=contextCatalog.rules.find(r => r.id === id);
  if (!rule) throw new Error('UNKNOWN_CONTEXT_RULE');
  return {...rule.source,pdfPages:[...rule.source.pdfPages]};
};
