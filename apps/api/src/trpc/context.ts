import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { getDb } from "../lib/db.js";
import { verifyToken } from "../services/auth.service.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");

  let userId: string | null = null;
  if (token) {
    const payload = await verifyToken(token);
    if (payload) userId = payload.userId;
  }

  return { db, token, userId };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
