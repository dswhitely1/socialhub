import { router, protectedProcedure } from "../trpc.js";
import { feedQuerySchema, createPostSchema } from "@socialhub/shared";

export const postRouter = router({
  feed: protectedProcedure
    .input(feedQuerySchema)
    .query(async ({ ctx, input }) => {
      // TODO: fetch posts from db for ctx.userId with cursor pagination
      void ctx.userId;
      return { posts: [], nextCursor: input.cursor ?? null };
    }),

  create: protectedProcedure
    .input(createPostSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: publish post to selected platforms for ctx.userId
      void ctx.userId;
      return { success: true, platforms: input.platforms };
    }),
});
