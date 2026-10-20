import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLaunchPreparation, renderLaunchPreparation, validateLaunchBaseline } from '../../tools/prepare-launch-review.mjs';
const root = new URL('../../', import.meta.url);
const load = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const baseline = () => ({ readiness: load('research/validation/reports/release-readiness.json'),
  quality: load('research/validation/reports/beta-quality-audit.json'), scope: load('research/validation/beta-scope.json'),
  policy: load('web/content/research-policy.json') });

test('launch worksheets reproduce source case inventory, preserve every gate and contain no fabricated reviews', () => {
  const pack = buildLaunchPreparation();
  assert.equal(pack.expert.items.length, 46);
  assert.equal(new Set(pack.expert.items.map(i => `${i.category}:${i.id}`)).size, 46);
  for (const item of pack.expert.items) {
    assert.equal(item.status, 'not-reviewed');
    assert.equal(item.reviewerCode, null);
    assert.equal(item.finding, null);
    assert.ok(readFileSync(new URL(item.reference, root)).length);
  }
  assert.equal(pack.study.completed, false);
  assert.equal(pack.study.actualSessionOn, null);
  assert.equal(pack.preparation.humanParticipantsObserved, 0);
  assert.equal(pack.preparation.gates.length, 8);
  assert.ok(pack.preparation.gates.every(g => g.status !== 'approved' && readFileSync(new URL(g.nextStep, root)).length));
  for (const [file, text] of renderLaunchPreparation(pack))
    assert.equal(readFileSync(new URL(file, root), 'utf8'), text);
});

test('changed human evidence or policy scope stops regeneration until evidence is reconciled', () => {
  for (const mutate of [
    b => b.quality.humanParticipantsObserved = 1,
    b => b.scope.review.expertInterpretationSignoff = 'approved',
    b => b.readiness.publicReleaseApproved = true,
    b => b.readiness.realChargesEnabled = true,
    b => b.policy.productionApproved = true,
    b => b.policy.readingVersion = 'unexpected-copy',
    b => b.policy.comparisonPositions.push('hour'),
  ]) {
    const b = baseline(); mutate(b);
    assert.throws(() => validateLaunchBaseline(b), /REQUIRES_RECONCILIATION|SCOPE_DRIFT/);
  }
});
