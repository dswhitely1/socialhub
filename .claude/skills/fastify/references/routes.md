# Routes Reference

## Contents
- Route Architecture
- Domain Router Pattern
- Adding a New Router
- Input Validation
- Cursor Pagination Pattern
- Anti-Patterns

## Route Architecture

SocialHub does **not** use Fastify's native route system for business logic. All application routes flow through tRPC, mounted at `/trpc` via plugin. The only native Fastify route is the health check:

```typescript
// apps/api/src/server.ts — the ONLY native Fastify route
fastify.get("/health", async () => {
  return { status: "ok" };
});
```

Everything else goes through the tRPC AppRouter:

```typescript
// apps/api/src/trpc/router.ts
export const appRouter = router({
  user: userRouter,
  post: postRouter,
  platform: platformRouter,
  notification: notificationRouter,
  search: searchRouter,
});

export type AppRouter = typeof appRouter;
```

The `AppRouter` type is exported to clients via `@socialhub/api/trpc` (package.json `exports` field). See the **trpc** skill for client-side consumption.

## Domain Router Pattern

Each domain gets its own router file in `apps/api/src/trpc/routers/`:

```typescript
// apps/api/src/trpc/routers/user.router.ts
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { updateUserSchema } from "@socialhub/shared";
import { z } from "zod";

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    // ctx.userId guaranteed non-null by protectedProcedure
    return { id: ctx.userId, name: "TODO", email: "TODO" };
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      return { id: input.id, name: "TODO", email: "TODO" };
    }),

  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      return { id: ctx.userId, ...input };
    }),
});
```

**File naming:** `{domain}.router.ts` in kebab-case.

## Adding a New Router

Copy this checklist:
- [ ] Create `apps/api/src/trpc/routers/{domain}.router.ts`
- [ ] Import `router`, `protectedProcedure` (or `publicProcedure`) from `"../trpc.js"`
- [ ] Define procedures with Zod input validation (shared schemas from `@socialhub/shared`)
- [ ] Register in `apps/api/src/trpc/router.ts` under a descriptive key
- [ ] Typecheck: `pnpm typecheck`

```typescript
// apps/api/src/trpc/router.ts — add your new router
import { newDomainRouter } from "./routers/new-domain.router.js";

export const appRouter = router({
  user: userRouter,
  post: postRouter,
  // ... existing routers
  newDomain: newDomainRouter,  // add here
});
```

## Input Validation

All procedure inputs use Zod schemas. Prefer importing shared schemas from `@socialhub/shared` over defining inline schemas — this keeps validation consistent across API and clients.

```typescript
// GOOD — shared schema, consistent validation everywhere
import { feedQuerySchema } from "@socialhub/shared";

export const postRouter = router({
  feed: protectedProcedure
    .input(feedQuerySchema)
    .query(async ({ input }) => {
      return { posts: [], nextCursor: input.cursor ?? null };
    }),
});
```

```typescript
// OK — simple inline schemas for router-specific inputs
.input(z.object({ id: z.string().uuid() }))
```

See the **zod** skill for schema patterns.

## Cursor Pagination Pattern

Feed and notification endpoints use cursor-based pagination:

```typescript
// apps/api/src/trpc/routers/notification.router.ts
export const notificationRouter = router({
  list: protectedProcedure
    .input(notificationQuerySchema)
    .query(async ({ input }) => {
      // Return shape: { items: T[], nextCursor: string | null }
      return { notifications: [], nextCursor: input.cursor ?? null };
    }),
});
```

Cursor pagination integrates with TanStack Query's `useInfiniteQuery` on the client. See the **tanstack-query** skill.

## Anti-Patterns

### WARNING: Business Logic in Routers

**The Problem:**

```typescript
// BAD — database queries, external API calls directly in procedure
export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.select().from(users).where(eq(users.id, ctx.userId));
    const platforms = await ctx.db.select().from(connections).where(eq(connections.userId, ctx.userId));
    const feed = await fetchExternalFeed(platforms);
    // 30+ lines of logic...
  }),
});
```

**Why This Breaks:** Routers become untestable monoliths. Business logic changes require touching route files. Multiple routers end up duplicating the same queries.

**The Fix:** Extract to service layer in `apps/api/src/services/`:

```typescript
// GOOD — router delegates to service
import { getUserWithPlatforms } from "../../services/user.service.js";

me: protectedProcedure.query(async ({ ctx }) => {
  return getUserWithPlatforms(ctx.db, ctx.userId);
}),
```

### WARNING: Mixing Public and Protected Without Reason

Every procedure should default to `protectedProcedure`. Only use `publicProcedure` for genuinely unauthenticated endpoints (health checks, public profiles, OAuth callbacks).

### WARNING: Native Fastify Routes for API Logic

**The Problem:** Adding business endpoints as native Fastify routes bypasses tRPC's type safety.

**The Fix:** All application logic goes through tRPC procedures. Native routes are only for infrastructure (health, metrics, webhooks from external services).
