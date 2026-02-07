import { router, protectedProcedure } from "../trpc.js";
import { connectPlatformSchema } from "@socialhub/shared";
import { z } from "zod";

export const platformRouter = router({
  list: protectedProcedure.query(async () => {
    // TODO: fetch connected platforms for user
    return [];
  }),

  connect: protectedProcedure
    .input(connectPlatformSchema)
    .mutation(async ({ input }) => {
      // TODO: exchange code for tokens, store connection
      return { platform: input.platform, connected: true };
    }),

  disconnect: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // TODO: remove platform connection
      return { id: input.id, disconnected: true };
    }),
});
