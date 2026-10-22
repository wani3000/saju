/** Reconcile current source versions with preserved launch evidence. No environment or service access. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {currentReadingVersion,readingForVersion} from '../src/server/readings';
import {engineVersion,chart} from '../src/server/engine';
import {samplePerson} from '../src/domain/model';
const root=new URL('../../',import.meta.url);
const load=(file:string)=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const launch=load('docs/launch-preparation.json'),policy=load('web/content/research-policy.json');
const synthesis=load('research/validation/reports/whole-chart-synthesis.json');
const conditions=load('research/validation/reports/condition-boundaries.json');
const ai=load('docs/audits/narration-offline-readiness.json');
if(launch.publicReleaseApproved!==false||launch.realChargesEnabled!==false||policy.productionApproved!==false||synthesis.metrics.version!==conditions.synthesisVersion)
 throw new Error('RELEASE_EVIDENCE_REQUIRES_RECONCILIATION');
const c=chart({...samplePerson(),year:'2024',month:'2',day:'10',timeKnown:true,hour:'10',minute:'30'});
const r=readingForVersion(currentReadingVersion,{charts:{me:c,other:c},relation:'친구'});
if(c.policy.version!==policy.engineVersion||r.ruleVersion!==currentReadingVersion||r.score!==null||r.basis?.productionApproved!==false)
 throw new Error('CURRENT_READING_POLICY_DRIFT');
const skipped=launch.gates.filter((g:any)=>g.status==='skipped-by-user');
const pending=launch.gates.filter((g:any)=>g.status!=='skipped-by-user');
if(!skipped.some((g:any)=>g.id==='user-comprehension')||launch.humanParticipantsObserved!==0)throw new Error('EXECUTION_DECISION_REQUIRES_RECONCILIATION');
const files=['web/src/server/db.ts','web/staging.env.example','web/next.config.ts','web/certs/supabase-prod-ca-2021.crt',
 'web/scripts/check-hosted-runtime.ts','web/scripts/check-hosted-restore.ts','web/scripts/hosted-restore-target.ts',
 'web/scripts/check-kakao-provider.ts','web/src/components/App.tsx','web/src/app/globals.css','web/content/journey-copy.json',
 'web/src/server/kakao-policy.ts','web/src/server/auth.ts','web/src/server/identity.ts','web/src/server/service.ts',
 'web/src/server/nicepay-webhook.ts','web/src/app/api/nicepay/webhook/route.ts',
 'web/src/server/nicepay.ts','web/src/server/nicepay-checkout.ts','web/src/app/api/nicepay/return/route.ts',
 'web/scripts/check-nicepay-roundtrip.ts','web/scripts/check-journey.mjs','web/tests/nicepay.test.ts','web/tests/nicepay-http.mjs',
 'web/src/app/api/[...path]/route.ts','web/src/app/auth/callback/route.ts','web/db/migrations/004_kakao_profile.sql',
 'web/src/components/ProfileHistory.tsx','web/src/domain/profile.ts','web/src/server/readings.ts','web/src/server/staging-preflight.ts','web/src/domain/coherent-reading.ts',
 'web/preview/controller.ts','web/content/research-policy.json','docs/launch-preparation.json',
 'research/validation/reports/whole-chart-synthesis.json','research/validation/reports/condition-boundaries.json',
 'docs/audits/narration-offline-readiness.json'];
const report={version:'release-source-inventory-v1',status:'source-inventory-only-not-production-approved',
 versions:{appEngineWrapper:engineVersion,calculationEngine:c.policy.version,appReading:currentReadingVersion,
  basePolicyReading:policy.readingVersion,preservedLaunchReviewReading:launch.readingVersion,researchSynthesis:synthesis.metrics.version},
 scopeDifferences:launch.readingVersion===currentReadingVersion?[]:['PRESERVED_REVIEW_PREDATES_CURRENT_READING'],
 knownHourSample:{includedPositions:r.wholeChart?.people[0].includedPositions,score:r.score},
 conditionAudit:conditions.metrics,
 aiEvidence:{source:'docs/audits/narration-offline-readiness.json',recordedApiCalls:ai.apiCalls,recordedQualityEvaluations:ai.qualityEvaluations,winner:ai.winner},
 pendingGateIds:pending.map((g:any)=>g.id),skippedByUser:skipped.map((g:any)=>g.id),humanParticipantsObserved:0,
 publicReleaseApproved:false,realChargesEnabled:false,
 environmentInspected:false,externalCalls:0,databaseConnections:0,
 sourceArtifacts:files.map(file=>({file,sha256:createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex')})),
 limitations:['This command checks source versions and one synthetic reading; it does not execute the full suites.',
  'Preserved v2 launch evidence is not a current-v8 expert signoff. No approval or observed user test is inferred.',
  'A public static preview does not verify hosted server access, auth, payments, backups or production operations.',
  'Offline AI preparation is not live-model quality or an active app integration.'],
};
const args=process.argv.slice(2);if(args.some(a=>a!=='--check')||args.length>1)throw new Error('UNKNOWN_ARGUMENT');
const file=new URL('docs/current-release-source-inventory.json',root),text=JSON.stringify(report,null,2)+'\n';
if(args.length){if(readFileSync(file,'utf8')!==text)throw new Error('RELEASE_SOURCE_INVENTORY_STALE');}else writeFileSync(file,text);
console.log(JSON.stringify({status:report.status,appReading:currentReadingVersion,researchSynthesis:report.versions.researchSynthesis,pendingGates:pending.length,skippedByUser:report.skippedByUser,externalCalls:0}));
