import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email(),
  image: z.string().url().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createUserSchema = userSchema.pick({
  name: true,
  email: true,
  image: true,
});

export const updateUserSchema = userSchema.pick({
  name: true,
  image: true,
}).partial();
