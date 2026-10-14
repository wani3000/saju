import { database } from "../src/server/db";
import { runJobs } from "../src/server/service";
const db = await database();
await runJobs(db);
await db.close();
