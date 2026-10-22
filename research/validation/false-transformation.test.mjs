import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {falseTransformationSource,reviewFalseTransformationReference} from './false-transformation-review.mjs';
import {referenceProfile} from './beta-quality-pack.mjs';
import {synthesizeProfile} from './whole-chart-synthesis.mjs';
const source=falseTransformationSource();
test('假化 scans preserve pinned pages, visual transcription and separate combination/transformation terms',()=>{
 assert.deepEqual(source.source.pages.map(p=>p.pdfPage),[384,385,386]);
 for(const p of source.source.pages)assert.equal(createHash('sha256').update(readFileSync(new URL('./fixtures/reading-sources/'+p.file,import.meta.url))).digest('hex'),p.sha256);
 assert.match(source.excerpt.text,/合神不真而日主無根/);assert.match(source.excerpt.text,/化神有餘而日帶根苗/);
 assert.deepEqual(source.cases[0].pillars,['기묘','갑술','갑자','기사']);assert.deepEqual(source.cases[1].pillars,['갑자','병자','갑신','기사']);
 // Restore the published general source instead of mutating module state through a returned object.
 const copy=falseTransformationSource();copy.cases[0].sourceTerm='真化';assert.equal(falseTransformationSource().cases[0].sourceTerm,'假化');
});
test('exact 假化 cases retain source terms without deciding general strength, moderation or transformation',()=>{
 for(const c of source.cases){
  const p=referenceProfile(c),r=reviewFalseTransformationReference(p),whole=synthesizeProfile(p);
  assert.equal(r.sourceClassification.id,c.id);assert.equal(r.sourceClassification.sourceTerm,'假化');
  assert.equal(whole.reviews.falseTransformationReference.sourceClassification.id,c.id);
  for(const k of ['transformationEstablished','originalDayStrength','moderation','score'])assert.equal(r[k],null);
  assert.ok(whole.decisions.every(d=>d.value===null));
 }
});
test('unknown hours, candidate alternatives and one-pillar mutations never inherit source verdicts',()=>{
 for(const c of source.cases){
  const p=referenceProfile(c),unknown={...p,timeKnown:false,pillars:{...p.pillars,hour:null}};
  assert.equal(reviewFalseTransformationReference(unknown).sourceClassification,null);
  const uncertain={...p,pillars:{...p.pillars,hour:null},candidates:{hour:[c.pillars[3],'기축']}};
  assert.equal(reviewFalseTransformationReference(uncertain).sourceClassification,null);
  for(const pos of ['year','month','day','hour'])assert.equal(reviewFalseTransformationReference({...p,pillars:{...p.pillars,[pos]:'병인'}}).sourceClassification,null);
 }
});
test('new source cases pass independent month/hour anchors without claiming real birth records',()=>{
 const anchors=JSON.parse(readFileSync(new URL('./fixtures/reading-sources/month-hour-anchors.json',import.meta.url))),han='甲乙丙丁戊己庚辛壬癸',ko='갑을병정무기경신임계';
 const expected=(kind,stem,offset)=>{const a=anchors[kind].anchors.find(a=>a.stems.includes(han[ko.indexOf(stem)]));return ko[(han.indexOf(a.start)+offset)%10];};
 for(const {pillars:p} of source.cases){assert.equal(p[1][0],expected('month',p[0][0],'인묘진사오미신유술해자축'.indexOf(p[1][1])));assert.equal(p[3][0],expected('hour',p[2][0],'자축인묘진사오미신유술해'.indexOf(p[3][1])));}
});
