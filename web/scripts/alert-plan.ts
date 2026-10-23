import { readFileSync, statSync } from "node:fs";
import { planAlerts, emptyAlertHistory } from "../src/server/alert-plan";
try {
  const args = process.argv.slice(2);
  if (![2, 4].includes(args.length) || args[0] !== "--observation" || (args.length === 4 && args[2] !== "--history")) throw new Error();
  const read = (file: string) => { if (statSync(file).size > 65536) throw new Error(); return JSON.parse(readFileSync(file, "utf8")); };
  console.log(JSON.stringify(planAlerts(read(args[1]), args.length === 4 ? read(args[3]) : emptyAlertHistory())));
} catch {
  console.log(JSON.stringify({ status: "invalid", code: "INVALID_ALERT_PLAN_INPUT", externalMessagesSent: 0 }));
  process.exitCode = 1;
}
