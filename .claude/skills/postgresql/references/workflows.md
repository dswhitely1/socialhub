# PostgreSQL Workflows Reference

## Contents
- Schema Change Workflow
- Adding a New Table
- Adding Indexes via Drizzle
- Cursor Pagination Implementation
- Database Reset and Seed
- Production Migration Checklist

## Schema Change Workflow

SocialHub uses `drizzle-kit push` for development (direct schema sync) and `drizzle-kit generate` + `drizzle-kit migrate` for production. See the **drizzle** skill for full ORM details.

```bash
# Development: push schema changes directly (destructive — dev only)
pnpm db:push

# Production: generate migration SQL, then apply
pnpm db:generate   # creates packages/db/src/migrations/NNNN_*.sql
pnpm db:migrate    # applies pending migrations
```

**Feedback loop:**

1. Edit schema in `packages/db/src/schema/*.ts`
2. Run `pnpm db:push`
3. If push fails, check error — common issues: column type mismatch, NOT NULL on existing data
4. Fix schema and repeat step 2 until push succeeds
5. Verify with `pnpm db:studio` (Drizzle Studio GUI)

## Adding a New Table

Copy this checklist when adding a table:

```
- [ ] Create schema file: packages/db/src/schema/{table-name}.ts
- [ ] Export from packages/db/src/schema/index.ts
- [ ] Use extensionless imports (drizzle-kit requirement)
- [ ] Add UUID primary key with defaultRandom()
- [ ] Add foreign keys with onDelete strategy
- [ ] Add created_at timestamp with defaultNow()
- [ ] Add indexes for expected query patterns
- [ ] Run pnpm db:push to sync
- [ ] Create matching Zod schema in packages/shared/src/schemas/
- [ ] Seed test data in packages/db/src/seed.ts
```

### Example: Adding a Bookmarks Table

```typescript
// packages/db/src/schema/bookmarks.ts
import { pgTable, uuid, varchar, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./users";
import { posts } from "./posts";

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    platform: varchar("platform", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_user_post_bookmark").on(table.userId, table.postId),
  ],
);
```

```typescript
// packages/db/src/schema/index.ts — add the export
export * from "./users";
export * from "./auth";
export * from "./posts";
export * from "./platforms";
export * from "./notifications";
export * from "./bookmarks";  // new
```

**CRITICAL:** Use extensionless imports in schema files (`"./users"` not `"./users.js"`). drizzle-kit uses its own CJS resolver that breaks with `.js` extensions.

## Adding Indexes via Drizzle

Drizzle supports index definitions in the table's third argument:

```typescript
import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    platform: varchar("platform", { length: 50 }).notNull(),
    publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
    // ... other columns
  },
  (table) => [
    index("idx_posts_user_published").on(table.userId, table.publishedAt),
    index("idx_posts_user_platform").on(table.userId, table.platform, table.publishedAt),
  ],
);
```

### WARNING: Missing Index Definition Syntax

**The Problem:**

```typescript
// BAD — index() without .on() does nothing useful
(table) => [index("my_index")],

// BAD — wrong column reference
(table) => [index("my_index").on(table.nonexistentColumn)],
```

**The Fix:**

```typescript
// GOOD — explicit columns matching your WHERE + ORDER BY
(table) => [
  index("idx_posts_user_published").on(table.userId, table.publishedAt),
],
```

## Cursor Pagination Implementation

The feed and notification endpoints need cursor-based pagination. Use keyset pagination with `(timestamp, id)` as the cursor pair:

```typescript
// In a tRPC router — using Drizzle query builder
import { and, eq, lt, desc, or } from "drizzle-orm";
import { posts } from "@socialhub/db/schema";

// Decode cursor: "2026-02-06T12:00:00Z|uuid-here"
function decodeCursor(cursor: string) {
  const [ts, id] = cursor.split("|");
  return { publishedAt: new Date(ts), id };
}

async function getFeed(db: Database, userId: string, input: FeedInput) {
  const conditions = [eq(posts.userId, userId)];

  if (input.platform) {
    conditions.push(eq(posts.platform, input.platform));
  }

  if (input.cursor) {
    const { publishedAt, id } = decodeCursor(input.cursor);
    conditions.push(
      or(
        lt(posts.publishedAt, publishedAt),
        and(eq(posts.publishedAt, publishedAt), lt(posts.id, id)),
      )!,
    );
  }

  const results = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.publishedAt), desc(posts.id))
    .limit(input.limit + 1);  // fetch one extra to detect hasMore

  const hasMore = results.length > input.limit;
  const items = hasMore ? results.slice(0, -1) : results;
  const nextCursor = hasMore
    ? `${items.at(-1)!.publishedAt.toISOString()}|${items.at(-1)!.id}`
    : null;

  return { posts: items, nextCursor };
}
```

**Why keyset over offset pagination:** Offset pagination (`LIMIT 20 OFFSET 1000`) scans and discards 1000 rows. Keyset pagination uses an index seek — constant time regardless of page depth.

## Database Reset and Seed

```bash
# Full reset: destroy volumes, recreate containers, push schema, seed
pnpm docker:reset && pnpm db:push && pnpm db:seed
```

The seed script (`packages/db/src/seed.ts`) inserts a demo user. Extend it for development:

```typescript
// packages/db/src/seed.ts — add platform connections and posts
await db.insert(platformConnections).values({
  userId: demoUser.id,
  platform: "twitter",
  platformUserId: "12345",
  platformUsername: "demouser",
  accessToken: "dev-token-not-real",
  isActive: true,
});
```

## Production Migration Checklist

When preparing schema changes for production deployment:

```
- [ ] Generate migration: pnpm db:generate
- [ ] Review generated SQL in packages/db/src/migrations/
- [ ] Verify migration is additive (no column drops without backfill plan)
- [ ] Test migration against a copy of production data
- [ ] Check for NOT NULL additions on existing tables (need DEFAULT or backfill)
- [ ] Verify indexes don't use CONCURRENTLY (drizzle-kit doesn't support it — add manually)
- [ ] Run migration on staging first
- [ ] Monitor query performance after migration (new indexes may trigger reindexing)
```

**WARNING:** For large tables, `CREATE INDEX` locks the table. In production, create indexes concurrently by editing the generated migration:

```sql
-- Generated by drizzle-kit (locks table):
CREATE INDEX idx_posts_user_published ON posts (user_id, published_at DESC);

-- Manually change to (no lock, slower build):
CREATE INDEX CONCURRENTLY idx_posts_user_published ON posts (user_id, published_at DESC);
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction block. You may need to split migrations.