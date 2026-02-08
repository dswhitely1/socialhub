# PostgreSQL Patterns Reference

## Contents
- Data Type Choices
- JSONB Column Design
- Indexing Strategy
- Referential Integrity
- WARNING: Missing Indexes
- WARNING: Untyped Platform Columns
- WARNING: No Encryption at Rest for Tokens

## Data Type Choices

### UUID Primary Keys

All SocialHub tables use `uuid` with `gen_random_uuid()` (PostgreSQL 16 built-in — no extension needed).

```typescript
// packages/db/src/schema/users.ts
id: uuid("id").primaryKey().defaultRandom(),
```

**Trade-off:** UUIDs are 16 bytes vs 4 bytes for `serial`. This matters at scale for index size. For SocialHub's use case (100K+ concurrent users), UUIDs are correct — they prevent ID enumeration attacks and enable distributed ID generation.

### varchar vs text

```typescript
// GOOD — bounded columns use varchar with explicit length
platform: varchar("platform", { length: 50 }).notNull(),
email: varchar("email", { length: 255 }).notNull().unique(),

// GOOD — unbounded content uses text
content: text("content").notNull(),
body: text("body").notNull(),
```

**Rule:** Use `varchar(n)` for columns with a natural maximum (email, platform name, handle). Use `text` for user-generated content with no meaningful upper bound. See the **zod** skill for matching validation constraints.

### Timestamp Columns

```typescript
// GOOD — mode: "date" returns JS Date objects via Drizzle
createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
publishedAt: timestamp("published_at", { mode: "date" }).notNull(),
```

**WARNING:** PostgreSQL `timestamp` without time zone stores local time. For a multi-timezone app like SocialHub, prefer `timestamp with time zone` (`timestamptz`). Drizzle's `timestamp()` maps to `timestamp without time zone` by default. Use `{ withTimezone: true }` for correctness:

```typescript
// BAD — stores without timezone, ambiguous across regions
createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),

// GOOD — stores with timezone, unambiguous
createdAt: timestamp("created_at", { mode: "date", withTimezone: true }).notNull().defaultNow(),
```

## JSONB Column Design

SocialHub uses JSONB for two purposes:

1. **`rawData`** — preserves the exact API response from each social platform for debugging and schema drift resilience
2. **`mediaUrls`** — stores variable-length arrays of media URLs

```typescript
// packages/db/src/schema/posts.ts
mediaUrls: jsonb("media_urls").$type<string[]>().default([]),
rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
```

### DO: Use JSONB for platform-varying data

```typescript
// GOOD — each platform returns different fields
rawData: jsonb("raw_data").$type<Record<string, unknown>>().default({}),
```

### DON'T: Use JSONB for data you query frequently

```sql
-- BAD — filtering on JSONB field without a GIN index is a sequential scan
SELECT * FROM posts WHERE raw_data->>'hashtag' = 'typescript';

-- GOOD — promote frequently-queried JSONB fields to real columns
ALTER TABLE posts ADD COLUMN hashtags text[];
CREATE INDEX idx_posts_hashtags ON posts USING GIN (hashtags);
```

**Why:** JSONB queries without GIN indexes force sequential scans. If you find yourself filtering on the same JSONB path repeatedly, extract it to a proper column.

### GIN Indexes for JSONB

```sql
-- Index raw_data for containment queries (@>)
CREATE INDEX idx_posts_raw_data ON posts USING GIN (raw_data);

-- Then query efficiently:
SELECT * FROM posts WHERE raw_data @> '{"source": "mobile"}';
```

## Indexing Strategy

### WARNING: Missing Indexes on Feed Queries

**The Problem:** The current schema defines no indexes beyond primary keys and the `users.email` unique constraint. Every feed query will sequential-scan the `posts` table.

**Why This Breaks:**
1. Feed endpoint (`post.feed`) filters by `user_id` + optional `platform`, sorted by `published_at` DESC
2. Notifications filter by `user_id` + `is_read` + optional `platform`/`type`
3. Without indexes, query time grows linearly with table size — unusable past ~10K rows

**The Fix:** Add composite indexes matching query patterns:

```sql
-- Feed: filter by user, optionally by platform, sort by publish time
CREATE INDEX idx_posts_user_published ON posts (user_id, published_at DESC);
CREATE INDEX idx_posts_user_platform_published ON posts (user_id, platform, published_at DESC);

-- Notifications: unread-first pattern
CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);

-- Platform connections: lookup by user
CREATE INDEX idx_platform_connections_user ON platform_connections (user_id, platform);

-- Unique constraint: one connection per user per platform
ALTER TABLE platform_connections
  ADD CONSTRAINT uq_user_platform UNIQUE (user_id, platform);
```

### Partial Indexes

Use partial indexes when most queries target a subset of rows:

```sql
-- Only index active platform connections (inactive ones rarely queried)
CREATE INDEX idx_active_connections ON platform_connections (user_id, platform)
  WHERE is_active = true;

-- Only index unread notifications
CREATE INDEX idx_unread_notifications ON notifications (user_id, created_at DESC)
  WHERE is_read = false;
```

## Referential Integrity

### Cascade Delete Pattern

All user-owned tables cascade on delete — deleting a user removes their posts, connections, and notifications:

```typescript
// packages/db/src/schema/posts.ts
userId: uuid("user_id")
  .notNull()
  .references(() => users.id, { onDelete: "cascade" }),
```

**This is correct for SocialHub.** User deletion should wipe all associated data per the privacy requirements (minimal data retention).

### Composite Primary Keys

Auth.js tables use composite PKs instead of synthetic IDs:

```typescript
// packages/db/src/schema/auth.ts
(account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
],
```

## WARNING: Untyped Platform Columns

**The Problem:** `platform` columns use `varchar(50)` with no CHECK constraint. Any string can be inserted.

```typescript
// Current — no database-level validation
platform: varchar("platform", { length: 50 }).notNull(),
```

**Why This Breaks:** Zod validates on the API boundary, but direct DB inserts (seeds, migrations, background jobs) can insert invalid platform names.

**The Fix:** Add a CHECK constraint or use a PostgreSQL `enum` type:

```sql
-- Option A: CHECK constraint (preferred — easier to modify)
ALTER TABLE posts ADD CONSTRAINT chk_posts_platform
  CHECK (platform IN ('twitter', 'instagram', 'linkedin', 'bluesky', 'mastodon'));

-- Option B: PostgreSQL enum type (harder to add values later)
CREATE TYPE platform_type AS ENUM ('twitter', 'instagram', 'linkedin', 'bluesky', 'mastodon');
```

## WARNING: No Encryption at Rest for Tokens

**The Problem:** `access_token` and `refresh_token` in `platform_connections` are stored as plaintext `text` columns.

**Why This Breaks:** The PRD requires "OAuth 2.0 token storage encrypted at rest; zero plaintext secrets." A database breach exposes all user tokens.

**The Fix:** Encrypt tokens at the application layer before storing. Use `pgcrypto` or application-level AES-256 encryption:

```typescript
// Encrypt before insert, decrypt after select
import { encrypt, decrypt } from "../lib/crypto.js";

accessToken: encrypt(rawToken),  // store ciphertext
// On read: decrypt(row.accessToken)
```