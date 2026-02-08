---
name: drizzle
description: |
  Designs type-safe database schemas and writes SQL-like queries with Drizzle ORM.
  Use when: creating/modifying tables in packages/db/src/schema/, writing queries in tRPC routers or services,
  running migrations, seeding data, or configuring Drizzle Kit.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Drizzle Skill

SocialHub uses **Drizzle ORM v0.38.x** with the `postgres.js` driver for type-safe SQL. Schema files live in `packages/db/src/schema/` as a source-only package (no build step). The database client is created via `createDb()` in `packages/db/src/client.ts` and injected into tRPC context. PostgreSQL runs on port **5433** (not 5432).

## Quick Start

### Table Definition

```typescript
// packages/db/src/schema/posts.ts
import { pgTable, uuid, text, timestamp, jsonb, varchar } from "drizzle-orm/pg-core";
import { users } from "./users";  // NOTE: extensionless import for drizzle-kit

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: varchar("platform", { length: 50 }).notNull(),
  content: text("content").notNull(),
  rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
  publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

### Query in tRPC Router

```typescript
// apps/api/src/trpc/routers/post.router.ts
import { eq, desc } from "drizzle-orm";
import { posts } from "@socialhub/db/schema";

feed: protectedProcedure
  .input(feedQuerySchema)
  .query(async ({ ctx, input }) => {
    return ctx.db
      .select()
      .from(posts)
      .where(eq(posts.userId, ctx.userId))
      .orderBy(desc(posts.publishedAt))
      .limit(input.limit);
  }),
```

## Key Concepts

| Concept | Pattern | Example |
|---------|---------|---------|
| UUID primary keys | `uuid().primaryKey().defaultRandom()` | `gen_random_uuid()` (PG 16 built-in) |
| JSONB typing | `jsonb().$type<T>().default({})` | Platform-specific metadata |
| Timestamps | `timestamp("col", { mode: "date" })` | Always with `mode: "date"` |
| Cascade deletes | `references(() => t.id, { onDelete: "cascade" })` | User-owned data |
| Type inference | `typeof table.$inferSelect` | Extract TS types from tables |
| Extensionless imports | `import { users } from "./users"` | Required for drizzle-kit |

## Common Patterns

### Insert and Return

```typescript
const [newPost] = await db
  .insert(posts)
  .values({ userId, platform, content, publishedAt: new Date() })
  .returning();
```

### Update with Where

```typescript
await db
  .update(notifications)
  .set({ isRead: true })
  .where(eq(notifications.id, notificationId));
```

### Upsert (Insert on Conflict)

```typescript
await db
  .insert(posts)
  .values(postData)
  .onConflictDoUpdate({
    target: [posts.userId, posts.externalId],
    set: { content: postData.content },
  });
```

## Schema Commands

| Command | When to use |
|---------|-------------|
| `pnpm db:push` | Push schema changes to DB (dev iteration) |
| `pnpm db:generate` | Generate migration SQL files |
| `pnpm db:migrate` | Run migrations (production-safe) |
| `pnpm db:seed` | Seed with demo data |
| `pnpm db:studio` | Open Drizzle Studio GUI |

## See Also

- [patterns](references/patterns.md) — Schema conventions, JSONB typing, foreign keys, query patterns, anti-patterns
- [workflows](references/workflows.md) — Adding tables, migrations, seeding, client setup, common errors

## Related Skills

- See the **postgresql** skill for PostgreSQL-specific features, JSONB indexing, and query optimization
- See the **zod** skill for shared validation schemas that mirror DB constraints
- See the **trpc** skill for using Drizzle queries inside tRPC procedures
- See the **typescript** skill for type inference patterns and strict mode

## Documentation Resources

> Fetch latest Drizzle ORM documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "drizzle-orm"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/drizzle-team/drizzle-orm`

**Recommended Queries:**
- "Drizzle pgTable schema definition"
- "Drizzle select where orderBy limit"
- "Drizzle insert returning"
- "Drizzle JSONB column type"
- "Drizzle relations one many"
