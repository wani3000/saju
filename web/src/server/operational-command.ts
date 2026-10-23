import { database, type Database } from "./db";
import { expireData, health, maintenance } from "./operations";
import { runJobs } from "./service";

const invalidArguments = () => ({
  exitCode: 1,
  report: { status: "error", code: "INVALID_OPERATION_ARGUMENTS" },
});

// Parse before connecting: a misspelled health flag must never run maintenance.
export async function operationalCli(
  entry: "maintenance" | "worker" | "retention",
  args: readonly string[],
  connect: () => Promise<Database> = database,
) {
  if (entry === "maintenance") {
    if (!args.length) return operationalCommand("maintenance", connect);
    if (args.length === 1 && args[0] === "--health")
      return operationalCommand("health", connect);
  } else if (entry === "worker" && !args.length) {
    return operationalCommand("worker", connect);
  } else if (entry === "retention" && !args.length) {
    return operationalCommand("retention", connect);
  }
  // Do not echo unknown arguments: they may accidentally contain secrets.
  return invalidArguments();
}

export async function operationalCommand(
  command: "health" | "maintenance" | "worker" | "retention",
  connect: () => Promise<Database> = database,
) {
  // TypeScript types are absent at runtime; refuse unknown values rather than
  // falling through to the mutating worker branch.
  if (!["health", "maintenance", "worker", "retention"].includes(command))
    return invalidArguments();
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
    } else if (command === "retention") {
      result = { exitCode: 0, report: { status: "completed", expired: await expireData(db) } };
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
