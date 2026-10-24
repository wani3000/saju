import { z } from "zod";
import { servicePolicy } from "./service-policy";

const timestamp = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const alertCodes = ["HEALTH_UNAVAILABLE", "FAILED_JOBS", "EXPIRED_LEASES", "DELAYED_QUEUE", "PAYMENT_OVERDUE", "PAYMENT_AGE_UNKNOWN", "BACKUP_OVERDUE", "RETENTION_OVERDUE", "WITHDRAWAL_REVIEW_REQUIRED"] as const;
const codes = alertCodes;
const code = z.enum(codes);
const healthSchema = z.object({
  mode: z.literal("research"), status: z.enum(["ok", "needs_attention"]),
  reasons: z.array(z.enum(["FAILED_JOBS", "EXPIRED_LEASES", "DELAYED_QUEUE", "PENDING_PAYMENTS", "WITHDRAWAL_REVIEW_REQUIRED"])).max(5),
  jobs: z.object({ queued: count, delayedQueued: count, oldestQueuedComparisonSeconds: count,
    running: count, failed: count, expiredLeases: count, oldestExpiredLeaseSeconds: count }).strict(),
  payments: z.object({ confirming: count, confirmationUnknown: count, refundPending: count,
    oldestPendingOrderSeconds: count, overduePending: count, unknownPendingAge: count }).strict(),
  // Older saved observations remain readable, but cannot prove recovery.
  withdrawals: z.object({pending:count,reviewRequired:count}).strict().optional(),
}).strict();
export const alertObservationSchema = z.object({
  kind: z.literal("operations-observation-v1"), at: timestamp,
  health: healthSchema.nullable(),
  // null is an explicitly missing verified success, not a successful backup.
  lastVerifiedBackupAt: timestamp.nullable(), lastRetentionSuccessAt: timestamp.nullable(),
}).strict();
const incident = z.object({ firstSeenAt: timestamp, lastPlannedAt: timestamp.nullable(), everPlanned: z.boolean() }).strict();
export const alertHistorySchema = z.object({
  kind: z.literal("alert-plan-history-v1"), lastObservationAt: timestamp.nullable(),
  consecutiveHealthFailures: count, incidents: z.partialRecord(code, incident),
}).strict();
export type AlertObservation = z.infer<typeof alertObservationSchema>;
export type AlertHistory = z.infer<typeof alertHistorySchema>;
export const emptyAlertHistory = (): AlertHistory => ({ kind: "alert-plan-history-v1", lastObservationAt: null, consecutiveHealthFailures: 0, incidents: {} });

// Dry-run planning only. lastPlannedAt is NOT a delivery receipt. A future sender
// must persist delivery acknowledgements and retry failed deliveries separately.
export function planAlerts(rawObservation: unknown, rawHistory: unknown = emptyAlertHistory()) {
  const o = alertObservationSchema.parse(rawObservation), history = alertHistorySchema.parse(rawHistory);
  const now = Date.parse(o.at);
  if (history.lastObservationAt && now <= Date.parse(history.lastObservationAt)) throw new Error("NON_MONOTONIC_OBSERVATION");
  for (const time of [o.lastVerifiedBackupAt, o.lastRetentionSuccessAt, ...Object.values(history.incidents).flatMap(i => i ? [i.firstSeenAt, i.lastPlannedAt] : [])])
    if (time && Date.parse(time) > now) throw new Error("FUTURE_OPERATION_TIMESTAMP");
  // Widely separated probes are not consecutive five-minute failures.
  const adjacent = history.lastObservationAt !== null && now - Date.parse(history.lastObservationAt) <= servicePolicy.healthIntervalMinutes * 2 * 60000;
  const failures = o.health === null ? (adjacent ? history.consecutiveHealthFailures : 0) + 1 : 0;
  const active = new Map<z.infer<typeof code>, "critical" | "warning">();
  if (failures >= 2 || (o.health === null && history.incidents.HEALTH_UNAVAILABLE)) active.set("HEALTH_UNAVAILABLE", "critical");
  if (o.health) {
    if (o.health.jobs.failed) active.set("FAILED_JOBS", "warning");
    if (o.health.jobs.expiredLeases) active.set("EXPIRED_LEASES", "warning");
    if (o.health.jobs.delayedQueued) active.set("DELAYED_QUEUE", "warning");
    if (o.health.payments.overduePending) active.set("PAYMENT_OVERDUE", "critical");
    if (o.health.payments.unknownPendingAge) active.set("PAYMENT_AGE_UNKNOWN", "warning");
    if (o.health.withdrawals?.reviewRequired || (!o.health.withdrawals && history.incidents.WITHDRAWAL_REVIEW_REQUIRED)) active.set("WITHDRAWAL_REVIEW_REQUIRED", "warning");
  } else {
    // Loss of health visibility is not evidence that earlier job/payment faults recovered.
    for (const c of ["FAILED_JOBS", "EXPIRED_LEASES", "DELAYED_QUEUE", "PAYMENT_OVERDUE", "PAYMENT_AGE_UNKNOWN", "WITHDRAWAL_REVIEW_REQUIRED"] as const)
      if (history.incidents[c]) active.set(c, c === "PAYMENT_OVERDUE" ? "critical" : "warning");
  }
  if (!o.lastVerifiedBackupAt || now - Date.parse(o.lastVerifiedBackupAt) > servicePolicy.backupOverdueMinutes * 60000) active.set("BACKUP_OVERDUE", "critical");
  if (!o.lastRetentionSuccessAt || now - Date.parse(o.lastRetentionSuccessAt) > 26 * 3600000) active.set("RETENTION_OVERDUE", "warning");
  const hour = new Date(now + 9 * 3600000).getUTCHours();
  const quiet = hour < 9 || hour >= 18;
  const next: AlertHistory = { kind: "alert-plan-history-v1", lastObservationAt: o.at, consecutiveHealthFailures: failures, incidents: {} };
  const notifications: { code: z.infer<typeof code>; event: "problem" | "recovery"; severity: "critical" | "warning" }[] = [];
  for (const c of codes) {
    const severity = active.get(c), previous = history.incidents[c];
    if (severity) {
      const state = previous ?? { firstSeenAt: o.at, lastPlannedAt: null, everPlanned: false };
      next.incidents[c] = { ...state };
      if ((severity === "critical" || !quiet) && (!state.lastPlannedAt || now - Date.parse(state.lastPlannedAt) >= servicePolicy.notificationDedupMinutes * 60000)) {
        notifications.push({ code: c, event: "problem", severity });
        next.incidents[c] = { ...state, lastPlannedAt: o.at, everPlanned: true };
      }
    } else if (previous?.everPlanned) {
      const critical = c === "HEALTH_UNAVAILABLE" || c === "BACKUP_OVERDUE" || c === "PAYMENT_OVERDUE";
      if (!critical && quiet) next.incidents[c] = previous;
      else notifications.push({ code: c, event: "recovery", severity: critical ? "critical" : "warning" });
    }
  }
  return { scope: "offline-notification-plan", externalMessagesSent: 0, notifications, nextHistory: next } as const;
}
