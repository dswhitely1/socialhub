# Drizzle Patterns Reference

## Contents
- Schema Design Conventions
- JSONB Column Typing
- Foreign Keys and Cascade
- Composite Primary Keys
- Type Inference
- Query Patterns
- Anti-Patterns

## Schema Design Conventions

This project uses consistent conventions across all schema files in `packages/db/src/schema/`:

| Convention | Pattern | Example |
|------------|---------|---------|
| Table names | snake_case | `"platform_connections"` |
| Column names | snake_case | `"user_id"`, `"created_at"` |
| Export names | camelCase | `export const platformConnections` |
| IDs | UUID with defaultRandom | `uuid("id").primaryKey().defaultRandom()` |
| Timestamps | mode: "date" | `timestamp("created_at", { mode: "date" })` |
| Bounded strings | varchar with explicit length | `varchar("platform", { length: 50 })` |
| Unbounded strings | text | `text("content")` |

```typescript
// packages/db/src/schema/platforms.ts — follows all conventions
export const platformConnections = pgTable("platform_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  platformUserId: varchar("platform_user_id", { length: 255 }).notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  isActive: boolean("is_active").notNull().default(true),
  connectedAt: timestamp("connected_at", { mode: "date" }).notNull().defaultNow(),
});
```

## JSONB Column Typing

Use `.$type<T>()` to get TypeScript inference on JSONB columns. Always provide a `.default()`.

```typescript
// GOOD — typed JSONB with default
mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),

// BAD — untyped JSONB, infers as `unknown`
rawData: jsonb("raw_data"),
```

For complex platform-specific payloads, define the type in `@socialhub/shared` and reference it. See the **zod** skill for keeping Zod schemas in sync with JSONB shapes.

## Foreign Keys and Cascade

Every foreign key in this project uses `onDelete: "cascade"`. This ensures deleting a user removes all their posts, notifications, and platform connections.

```typescript
userId: uuid("user_id")
  .notNull()
  .references(() => users.id, { onDelete: "cascade" }),
```

### WARNING: Missing onDelete Strategy

**The Problem:**

```typescript
// BAD — no onDelete means SET NULL by default in some contexts
userId: uuid("user_id").notNull().references(() => users.id),
```

**Why This Breaks:**
1. Orphaned rows accumulate when parent records are deleted
2. `notNull` constraint causes the delete to fail entirely with a FK violation
3. Data cleanup becomes a manual chore in production

**The Fix:**

```typescript
// GOOD — explicit cascade strategy
userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
```

## Composite Primary Keys

Auth.js adapter tables use composite primary keys via the table callback:

```typescript
// packages/db/src/schema/auth.ts
export const accounts = pgTable(
  "accounts",
  {
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    // ... other columns
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);
```

The callback receives the table columns and returns an array of constraints/indexes.

## Type Inference

Extract insert and select types directly from table definitions — no manual type duplication needed:

```typescript
import type { posts } from "@socialhub/db/schema";

// Select type includes all columns with their inferred TS types
type Post = typeof posts.$inferSelect;

// Insert type makes columns with defaults optional
type NewPost = typeof posts.$inferInsert;
// NewPost.id is optional (has defaultRandom)
// NewPost.createdAt is optional (has defaultNow)
// NewPost.content is required (no default)
```

## Query Patterns

### Filtered Select with Pagination

```typescript
import { eq, and, desc, sql } from "drizzle-orm";

const page = 2;
const pageSize = 20;

const results = await db
  .select()
  .from(posts)
  .where(and(eq(posts.userId, userId), eq(posts.platform, "twitter")))
  .orderBy(desc(posts.publishedAt))
  .limit(pageSize)
  .offset((page - 1) * pageSize);
```

### Partial Select (Specific Columns)

```typescript
const userNames = await db
  .select({ id: users.id, name: users.name, email: users.email })
  .from(users);
// Returns: { id: string; name: string; email: string }[]
```

### Upsert (Insert on Conflict)

```typescript
await db
  .insert(posts)
  .values({ ...postData })
  .onConflictDoUpdate({
    target: [posts.userId, posts.platformPostId],
    set: { content: postData.content, likes: postData.likes },
  });
```

### Count Query

```typescript
import { count } from "drizzle-orm";

const [{ total }] = await db
  .select({ total: count() })
  .from(notifications)
  .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
```

## Anti-Patterns

### WARNING: Extensioned Imports in Schema Files

**The Problem:**

```typescript
// packages/db/src/schema/posts.ts
// BAD — .js extension breaks drizzle-kit
import { users } from "./users.js";
```

**Why This Breaks:**
1. drizzle-kit uses its own CJS resolver that cannot resolve `.js` extensions to `.ts` files
2. `drizzle-kit push` and `drizzle-kit generate` will fail with "module not found"
3. This ONLY applies to schema files consumed by drizzle-kit — the API uses `.js` extensions normally

**The Fix:**

```typescript
// GOOD — extensionless for drizzle-kit compatibility
import { users } from "./users";
```

**When You Might Be Tempted:** When following the API convention where all imports use `.js` extensions for ESM compatibility. Schema files are the exception.

### WARNING: Raw SQL Without the `sql` Template

**The Problem:**

```typescript
// BAD — string interpolation, SQL injection risk
const results = await db.execute(`SELECT * FROM posts WHERE user_id = '${userId}'`);
```

**Why This Breaks:**
1. SQL injection vulnerability
2. No type safety on results
3. Bypasses Drizzle's query builder entirely

**The Fix:**

```typescript
// GOOD — use Drizzle's query builder
const results = await db.select().from(posts).where(eq(posts.userId, userId));

// Or if raw SQL is needed, use the sql template tag
import { sql } from "drizzle-orm";
const results = await db.execute(sql`SELECT * FROM posts WHERE user_id = ${userId}`);
```

### WARNING: N+1 Queries in Loops

**The Problem:**

```typescript
// BAD — one query per post to fetch author
const postsData = await db.select().from(posts).limit(50);
for (const post of postsData) {
  const [author] = await db.select().from(users).where(eq(users.id, post.userId));
  post.author = author;
}
```

**Why This Breaks:**
1. 51 database round-trips instead of 1-2
2. Latency scales linearly with result count
3. Exhausts connection pool under load

**The Fix:**

```typescript
// GOOD — single query with join
const results = await db
  .select({
    post: posts,
    author: { name: users.name, image: users.image },
  })
  .from(posts)
  .innerJoin(users, eq(posts.userId, users.id))
  .orderBy(desc(posts.publishedAt))
  .limit(50);
```
