import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {auditTermRounding} from './audit-term-rounding.mjs';

test('all 2856 supported terms reproduce the pinned upstream rounding without table corruption', () => {
  const report=auditTermRounding();
  assert.deepEqual(report,JSON.parse(readFileSync(new URL('./reports/term-rounding-audit.json',import.meta.url))));
  assert.equal(report.checked,2856);
  assert.deepEqual(report.roundingReproductionMismatches,[]);
  assert.deepEqual(report.differences.map(d=>d.roundingShiftSeconds),[-29,30,29]);
  assert.equal(report.productionApproved,false);
});

test('controlled NAOJ queries preserve custom delta-T inputs and source hashes', () => {
  const controls=JSON.parse(readFileSync(new URL('./fixtures/naoj-sensitivity/sources.json',import.meta.url)));
  assert.equal(controls.length,6);
  for(const source of controls) {
    assert.equal(new URL(source.url).searchParams.get('dtm'),'99');
    assert.equal(new URL(source.url).searchParams.get('dt'),source.deltaTInput);
    assert.equal(createHash('sha256').update(readFileSync(new URL(`./fixtures/naoj-sensitivity/${source.file}`,import.meta.url))).digest('hex'),source.sha256);
  }
  const report=auditTermRounding();
  assert.deepEqual(report.differences.map(d=>d.naojControlled[1].ut===d.engineUTC.replace('.000','')),[true,false,false]);
});
