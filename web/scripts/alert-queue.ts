import path from "node:path";
import { z } from "zod";
import { alertHistorySchema, alertObservationSchema, emptyAlertHistory, planAlerts } from "../src/server/alert-plan";
import { atomicPrivateJson, privateDirectory, readOptionalJson, readPrivateJson, withPrivateLock } from "./private-operations";
const candidate = z.object({ code: z.enum(["HEALTH_UNAVAILABLE", "FAILED_JOBS", "EXPIRED_LEASES", "DELAYED_QUEUE", "PAYMENT_OVERDUE", "PAYMENT_AGE_UNKNOWN", "BACKUP_OVERDUE", "RETENTION_OVERDUE"]),
  event: z.enum(["problem", "recovery"]), severity: z.enum(["critical", "warning"]),
  at: z.string().datetime({ offset: true }), incidentAt: z.string().datetime({ offset: true }) }).strict();
const queueSchema = z.object({ kind: z.literal("local-alert-queue-v1"), history: alertHistorySchema, candidates: z.array(candidate).max(128) }).strict();
export async function queueAlerts(raw: unknown, directory: string) {
  const o = alertObservationSchema.parse(raw), parent = await privateDirectory(directory);
  return withPrivateLock(parent, async () => {
    const file = path.join(parent, "alerts.json");
    const state = queueSchema.parse(await readOptionalJson(file) ?? { kind: "local-alert-queue-v1", history: emptyAlertHistory(), candidates: [] });
    const plan = planAlerts(o, state.history);
    for (const item of plan.notifications) {
      const incidentAt = item.event === "problem" ? plan.nextHistory.incidents[item.code]!.firstSeenAt : state.history.incidents[item.code]!.firstSeenAt;
      if (!state.candidates.some(c => c.code === item.code && c.event === item.event && c.incidentAt === incidentAt)) state.candidates.push({ ...item, at: o.at, incidentAt });
    }
    queueSchema.parse(state);
    // Observation/history and candidates commit together; no false delivery receipts.
    state.history = plan.nextHistory;
    await atomicPrivateJson(file, state);
    return { status: "queued-locally", scope: "offline-alert-queue", pendingCandidates: state.candidates.length, activeIncidents: Object.keys(plan.nextHistory.incidents).length,
      externalMessagesSent: 0, senderConfigured: false, schedulerInstalled: false } as const;
  });
}
export async function alertQueueCli(args: string[]) {
  try {
    if (args.length !== 4 || args[0] !== "--observation" || args[2] !== "--directory") throw new Error();
    return { exitCode: 0, report: await queueAlerts(await readPrivateJson(args[1]), args[3]) };
  } catch { return { exitCode: 1, report: { status: "error", code: "ALERT_QUEUE_FAILED", externalMessagesSent: 0, senderConfigured: false, schedulerInstalled: false } }; }
}
