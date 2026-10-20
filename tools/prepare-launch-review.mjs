/** Deterministic, offline handoff. Templates are never approval or participant evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = new URL('../', import.meta.url);
const load = file => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const digest = file => createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex');
export function validateLaunchBaseline({ readiness, quality, scope, policy }) {
  if (readiness.status !== 'blocked' || readiness.publicReleaseApproved !== false || readiness.realChargesEnabled !== false ||
      quality.humanParticipantsObserved !== 0 || scope.review.expertInterpretationSignoff !== 'not-completed')
    throw new Error('REVIEW_BASELINE_CHANGED_REQUIRES_RECONCILIATION');
  if (policy.productionApproved !== false || policy.engineVersion !== readiness.engineVersion || policy.readingVersion !== scope.readingVersion ||
      JSON.stringify(policy.comparisonPositions) !== JSON.stringify(scope.comparisonPositions))
    throw new Error('INPUT_POLICY_SCOPE_DRIFT');
}
export function validateExecutionDecision(decision) {
  if (decision.version !== 'launch-execution-v1' ||
      JSON.stringify(decision.sequence) !== JSON.stringify(['calculation-and-reading-review', 'external-auth-and-payment', 'operations']) ||
      decision.userComprehension?.status !== 'skipped-by-user' || decision.userComprehension.completed !== false ||
      decision.userComprehension.observedParticipants !== 0 || decision.publicReleaseApproved !== false || decision.realChargesEnabled !== false)
    throw new Error('EXECUTION_DECISION_REQUIRES_RECONCILIATION');
  return decision;
}
export function buildLaunchPreparation() {
  const execution = validateExecutionDecision(load('docs/launch-execution.json'));
  const readiness = load('research/validation/reports/release-readiness.json');
  const quality = load('research/validation/reports/beta-quality-audit.json');
  const rescue = load('research/validation/reports/rescue-wangqi-audit.json');
  const scope = load('research/validation/beta-scope.json');
  const policy = load('web/content/research-policy.json');
  validateLaunchBaseline({ readiness, quality, scope, policy });
  const owners = {
    'calendar-policy': ['calculation-reviewer', 'docs/calculation-policy-candidate.md'],
    'expert-interpretation': ['human-domain-reviewer', 'docs/launch-review-kit.md'],
    'user-comprehension': ['research-facilitator-and-volunteers', 'docs/launch-review-kit.md'],
    'private-access': ['developer-and-host-operator', 'docs/launch-operations-runbook.md'],
    'external-auth': ['account-owner-and-developer-when-ready', 'docs/launch-operations-runbook.md'],
    'external-payment': ['merchant-owner-and-developer-when-ready', 'docs/launch-operations-runbook.md'],
    'paid-product': ['product-owner', 'docs/launch-operations-runbook.md'],
    'operations': ['service-owner-and-host-operator', 'docs/launch-operations-runbook.md'],
  };
  if (readiness.gates.length !== Object.keys(owners).length || readiness.gates.some(g => !owners[g.id]))
    throw new Error('RELEASE_GATE_SET_CHANGED');
  const row = (id, category, reference, question) => ({ id, category, reference, question,
    status: 'not-reviewed', finding: null, proposedChange: null, reviewerCode: null, reviewedOn: null });
  const expert = { kind: 'blank-template-not-review-evidence', version: 'launch-review-template-v1',
    engineVersion: readiness.engineVersion, readingVersion: readiness.readingVersion,
    instructions: 'Copy outside Git; use synthetic case IDs. Never record birth data, names, credentials or an unperformed signoff.',
    items: [
      ...quality.cases.map(c => row(c.id, 'beta-copy', 'research/validation/reports/beta-quality-drafts.md', c.expectation)),
      ...quality.sourceReferenceBank.map(c => row(c.id, 'source-reference', 'research/validation/reports/beta-quality-audit.json', 'Verify source attribution and limits; do not extrapolate a general verdict.')),
      ...rescue.references.map(c => row(c.id, 'transformation-reference', 'research/validation/reports/rescue-wangqi-drafts.md', 'Keep source-specific classification distinct from generic sufficient conditions.')),
      ...rescue.rescue.map(c => row(c.id, 'conditional-rescue', 'research/validation/reports/rescue-wangqi-drafts.md', 'Check frame, visible actors, conditions and unresolved effectiveness.')),
    ], findingsResolved: false, humanSignoff: null };
  const study = { kind: 'blank-template-not-participant-evidence', version: 'comprehension-session-v1',
    engineVersion: readiness.engineVersion, readingVersion: readiness.readingVersion,
    participantCode: null, voluntaryParticipationConfirmed: false, actualSessionOn: null,
    tasks: ['Enter synthetic self and partner data', 'Edit and resume after reload', 'Explain the result in own words',
      'Preview then share and revoke', 'Return to saved result without repurchase', 'Erase the synthetic account'],
    taskObservations: [],
    questions: quality.comprehensionQuestions.map((q, i) => ({ id: `Q${i+1}`, prompt: q.question, facilitatorExpected: q.expected, verbatimAnswer: null,
      understanding: 'not-observed', assistanceRequired: null })),
    privacyComprehension: { autosaveExplained: 'not-observed', publicAliasRiskExplained: 'not-observed' },
    barriers: [], followupRequired: null, completed: false };
  const sources = ['docs/launch-execution.json', 'web/content/research-policy.json', 'research/validation/beta-scope.json',
    'research/validation/reports/release-readiness.json', 'research/validation/reports/beta-quality-audit.json',
    'research/validation/reports/rescue-wangqi-audit.json'];
  const preparation = { version: 'launch-preparation-v1', status: 'prepared-for-review-not-approved',
    publicReleaseApproved: false, realChargesEnabled: false, humanParticipantsObserved: 0,
    policyId: policy.id, engineVersion: policy.engineVersion, readingVersion: policy.readingVersion,
    executionSequence: execution.sequence, skippedByUser: ['user-comprehension'], pendingGateIds: readiness.gates.filter(g => g.id !== 'user-comprehension').map(g => g.id),
    expertReviewItems: expert.items.length, sourceArtifacts: sources.map(file => ({ file, sha256: digest(file) })),
    gates: readiness.gates.map(g => ({ ...g,
      ...(g.id === 'user-comprehension' ? { status: 'skipped-by-user', reason: 'USER_STUDY_SKIPPED_BY_REQUEST',
        evidence: 'Explicit user instruction recorded in docs/launch-execution.json; 0 observed participants, no completed study.' } : {}),
      ownerRole: owners[g.id][0], nextStep: owners[g.id][1] })),
    validation: 'Template generation does not execute tests, certify policy, host a pilot or perform human review.' };
  return { preparation, expert, study };
}
export function renderLaunchPreparation(pack) {
  return new Map([
    ['docs/launch-preparation.json', JSON.stringify(pack.preparation, null, 2)+'\n'],
    ['docs/review-templates/expert-review.json', JSON.stringify(pack.expert, null, 2)+'\n'],
    ['docs/review-templates/user-session.json', JSON.stringify(pack.study, null, 2)+'\n'],
  ]);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== '--check')) throw new Error('UNKNOWN_ARGUMENT');
  const pack = buildLaunchPreparation();
  for (const [file, text] of renderLaunchPreparation(pack)) {
    if (args.length) {
      if (readFileSync(new URL(file, root), 'utf8') !== text) throw new Error('LAUNCH_PREPARATION_STALE: '+file);
    } else writeFileSync(new URL(file, root), text);
  }
  console.log(`PASS: ${pack.expert.items.length} blank review items; 0 observed participants; ${pack.preparation.pendingGateIds.length} pending gates; 1 user-requested skip (not a completed study).`);
}
