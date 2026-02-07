import { createDb } from "./client";
import { users } from "./schema/index";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const db = createDb(databaseUrl);

  console.log("Seeding database...");

  await db.insert(users).values({
    name: "Demo User",
    email: "demo@socialhub.dev",
  });

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
