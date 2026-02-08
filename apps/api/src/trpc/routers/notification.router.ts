import { router, protectedProcedure } from "../trpc.js";
import { notificationQuerySchema } from "@socialhub/shared";
import { z } from "zod";

export const notificationRouter = router({
  list: protectedProcedure
    .input(notificationQuerySchema)
    .query(async ({ ctx, input }) => {
      // TODO: fetch notifications for ctx.userId with cursor pagination
      void ctx.userId;
      return { notifications: [], nextCursor: input.cursor ?? null };
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      // TODO: mark notifications as read — verify ctx.userId owns these notifications
      void ctx.userId;
      return { updated: input.ids.length };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    // TODO: mark all notifications as read for ctx.userId
    void ctx.userId;
    return { success: true };
  }),
});
