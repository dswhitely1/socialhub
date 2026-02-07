import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getDb } from "../lib/db.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");

  return {
    db,
    token,
    userId: null as string | null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
