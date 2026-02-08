import { router, protectedProcedure } from "../trpc.js";
import { connectPlatformSchema } from "@socialhub/shared";
import { z } from "zod";

export const platformRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    // TODO: fetch connected platforms for user, filtered by ctx.userId
    void ctx.userId;
    return [];
  }),

  connect: protectedProcedure
    .input(connectPlatformSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: exchange code for tokens, store connection for ctx.userId
      void ctx.userId;
      return { platform: input.platform, connected: true };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: remove platform connection — verify ctx.userId owns this connection
      void ctx.userId;
      return { id: input.id, disconnected: true };
    }),
});
