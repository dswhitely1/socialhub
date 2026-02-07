import { z } from "zod";
import { PLATFORMS } from "../constants/platforms.js";

export const postSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  platformPostId: z.string(),
  content: z.string(),
  mediaUrls: z.array(z.string().url()),
  authorName: z.string(),
  authorHandle: z.string(),
  authorAvatar: z.string().url().nullable(),
  likes: z.number().int().nonnegative(),
  reposts: z.number().int().nonnegative(),
  replies: z.number().int().nonnegative(),
  publishedAt: z.coerce.date(),
  rawData: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export const createPostSchema = z.object({
  content: z.string().min(1).max(5000),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  mediaUrls: z.array(z.string().url()).optional(),
});

export const feedQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
