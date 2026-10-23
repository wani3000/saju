// Approved product defaults, not proof of publication, legal review or deployment.
export const servicePolicy = Object.freeze({
  version: "2026-10-23-v1",
  draftDays: 30,
  operationalLogDays: 30,
  goodwillRefundDays: 7,
  backupDays: 7,
  healthIntervalMinutes: 5,
  pendingPaymentMinutes: 10,
  backupOverdueMinutes: 120,
  notificationDedupMinutes: 30,
});

// Preserve a revision marker: recycling revisions would let an old tab overwrite
// a new draft after expired personal content was removed.
export const activeDraftCondition = `updated_at > now()-interval '${servicePolicy.draftDays} days' AND data <> '{}'::jsonb`;
export const activeStoredDraftCondition = `drafts.updated_at > now()-interval '${servicePolicy.draftDays} days' AND drafts.data <> '{}'::jsonb`;

export function goodwillRefundAssessment(paidAt: string | null, now: string) {
  const current = Date.parse(now), paid = paidAt === null ? NaN : Date.parse(paidAt);
  if (!Number.isFinite(current) || !Number.isFinite(paid) || paid > current)
    return { decision: "manual_review", code: "VERIFIED_PAYMENT_TIME_REQUIRED" } as const;
  if (current - paid <= servicePolicy.goodwillRefundDays * 86400000)
    return { decision: "full_refund", code: "WITHIN_GOODWILL_WINDOW" } as const;
  // The voluntary period ending never means statutory rights ended.
  return { decision: "manual_review", code: "CHECK_STATUTORY_RIGHTS_AND_SERVICE_FAILURE" } as const;
}
