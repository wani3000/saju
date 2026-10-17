import { database } from "../src/server/db";
import { runJobs } from "../src/server/service";
const db = await database();
try {
  console.log(JSON.stringify(await runJobs(db)));
} finally {
  await db.close();
}
