import { router, protectedProcedure } from "../trpc.js";
import { feedQuerySchema, createPostSchema } from "@socialhub/shared";

export const postRouter = router({
  feed: protectedProcedure
    .input(feedQuerySchema)
    .query(async ({ input }) => {
      // TODO: fetch posts from db with cursor pagination
      return { posts: [], nextCursor: input.cursor ?? null };
    }),

  create: protectedProcedure
    .input(createPostSchema)
    .mutation(async ({ input }) => {
      // TODO: publish post to selected platforms
      return { success: true, platforms: input.platforms };
    }),
});
