import type { z } from "zod";
import type {
  userSchema,
  createUserSchema,
  updateUserSchema,
} from "../schemas/user.schema";
import type {
  postSchema,
  createPostSchema,
  feedQuerySchema,
} from "../schemas/post.schema";
import type {
  platformConnectionSchema,
  connectPlatformSchema,
} from "../schemas/platform.schema";
import type {
  notificationSchema,
  notificationQuerySchema,
} from "../schemas/notification.schema";

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Post = z.infer<typeof postSchema>;
export type CreatePost = z.infer<typeof createPostSchema>;
export type FeedQuery = z.infer<typeof feedQuerySchema>;

export type PlatformConnection = z.infer<typeof platformConnectionSchema>;
export type ConnectPlatform = z.infer<typeof connectPlatformSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
