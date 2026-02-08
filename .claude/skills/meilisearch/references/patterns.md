# Meilisearch Patterns Reference

## Contents
- Index Design and Document Structure
- Search with Filters and Sorting
- Batch Indexing
- Index Settings Configuration
- Connecting Search to tRPC

---

## Index Design and Document Structure

SocialHub needs two indexes: `posts` and `users`. Map from Drizzle tables (see the **postgresql** skill) to flat search documents — only fields needed for search, filtering, and display.

```typescript
// apps/api/src/services/search.service.ts
const POSTS_INDEX = "posts";
const USERS_INDEX = "users";

interface SearchablePost {
  id: string;           // Primary key (uuid from posts table)
  content: string;      // Main searchable field
  authorName: string;
  authorHandle: string;
  platform: string;     // Filterable: "twitter" | "instagram" | etc.
  userId: string;       // Filterable: scope results to user
  publishedAt: number;  // Unix timestamp — NOT ISO string
  likes: number;        // Sortable engagement metric
}
```

### WARNING: Storing Dates as ISO Strings

```typescript
// BAD — Meilisearch sorts strings lexicographically
await index.addDocuments([{ publishedAt: "2026-02-07T10:30:00Z" }]);
```

```typescript
// GOOD — convert to Unix timestamp (seconds)
{ publishedAt: Math.floor(post.publishedAt.getTime() / 1000) }
```

---

## Search with Filters and Sorting

Filters require `filterableAttributes` set **before** documents are added.

```typescript
export async function searchPosts(
  query: string,
  options: { platform?: string; userId?: string; limit?: number; offset?: number },
) {
  const meili = getMeiliSearch();
  const filters: string[] = [];
  if (options.platform) filters.push(`platform = "${options.platform}"`);
  if (options.userId) filters.push(`userId = "${options.userId}"`);

  return meili.index(POSTS_INDEX).search(query, {
    filter: filters.length > 0 ? filters.join(" AND ") : undefined,
    sort: ["publishedAt:desc"],
    limit: options.limit ?? 20,
    offset: options.offset ?? 0,
  });
}
```

### Faceted Search (platform counts)

```typescript
const results = await meili.index(POSTS_INDEX).search(query, { facets: ["platform"] });
// results.facetDistribution => { platform: { twitter: 42, linkedin: 15 } }
```

### WARNING: Filtering on Non-Filterable Attributes

```typescript
// BAD — throws MeiliSearchApiError: "Attribute `platform` is not filterable"
await index.search("hello", { filter: ["platform = twitter"] });
```

Configure filterable/sortable attributes BEFORE adding documents:

```typescript
await index.updateFilterableAttributes(["platform", "userId"]);
await index.updateSortableAttributes(["publishedAt", "likes"]);
```

---

## Batch Indexing

`addDocuments` is idempotent (same primary key = upsert). Always batch.

```typescript
export async function indexPosts(posts: SearchablePost[]) {
  if (posts.length === 0) return;
  const meili = getMeiliSearch();
  const task = await meili.index(POSTS_INDEX).addDocuments(posts);
  await meili.waitForTask(task.taskUid);
}
```

### WARNING: Indexing One Document at a Time

```typescript
// BAD — N round-trips, N queued tasks, degrades search latency
for (const post of posts) {
  await meili.index(POSTS_INDEX).addDocuments([post]);
}
```

Collect into an array first, then batch. See the **bullmq** skill for feed-polling patterns.

---

## Index Settings Configuration

Run once on startup. `updateSettings` is idempotent.

```typescript
export async function setupSearchIndexes() {
  const meili = getMeiliSearch();
  const postsTask = await meili.index(POSTS_INDEX).updateSettings({
    searchableAttributes: ["content", "authorName", "authorHandle"],
    filterableAttributes: ["platform", "userId"],
    sortableAttributes: ["publishedAt", "likes"],
    rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness"],
    typoTolerance: { minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 } },
    pagination: { maxTotalHits: 1000 },
  });
  const usersTask = await meili.index(USERS_INDEX).updateSettings({
    searchableAttributes: ["name", "handle"],
    filterableAttributes: ["platform"],
  });
  await meili.waitForTask(postsTask.taskUid);
  await meili.waitForTask(usersTask.taskUid);
}
```

Register in Fastify lifecycle (see the **fastify** skill):

```typescript
fastify.addHook("onReady", async () => { await setupSearchIndexes(); });
```

---

## Connecting Search to tRPC

The router calls the service layer, never the client directly. See the **trpc** and **zod** skills.

```typescript
// apps/api/src/trpc/routers/search.router.ts
export const searchRouter = router({
  posts: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(200),
      platform: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
      offset: z.number().int().nonnegative().default(0),
    }))
    .query(async ({ input, ctx }) => {
      const raw = await searchPosts(input.query, {
        platform: input.platform, userId: ctx.user.id,
        limit: input.limit, offset: input.offset,
      });
      return { hits: raw.hits, totalHits: raw.estimatedTotalHits ?? 0 };
    }),
});
```

### WARNING: Exposing Raw Meilisearch Responses

```typescript
// BAD — leaks processingTimeMs, _rankingScore, couples API to Meilisearch shape
.query(async ({ input }) => meili.index("posts").search(input.query))
```

Always map to your own response shape in the service or router layer.
