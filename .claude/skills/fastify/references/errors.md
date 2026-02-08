# Errors Reference

## Contents
- Error Handling Architecture
- tRPC Error Codes
- Server Startup Errors
- Plugin Error Handling
- Async Error Propagation
- Missing Error Infrastructure
- Anti-Patterns

## Error Handling Architecture

Errors flow through three layers:

| Layer | Mechanism | Location |
|-------|-----------|----------|
| **tRPC procedures** | `TRPCError` with typed codes | Routers and middleware |
| **Fastify plugins** | Fastify's built-in error handler | Plugins and hooks |
| **Server startup** | Top-level try/catch → `process.exit(1)` | `server.ts` |

```typescript
// apps/api/src/server.ts — startup error handling
main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
```

## tRPC Error Codes

tRPC maps errors to HTTP status codes automatically. Use these codes in procedures:

| tRPC Code | HTTP Status | When to Use |
|-----------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient permissions |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `BAD_REQUEST` | 400 | Invalid input (Zod handles this automatically) |
| `CONFLICT` | 409 | Duplicate resource (e.g., platform already connected) |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server failure |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |

**Usage in procedures:**

```typescript
import { TRPCError } from "@trpc/server";

// Auth middleware — already implemented
if (!ctx.userId) {
  throw new TRPCError({ code: "UNAUTHORIZED" });
}

// Resource not found
const user = await getUserById(ctx.db, userId);
if (!user) {
  throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
}

// Permission check
if (post.userId !== ctx.userId) {
  throw new TRPCError({ code: "FORBIDDEN", message: "Not your post" });
}
```

## Server Startup Errors

Startup errors are fatal. The Zod env validation catches missing/invalid environment variables immediately:

```typescript
// apps/api/src/env.ts — fails fast on invalid env
export const env = envSchema.parse(process.env);
// Throws ZodError with details if validation fails
```

If any required env var is missing, the process exits before Fastify even starts. This is correct — never try to recover from missing configuration.

## Plugin Error Handling

Fastify plugins should clean up resources on shutdown via `onClose`:

```typescript
// apps/api/src/plugins/socket.plugin.ts
export async function socketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, { /* ... */ });

  // Cleanup on shutdown
  fastify.addHook("onClose", () => {
    io.close();
  });
}
```

For plugins that establish connections (Redis, external services), always add `onClose` cleanup.

## Async Error Propagation

All tRPC procedures are `async` functions. Unhandled rejections propagate to tRPC's error handler, which returns `INTERNAL_SERVER_ERROR` to the client and logs the error via Fastify's logger.

```typescript
// Errors from async operations bubble up automatically
feed: protectedProcedure.query(async ({ ctx }) => {
  // If db.select() throws, tRPC catches it and returns 500
  const posts = await ctx.db.select().from(posts);
  return { posts };
}),
```

NEVER wrap procedure bodies in try/catch unless you need to transform the error into a specific `TRPCError` code:

```typescript
// GOOD — transform external API errors
connect: protectedProcedure.mutation(async ({ ctx, input }) => {
  try {
    const tokens = await exchangeOAuthCode(input.platform, input.code);
    await storeConnection(ctx.db, ctx.userId, input.platform, tokens);
    return { connected: true };
  } catch (err) {
    if (err instanceof OAuthError) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid OAuth code",
      });
    }
    throw err; // Re-throw unexpected errors → 500
  }
}),
```

## Missing Error Infrastructure

### WARNING: No Structured Error Logging

The codebase uses Fastify's built-in Pino logger but has no structured error tracking (Sentry, etc.). For production:

1. Add Sentry: `pnpm --filter @socialhub/api add @sentry/node`
2. Initialize in `server.ts` before creating the Fastify instance
3. Use Fastify's `onError` hook to capture unhandled errors

### WARNING: No Request-Level Error Context

tRPC errors don't automatically include request context (user ID, route, etc.) in logs. Add a custom error formatter:

```typescript
// In tRPC initialization — apps/api/src/trpc/trpc.ts
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    // Log with context, but don't expose to client
    if (ctx?.userId) {
      console.error(`tRPC error for user ${ctx.userId}:`, error);
    }
    return shape; // Return unmodified shape to client
  },
});
```

## Anti-Patterns

### WARNING: Silent Error Swallowing

**The Problem:**

```typescript
// BAD — error disappears, no logging, no indication of failure
try {
  await indexPost(post);
} catch {
  // silently ignore
}
```

**Why This Breaks:** Search indexing fails silently. Posts never appear in search results and nobody knows why. Debugging becomes a nightmare.

**The Fix:**

```typescript
// GOOD — log and decide: fail or continue
try {
  await indexPost(post);
} catch (err) {
  fastify.log.error({ err, postId: post.id }, "Failed to index post");
  // Search indexing is non-critical — don't fail the request
}
```

### WARNING: Leaking Stack Traces to Clients

**The Problem:**

```typescript
// BAD — sends internal details to client
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: `Database connection failed: ${err.stack}`,
});
```

**Why This Breaks:** Stack traces expose file paths, dependency versions, and internal architecture to attackers.

**The Fix:** Log details server-side, return generic messages to client:

```typescript
fastify.log.error({ err }, "Database connection failed");
throw new TRPCError({
  code: "INTERNAL_SERVER_ERROR",
  message: "An unexpected error occurred",
});
```

### WARNING: Catching Errors Too Broadly

```typescript
// BAD — catches programming errors (TypeError, ReferenceError)
try {
  const result = await complexOperation();
  return rsult; // typo: "rsult" — caught and hidden!
} catch {
  return { error: "Something went wrong" };
}
```

Only catch errors you can handle. Let unexpected errors propagate to tRPC's error handler where they'll be properly logged.
