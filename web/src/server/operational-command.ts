import { database, type Database } from "./db";
import { health, maintenance } from "./operations";
import { runJobs } from "./service";

export async function operationalCommand(
  command: "health" | "maintenance" | "worker",
  connect: () => Promise<Database> = database,
) {
  let db: Database | undefined;
  let result: { exitCode: number; report: unknown };
  const failure = () => ({
    exitCode: 1,
    report: { status: "error", code: "OPERATION_FAILED" },
  });
  try {
    db = await connect();
    if (command === "health") {
      const report = await health(db);
      result = { exitCode: report.status === "ok" ? 0 : 2, report };
    } else if (command === "maintenance") {
      const report = await maintenance(db);
      result = {
        exitCode: report.health.status === "ok" && !report.unresolved ? 0 : 2,
        report,
      };
    } else {
      const jobs = await runJobs(db);
      const status = await health(db);
      result = {
        exitCode: status.status === "ok" ? 0 : 2,
        report: { jobs, health: status },
      };
    }
  } catch {
    // Database/provider exceptions may contain credentials or personal data.
    result = failure();
  } finally {
    try {
      await db?.close();
    } catch {
      result = failure();
    }
  }
  return result!;
}
