import { router, protectedProcedure } from "../trpc.js";
import { z } from "zod";

export const searchRouter = router({
  posts: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ input }) => {
      // TODO: search posts via Meilisearch
      return { results: [], query: input.query };
    }),
});
