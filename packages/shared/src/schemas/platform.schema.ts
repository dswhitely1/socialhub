import { z } from "zod";
import { PLATFORMS } from "../constants/platforms";

export const platformConnectionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  platformUserId: z.string(),
  platformUsername: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  tokenExpiresAt: z.coerce.date().nullable(),
  isActive: z.boolean(),
  connectedAt: z.coerce.date(),
});

export const connectPlatformSchema = z.object({
  platform: z.enum(PLATFORMS),
  code: z.string(),
  redirectUri: z.string().url(),
});
