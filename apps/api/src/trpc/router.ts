import { router } from "./trpc.js";
import { userRouter } from "./routers/user.router.js";
import { postRouter } from "./routers/post.router.js";
import { platformRouter } from "./routers/platform.router.js";
import { notificationRouter } from "./routers/notification.router.js";
import { searchRouter } from "./routers/search.router.js";

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  platform: platformRouter,
  notification: notificationRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
