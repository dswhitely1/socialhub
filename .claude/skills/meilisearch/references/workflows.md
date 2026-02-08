# Meilisearch Workflows Reference

## Contents
- Initial Setup
- Adding a New Index
- Indexing Pipeline (Feed Polling)
- Consuming Search from Clients
- Debugging and Health Checks
- Resetting Search Data

---

## Initial Setup

Copy this checklist and track progress:
- [ ] Ensure Docker is running (`pnpm docker:up`) — Meilisearch on port 7700
- [ ] Verify `.env` has `MEILI_URL=http://localhost:7700` and `MEILI_MASTER_KEY=socialhub_dev_key`
- [ ] Add `setupSearchIndexes()` call in Fastify `onReady` hook
- [ ] Start API server (`pnpm dev`) — indexes are created automatically
- [ ] Verify at `http://localhost:7700` (Meilisearch dashboard)

```bash
# Verify Meilisearch is healthy
curl http://localhost:7700/health
# => {"status":"available"}

# Check indexes exist
curl -H "Authorization: Bearer socialhub_dev_key" http://localhost:7700/indexes
```

---

## Adding a New Index

Copy this checklist and track progress:
- [ ] Define document interface in `search.service.ts`
- [ ] Add index constant (`const USERS_INDEX = "users"`)
- [ ] Add settings in `setupSearchIndexes()`
- [ ] Add index/search service functions
- [ ] Add tRPC procedure in `search.router.ts`
- [ ] Validate: `pnpm typecheck` — fix and repeat until passing

```typescript
// apps/api/src/services/search.service.ts
const USERS_INDEX = "users";

interface SearchableUser {
  id: string;
  name: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
}

export async function indexUsers(users: SearchableUser[]) {
  if (users.length === 0) return;
  await getMeiliSearch().index(USERS_INDEX).addDocuments(users);
}

export async function searchUsers(query: string, options?: { platform?: string; limit?: number }) {
  const filters: string[] = [];
  if (options?.platform) filters.push(`platform = "${options.platform}"`);
  return getMeiliSearch().index(USERS_INDEX).search(query, {
    filter: filters.length > 0 ? filters.join(" AND ") : undefined,
    limit: options?.limit ?? 20,
  });
}
```

---

## Indexing Pipeline (Feed Polling)

Document flow: **Platform API -> BullMQ Worker -> PostgreSQL -> Meilisearch**. See the **bullmq** skill for job patterns.

### WARNING: Indexing Before Database Insert

```typescript
// BAD — search returns documents that don't exist in the DB
await indexPosts(transformedPosts);
await db.insert(posts).values(transformedPosts); // Could fail!
```

```typescript
// GOOD — DB is source of truth, index after successful insert
const inserted = await db.insert(posts).values(transformedPosts).returning();
await indexPosts(inserted.map(toSearchablePost));
```

### Transform DB Rows to Search Documents

```typescript
import type { InferSelectModel } from "drizzle-orm";
import type { posts } from "@socialhub/db";

type Post = InferSelectModel<typeof posts>;

export function toSearchablePost(post: Post): SearchablePost {
  return {
    id: post.id, content: post.content,
    authorName: post.authorName, authorHandle: post.authorHandle,
    platform: post.platform, userId: post.userId,
    publishedAt: Math.floor(post.publishedAt.getTime() / 1000),
    likes: post.likes,
  };
}
```

---

## Consuming Search from Clients

See the **tanstack-query** skill — tRPC wraps React Query automatically.

```typescript
// apps/web/src/components/search/search-results.tsx
"use client";
import { trpc } from "@/lib/trpc/react";

export function SearchResults({ query, platform }: { query: string; platform?: string }) {
  const { data, isLoading } = trpc.search.posts.useQuery(
    { query, platform, limit: 20 },
    { enabled: query.length > 0 },
  );
  if (isLoading) return <div>Searching...</div>;
  return (
    <ul>
      {data?.hits.map((hit) => <li key={hit.id}>{hit.content}</li>)}
    </ul>
  );
}
```

---

## Debugging and Health Checks

```bash
# List indexes and document counts
curl -s -H "Authorization: Bearer socialhub_dev_key" \
  http://localhost:7700/indexes | jq '.results[] | {uid, numberOfDocuments}'

# Check pending tasks
curl -s -H "Authorization: Bearer socialhub_dev_key" \
  http://localhost:7700/tasks?statuses=enqueued,processing | jq '.total'
```

| Error | Cause | Fix |
|-------|-------|-----|
| `MeiliSearchCommunicationError` | Not running | `pnpm docker:up` |
| `invalid_api_key` | Wrong master key | Check `.env` matches `docker-compose.yml` |
| `Attribute X is not filterable` | Missing setting | Add to `updateSettings()` |
| `Attribute X is not sortable` | Missing setting | Add to `updateSettings()` |

### Re-index from Database

When search data gets out of sync with PostgreSQL:

```typescript
export async function reindexAllPosts(db: Database) {
  const meili = getMeiliSearch();
  await meili.index(POSTS_INDEX).deleteAllDocuments();
  const BATCH_SIZE = 500;
  let offset = 0;
  while (true) {
    const batch = await db.select().from(posts).limit(BATCH_SIZE).offset(offset);
    if (batch.length === 0) break;
    await meili.index(POSTS_INDEX).addDocuments(batch.map(toSearchablePost));
    offset += BATCH_SIZE;
  }
}
```

---

## Resetting Search Data

```bash
# Full reset (destroys Meilisearch volume)
pnpm docker:reset && pnpm db:push && pnpm db:seed

# Delete a single index
curl -X DELETE -H "Authorization: Bearer socialhub_dev_key" \
  http://localhost:7700/indexes/posts
```

### WARNING: Using Master Key in Production

The `MEILI_MASTER_KEY` has full admin access. In production, generate scoped API keys:

```typescript
const searchKey = await meili.generateTenantToken(
  meili.config.apiKey!,
  { filter: "userId = USER_ID" },  // tenant isolation
  { expiresAt: new Date(Date.now() + 3600_000) },
);
```

For local dev, the master key in `.env` is fine. NEVER commit real keys.
