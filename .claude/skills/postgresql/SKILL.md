---
name: postgresql
description: |
  Designs PostgreSQL-specific schemas, JSONB columns, and relational data models for the SocialHub monorepo.
  Use when: adding/modifying database tables, designing indexes, optimizing JSONB queries, choosing data types, planning migrations, or troubleshooting query performance in packages/db/.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# PostgreSQL Skill

SocialHub uses PostgreSQL 16 via Docker (port **5433**, not 5432) with Drizzle ORM and the `postgres.js` driver. Schema files live in `packages/db/src/schema/`. All tables use UUID primary keys, snake_case column names, and JSONB for flexible platform-specific payloads (`rawData`, `mediaUrls`). The ORM handles schema-to-SQL mapping — never write raw DDL outside Drizzle schema files. See the **drizzle** skill for ORM-specific patterns.

## Quick Start

### Table Definition (Drizzle → PostgreSQL)

```typescript
// packages/db/src/schema/posts.ts
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  content: text("content").notNull(),
  mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

### JSONB Column with Type Safety

```typescript
// Typed JSONB — Drizzle maps to PostgreSQL jsonb, $type provides TS narrowing
mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| UUID PKs | All tables use `uuid().defaultRandom()` | `gen_random_uuid()` (PG 16 built-in) |
| JSONB | Platform-varying data stored as typed JSONB | `rawData`, `mediaUrls` columns |
| Cascade deletes | FKs use `onDelete: "cascade"` for user-owned data | Posts, notifications, connections |
| Composite PKs | Auth tables use multi-column primary keys | `accounts(provider, providerAccountId)` |
| snake_case | PostgreSQL columns always snake_case | `platform_post_id`, `created_at` |
| Port 5433 | Docker maps 5433→5432 internally | `DATABASE_URL` must use port 5433 |

## Common Patterns

### Cursor-Based Pagination

**When:** Implementing feed or notification list endpoints.

```sql
-- Cursor pagination on posts (keyset pagination)
SELECT * FROM posts
WHERE user_id = $1
  AND (published_at, id) < ($2, $3)  -- cursor = (published_at, id)
ORDER BY published_at DESC, id DESC
LIMIT 20;
```

### JSONB Querying

**When:** Filtering or extracting data from `raw_data` or `media_urls`.

```sql
-- Check if media_urls array is non-empty
SELECT * FROM posts WHERE jsonb_array_length(media_urls) > 0;

-- Extract nested field from raw_data
SELECT raw_data->>'originalUrl' AS url FROM posts WHERE platform = 'twitter';
```

### Index for Feed Queries

**When:** The feed query filters by `user_id` + `platform` and sorts by `published_at`.

```sql
CREATE INDEX idx_posts_user_feed ON posts (user_id, platform, published_at DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);
```

## See Also

- [patterns](references/patterns.md)
- [workflows](references/workflows.md)

## Related Skills

- See the **drizzle** skill for ORM schema definitions, query building, and migration workflows
- See the **zod** skill for shared validation schemas that mirror DB column constraints
- See the **redis** skill for caching feed queries and reducing DB load
- See the **meilisearch** skill for full-text search offloaded from PostgreSQL
- See the **trpc** skill for connecting DB queries to type-safe API procedures

## Documentation Resources

> Fetch latest PostgreSQL 16 documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "postgresql"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/postgresql` _(High reputation, 61K+ snippets)_

**Recommended Queries:**
- "JSONB operators and indexing"
- "UUID generation gen_random_uuid"
- "GIN index for JSONB columns"
- "Cursor-based keyset pagination"
- "Partial index creation"