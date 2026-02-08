# Endpoints Reference

## Contents
- Router Structure
- Procedure Types
- Domain Router Patterns
- WARNING: God Routers
- WARNING: Business Logic in Procedures
- Integration With Services

## Router Structure

The root `AppRouter` in `apps/api/src/trpc/router.ts` composes domain routers:

```typescript
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
```

Router keys map directly to client calls: `trpc.user.me.useQuery()`, `trpc.post.create.useMutation()`.

## Procedure Types

| Type | Import | Auth | Use For |
|------|--------|------|---------|
| `publicProcedure` | `"../trpc.js"` | None | Unauthenticated endpoints (health, public search) |
| `protectedProcedure` | `"../trpc.js"` | Required | Any endpoint needing `ctx.userId` |

```typescript
// Query — read operations
getById: publicProcedure
  .input(z.object({ id: z.string().uuid() }))
  .query(async ({ input }) => { /* ... */ }),

// Mutation — write operations
update: protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => { /* ... */ }),

// Mutation without input
markAllRead: protectedProcedure.mutation(async ({ ctx }) => { /* ... */ }),
```

## Domain Router Patterns

Each domain router lives in `apps/api/src/trpc/routers/{domain}.router.ts`.

### Standard CRUD Router

```typescript
import { router, protectedProcedure } from "../trpc.js";
import { createPostSchema, feedQuerySchema } from "@socialhub/shared";

export const postRouter = router({
  feed: protectedProcedure
    .input(feedQuerySchema)
    .query(async ({ input }) => {
      return { posts: [], nextCursor: input.cursor ?? null };
    }),

  create: protectedProcedure
    .input(createPostSchema)
    .mutation(async ({ input }) => {
      return { success: true, platforms: input.platforms };
    }),
});
```

### Batch Operations Router

```typescript
import { router, protectedProcedure } from "../trpc.js";
import { z } from "zod";

export const notificationRouter = router({
  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string().uuid()) }))
    .mutation(async ({ input }) => {
      return { updated: input.ids.length };
    }),
});
```

### Search Router (Inline Schemas)

Use inline Zod when the schema is endpoint-specific and not shared:

```typescript
export const searchRouter = router({
  posts: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ input }) => {
      return { results: [], query: input.query };
    }),
});
```

## WARNING: God Routers

**The Problem:**

```typescript
// BAD — single router with 20+ procedures
export const apiRouter = router({
  getUser: protectedProcedure.query(/* ... */),
  updateUser: protectedProcedure.mutation(/* ... */),
  getFeed: protectedProcedure.query(/* ... */),
  createPost: protectedProcedure.mutation(/* ... */),
  searchPosts: protectedProcedure.query(/* ... */),
  // ...15 more procedures
});
```

**Why This Breaks:**
1. File becomes unmanageable past 200 lines
2. Impossible to reason about domain boundaries
3. Merge conflicts when multiple developers touch the same file

**The Fix:**

```typescript
// GOOD — one router per domain, composed in appRouter
export const appRouter = router({
  user: userRouter,
  post: postRouter,
  search: searchRouter,
});
```

**When You Might Be Tempted:** Early prototyping or "just one more endpoint" additions.

## WARNING: Business Logic in Procedures

**The Problem:**

```typescript
// BAD — database queries and logic directly in procedure
create: protectedProcedure
  .input(createPostSchema)
  .mutation(async ({ ctx, input }) => {
    const connections = await ctx.db.query.platformConnections.findMany({
      where: eq(platformConnections.userId, ctx.userId),
    });
    for (const conn of connections) {
      const adapter = getPlatformAdapter(conn.platform);
      await adapter?.publishPost(conn.accessToken, input.content);
    }
    await ctx.db.insert(posts).values({ /* ... */ });
    return { success: true };
  }),
```

**Why This Breaks:**
1. Procedures become untestable — they depend on real database and external APIs
2. Logic duplication when the same operation is needed from BullMQ jobs
3. Hard to add caching, retries, or error handling at the right layer

**The Fix:**

Extract to a service in `apps/api/src/services/`:

```typescript
// GOOD — thin procedure, logic in service
import { publishToAllPlatforms } from "../services/post.service.js";

create: protectedProcedure
  .input(createPostSchema)
  .mutation(async ({ ctx, input }) => {
    return publishToAllPlatforms(ctx.db, ctx.userId, input);
  }),
```

## Integration With Services

Procedures should delegate to services. Services access singleton clients from `apps/api/src/lib/`:

```
Procedure → Service → { db, redis, meilisearch, platformAdapters }
```

See the **drizzle** skill for database query patterns inside services. See the **redis** skill for caching patterns. See the **meilisearch** skill for search indexing.

## Import Convention

API source files **must** use `.js` extensions in relative imports (ESM requirement):

```typescript
// GOOD
import { router, protectedProcedure } from "../trpc.js";

// BAD — will fail at runtime
import { router, protectedProcedure } from "../trpc";
```

Package imports use the `exports` map — no extension needed:

```typescript
import { feedQuerySchema } from "@socialhub/shared";
import type { AppRouter } from "@socialhub/api/trpc";
```

Type imports **must** use the `type` keyword (enforced by ESLint):

```typescript
import type { Context } from "./context.js";
```
