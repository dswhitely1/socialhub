import { router, protectedProcedure } from "../trpc.js";
import { notificationQuerySchema } from "@socialhub/shared";
import { z } from "zod";

export const notificationRouter = router({
  list: protectedProcedure
    .input(notificationQuerySchema)
    .query(async ({ input }) => {
      // TODO: fetch notifications with cursor pagination
      return { notifications: [], nextCursor: input.cursor ?? null };
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      // TODO: mark notifications as read
      return { updated: input.ids.length };
    }),

  markAllRead: protectedProcedure.mutation(async () => {
    // TODO: mark all notifications as read for user
    return { success: true };
  }),
});
