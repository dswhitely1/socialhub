import { z } from "zod";
import { PLATFORMS } from "../constants/platforms.js";

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

export const notificationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  type: z.enum(["mention", "like", "comment", "follow", "repost", "dm"]),
  title: z.string(),
  body: z.string(),
  isRead: z.boolean(),
  platformNotificationId: z.string(),
  createdAt: z.coerce.date(),
});

export const notificationQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  type: z.enum(["mention", "like", "comment", "follow", "repost", "dm"]).optional(),
  unreadOnly: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
