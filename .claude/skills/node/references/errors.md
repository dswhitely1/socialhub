# Node.js Errors Reference

## Contents
- Error Handling Strategy
- tRPC Error Codes
- Environment Validation Errors
- Process Signal Handling
- Async Error Patterns
- Missing Professional Solutions
- Anti-Patterns

## Error Handling Strategy

SocialHub uses a layered error handling approach:

| Layer | Mechanism | Handled By |
|-------|-----------|------------|
| Environment | Zod `parse()` throws on invalid config | Top-level `main().catch()` |
| tRPC procedures | `TRPCError` with standard codes | tRPC error formatter (auto-serialized) |
| Zod input validation | Automatic BAD_REQUEST on invalid input | tRPC middleware (built-in) |
| Fastify routes | Fastify error handler | Default Fastify error response |
| BullMQ workers | Job failure callback | BullMQ retry/dead-letter |
| Unhandled rejections | `process.on("unhandledRejection")` | Not yet configured (see Missing Solutions) |

## tRPC Error Codes

See the **trpc** skill for full procedure patterns. tRPC maps its error codes to HTTP status codes automatically.

```typescript
// apps/api/src/trpc/trpc.ts
import { TRPCError } from "@trpc/server";

const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
```

```typescript
// In a router procedure
throw new TRPCError({
  code: "NOT_FOUND",
  message: `Post ${input.id} not found`,
});
```

Common tRPC error codes used in this project:

| Code | HTTP | When |
|------|------|------|
| `UNAUTHORIZED` | 401 | Missing or invalid auth token |
| `FORBIDDEN` | 403 | Valid token but insufficient permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `BAD_REQUEST` | 400 | Auto-thrown by Zod input validation failure |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server errors |

## Shared Error Code Constants

```typescript
// packages/shared/src/constants/errors.ts
export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PLATFORM_ERROR: "PLATFORM_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

## Environment Validation Errors

When `envSchema.parse(process.env)` fails, Zod throws a `ZodError` with detailed field-level messages. This happens at startup, before the server accepts any requests.

```
ZodError: [
  {
    "code": "invalid_type",
    "expected": "string",
    "received": "undefined",
    "path": ["DATABASE_URL"],
    "message": "Required"
  }
]
```

The top-level `main().catch()` logs this and exits with code 1. The error message clearly identifies which variable is missing or invalid.

Validation workflow:
1. Add variable to `.env.example`
2. Add Zod field in `apps/api/src/env.ts`
3. Validate: `pnpm --filter @socialhub/api dev`
4. If startup fails with ZodError, fix `.env` and repeat step 3
5. Only proceed when server starts cleanly

## Process Signal Handling

Fastify handles `SIGTERM` and `SIGINT` via its built-in `close` hook. Plugins that need cleanup (e.g., Socket.IO) register `onClose` hooks. See the **fastify** skill for plugin lifecycle.

```typescript
// apps/api/src/plugins/socket.plugin.ts — cleanup on shutdown
fastify.addHook("onClose", () => {
  io.close();
});
```

The server entry point catches startup failures:

```typescript
main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

## Async Error Patterns

### Promise Rejection in Procedures

tRPC automatically catches rejected promises in procedures and converts them to error responses. No manual try-catch needed for standard flows.

```typescript
// GOOD — tRPC catches the rejection, returns 500
export const postRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const post = await ctx.db.query.posts.findFirst({
        where: eq(posts.id, input.id),
      });
      if (!post) throw new TRPCError({ code: "NOT_FOUND" });
      return post;
    }),
});
```

### BullMQ Worker Errors

Worker processors that throw are automatically handled by BullMQ's retry mechanism. See the **bullmq** skill for retry configuration.

```typescript
// apps/api/src/jobs/feed-polling.job.ts
export function createFeedPollingWorker() {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      // If this throws, BullMQ retries based on queue config
      const adapter = getPlatformAdapter(job.data.platform);
      if (!adapter) throw new Error(`No adapter for ${job.data.platform}`);
      await adapter.fetchFeed(job.data.accessToken);
    },
    { connection: getRedis() },
  );
}
```

## WARNING: Missing Professional Solutions

### Graceful Shutdown Handler

**Detected:** No `process.on("SIGTERM")` or graceful shutdown orchestration beyond Fastify's built-in hooks.

**Impact:** In production (ECS Fargate), SIGTERM is sent before container termination. Without graceful shutdown, in-flight requests are dropped, BullMQ workers abandon jobs mid-processing, and database connections aren't drained.

**Recommended approach:**

```typescript
// apps/api/src/server.ts — add after fastify.listen()
async function shutdown(signal: string) {
  fastify.log.info(`Received ${signal}, shutting down gracefully`);
  await fastify.close(); // Triggers all onClose hooks (Socket.IO, etc.)
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

### Unhandled Rejection Handler

**Detected:** No global `unhandledRejection` handler.

**Impact:** Unhandled promise rejections in Node.js 20 throw by default (`--unhandled-rejections=throw`). Without a handler, the process crashes with no logging, making debugging impossible.

**Recommended approach:**

```typescript
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  // In production: report to Sentry, then exit
});
```

## Anti-Patterns

### WARNING: Try-Catch Wrapping Every Procedure

**The Problem:**

```typescript
// BAD — unnecessary boilerplate, tRPC already handles this
getById: publicProcedure.query(async ({ input }) => {
  try {
    const post = await db.query.posts.findFirst({ where: eq(posts.id, input.id) });
    return post;
  } catch (err) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  }
}),
```

**Why This Breaks:**
1. Swallows the original error — you lose the stack trace and error type
2. tRPC already catches unhandled exceptions and returns 500
3. Converts specific database errors (constraint violations, timeouts) into generic 500s

**The Fix:**

```typescript
// GOOD — let tRPC handle unexpected errors, only catch for business logic
getById: publicProcedure.query(async ({ input }) => {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, input.id) });
  if (!post) throw new TRPCError({ code: "NOT_FOUND" });
  return post;
}),
```

### WARNING: Silent Error Swallowing

**The Problem:**

```typescript
// BAD — error disappears completely
try {
  await indexPost(post);
} catch {
  // silently ignore search indexing failure
}
```

**Why This Breaks:**
1. Search index drifts from database — users can't find posts
2. No visibility into failure rate or patterns
3. Debugging becomes impossible when "posts aren't showing in search"

**The Fix:**

```typescript
// GOOD — log and continue if non-critical, or propagate if critical
try {
  await indexPost(post);
} catch (err) {
  fastify.log.error({ err, postId: post.id }, "Failed to index post in Meilisearch");
  // Non-critical: search is eventually consistent, don't fail the request
}
```
