import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { updateUserSchema } from "@socialhub/shared";
import { z } from "zod";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    // TODO: fetch user from db by ctx.userId
    return { id: ctx.userId, name: "TODO", email: "TODO" };
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      // TODO: fetch user from db
      return { id: input.id, name: "TODO", email: "TODO" };
    }),

  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: update user in db
      return { id: ctx.userId, ...input };
    }),
});
