import { operationalCommand } from "../src/server/operational-command";
const result = await operationalCommand(
  process.argv.includes("--health") ? "health" : "maintenance",
);
console.log(JSON.stringify(result.report));
process.exitCode = result.exitCode;
