import { createDb } from "@socialhub/db";
import { env } from "../env.js";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
