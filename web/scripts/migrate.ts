import { openDatabase, migrate, assertMode } from "../src/server/db";
assertMode();
const db = await openDatabase();
try {
  await migrate(db);
  console.log("Migrations applied.");
} finally {
  await db.close();
}
