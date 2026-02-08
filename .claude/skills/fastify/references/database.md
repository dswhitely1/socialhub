# Database Reference

## Contents
- Database Access Pattern
- Singleton Client
- Using DB in tRPC Context
- Query Patterns with Drizzle
- Connection Management
- Anti-Patterns

## Database Access Pattern

The API accesses PostgreSQL via Drizzle ORM through a lazy singleton. The database client is created once on first use and shared across all requests.

```typescript
// apps/api/src/lib/db.ts
import { createDb } from "@socialhub/db";
import { env } from "../env.js";

let db: ReturnType<typeof createDb> | null = null;

export function getDb() {
  if (!db) {
    db = createDb(env.DATABASE_URL);
  }
  return db;
}
```

`createDb()` is defined in `packages/db/src/client.ts` and returns a Drizzle instance with the postgres.js driver. See the **drizzle** skill for schema definitions and the **postgresql** skill for connection details.

**Critical:** PostgreSQL runs on port **5433** (not 5432). The `DATABASE_URL` must reflect this.

## Using DB in tRPC Context

The database is injected into every tRPC request via context:

```typescript
// apps/api/src/trpc/context.ts
import { getDb } from "../lib/db.js";

export async function createContext({ req }: CreateFastifyContextOptions) {
  const db = getDb();
  const token = req.headers.authorization?.replace("Bearer ", "");
  return {
    db,
    token,
    userId: null as string | null,
  };
}
```

Access it in any procedure via `ctx.db`:

```typescript
// In a tRPC router
me: protectedProcedure.query(async ({ ctx }) => {
  const user = await ctx.db
    .select()
    .from(users)
    .where(eq(users.id, ctx.userId))
    .limit(1);
  return user[0] ?? null;
}),
```

## Query Patterns with Drizzle

### Select with Filtering

```typescript
import { eq, and, desc } from "drizzle-orm";
import { posts, platformConnections } from "@socialhub/db";

// Single record
const user = await ctx.db
  .select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);

// Filtered list with ordering
const userPosts = await ctx.db
  .select()
  .from(posts)
  .where(and(eq(posts.userId, userId), eq(posts.platform, "twitter")))
  .orderBy(desc(posts.createdAt))
  .limit(20);
```

### Insert

```typescript
const [newPost] = await ctx.db
  .insert(posts)
  .values({
    userId: ctx.userId,
    content: input.content,
    platform: input.platform,
    rawPayload: {},  // JSONB column
  })
  .returning();
```

### Cursor Pagination

The feed and notification endpoints use cursor-based pagination for infinite scroll:

```typescript
const items = await ctx.db
  .select()
  .from(posts)
  .where(
    input.cursor
      ? and(eq(posts.userId, userId), lt(posts.createdAt, input.cursor))
      : eq(posts.userId, userId),
  )
  .orderBy(desc(posts.createdAt))
  .limit(input.limit + 1); // Fetch one extra to detect next page

const hasMore = items.length > input.limit;
const nextCursor = hasMore ? items[input.limit - 1].createdAt : null;
return { posts: items.slice(0, input.limit), nextCursor };
```

## Connection Management

The postgres.js driver manages its own connection pool internally. Do NOT configure a separate pool or create multiple client instances.

**Singleton validation:**

1. `getDb()` returns the same instance on every call
2. The connection string comes from `env.DATABASE_URL` (Zod-validated at startup)
3. postgres.js handles reconnection automatically

**Graceful shutdown** is handled by Fastify's `onClose` hook — add cleanup if needed:

```typescript
fastify.addHook("onClose", async () => {
  // postgres.js connections close automatically when process exits
  // Add explicit cleanup here if needed
});
```

## Anti-Patterns

### WARNING: N+1 Queries

**The Problem:**

```typescript
// BAD — one query per platform connection
const connections = await ctx.db.select().from(platformConnections).where(eq(platformConnections.userId, userId));
for (const conn of connections) {
  const posts = await ctx.db.select().from(posts).where(eq(posts.connectionId, conn.id));
}
```

**Why This Breaks:** For a user with 5 connected platforms, this fires 6 queries instead of 1-2. Under load this multiplies into thousands of unnecessary queries.

**The Fix:** Use joins or batch queries:

```typescript
// GOOD — single query with join
const result = await ctx.db
  .select()
  .from(platformConnections)
  .leftJoin(posts, eq(posts.connectionId, platformConnections.id))
  .where(eq(platformConnections.userId, userId));
```

### WARNING: Creating DB Instances Per Request

**The Problem:**

```typescript
// BAD — new connection per request
export async function createContext() {
  const db = createDb(env.DATABASE_URL); // NEW pool every time!
  return { db };
}
```

**Why This Breaks:** Each request creates a new connection pool. Under 1000 RPS you'd open thousands of connections, exhausting PostgreSQL's `max_connections` (default: 100).

**The Fix:** Always use the singleton `getDb()`.

### WARNING: Raw SQL Without Parameterization

**The Problem:** Drizzle handles parameterization automatically, but if you drop to raw SQL via `db.execute()`, always use parameterized queries.

```typescript
// BAD — SQL injection risk
await db.execute(`SELECT * FROM users WHERE id = '${userId}'`);

// GOOD — parameterized
import { sql } from "drizzle-orm";
await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`);
```

### WARNING: Missing JSONB Type Safety

Posts store platform-specific data in JSONB columns. Always validate JSONB data with Zod when reading:

```typescript
// GOOD — validate unknown JSONB before using
const rawPayload = postRow.rawPayload;
const parsed = platformPostSchema.safeParse(rawPayload);
if (!parsed.success) {
  fastify.log.warn({ postId: postRow.id }, "Invalid raw payload");
}
```

See the **zod** skill for validation patterns.
