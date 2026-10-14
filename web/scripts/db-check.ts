import { openDatabase, migrate } from "../src/server/db";
const db = await openDatabase("memory://");
await migrate(db);
await migrate(db);
console.log("Clean migration and repeated migration passed.");
await db.close();
