import { database } from "../src/server/db";
import { maintenance, health } from "../src/server/operations";
const db = await database();
try {
  console.log(
    JSON.stringify(
      process.argv.includes("--health")
        ? await health(db)
        : await maintenance(db),
    ),
  );
} finally {
  await db.close();
}
