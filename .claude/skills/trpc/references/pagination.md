# Pagination Reference

## Contents
- Cursor Pagination Pattern
- Feed Query Example
- Notification Query Example
- Client-Side Infinite Scroll
- WARNING: Offset Pagination
- WARNING: Unbounded Queries

## Cursor Pagination Pattern

SocialHub uses **cursor-based pagination** for all list endpoints. This is the standard pattern:

**Input schema:**

```typescript
z.object({
  cursor: z.string().optional(),   // opaque cursor from previous response
  limit: z.number().int().min(1).max(100).default(20),
})
```

**Return shape:**

```typescript
{
  items: T[],
  nextCursor: string | null,  // null means no more pages
}
```

Cursors are opaque strings — typically the `id` or `createdAt` of the last item. Clients pass them back unchanged.

## Feed Query Example

From `packages/shared/src/schemas/post.schema.ts`:

```typescript
export const feedQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),  // filter by platform
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
```

Router usage in `apps/api/src/trpc/routers/post.router.ts`:

```typescript
feed: protectedProcedure
  .input(feedQuerySchema)
  .query(async ({ ctx, input }) => {
    // Implementation: query posts older than cursor, ordered by publishedAt DESC
    const posts = await ctx.db.query.posts.findMany({
      where: and(
        eq(posts.userId, ctx.userId),
        input.platform ? eq(posts.platform, input.platform) : undefined,
        input.cursor ? lt(posts.publishedAt, new Date(input.cursor)) : undefined,
      ),
      orderBy: [desc(posts.publishedAt)],
      limit: input.limit + 1, // fetch one extra to detect next page
    });

    const hasMore = posts.length > input.limit;
    const items = hasMore ? posts.slice(0, -1) : posts;
    const nextCursor = hasMore ? items[items.length - 1]!.publishedAt.toISOString() : null;

    return { posts: items, nextCursor };
  }),
```

**Key technique:** Fetch `limit + 1` rows. If you get more than `limit`, there's a next page — slice off the extra row and use the last included item as the cursor.

## Notification Query Example

From `packages/shared/src/schemas/platform.schema.ts`:

```typescript
export const notificationQuerySchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  type: z.enum(["mention", "like", "comment", "follow", "repost", "dm"]).optional(),
  unreadOnly: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
```

Additional filters (platform, type, unreadOnly) compose with cursor pagination — they constrain the result set but don't change the pagination mechanism.

## Client-Side Infinite Scroll

tRPC + TanStack Query provides `useInfiniteQuery` for cursor pagination. See the **tanstack-query** skill for full React Query patterns.

### Web (Next.js)

```typescript
import { trpc } from "@/lib/trpc/react";

function Feed() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.post.feed.useInfiniteQuery(
      { limit: 20 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    );

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <>
      {allPosts.map((post) => <PostCard key={post.id} post={post} />)}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </>
  );
}
```

### Mobile (Expo)

Same API — `trpc.post.feed.useInfiniteQuery` works identically since both clients use `@trpc/react-query`.

```typescript
import { trpc } from "../lib/trpc";
import { FlatList } from "react-native";

function Feed() {
  const { data, fetchNextPage, hasNextPage } =
    trpc.post.feed.useInfiniteQuery(
      { limit: 20 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
    );

  const allPosts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <FlatList
      data={allPosts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PostCard post={item} />}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
    />
  );
}
```

## WARNING: Offset Pagination

**The Problem:**

```typescript
// BAD — offset/skip pagination
.input(z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100).default(20),
}))
.query(async ({ input }) => {
  const posts = await db.query.posts.findMany({
    offset: (input.page - 1) * input.limit,
    limit: input.limit,
  });
  return { posts, page: input.page };
})
```

**Why This Breaks:**
1. **Performance degrades linearly** — `OFFSET 10000` scans and discards 10,000 rows
2. **Inconsistent results** — new items shift offsets, causing duplicates or missed items in feeds
3. **Not suitable for real-time data** — social feeds constantly receive new posts

**The Fix:**

Cursor pagination (see patterns above). Cursors use indexed columns (`publishedAt`, `id`) for constant-time seeks regardless of page depth.

**When You Might Be Tempted:** Admin dashboards with page numbers. Even there, prefer keyset pagination — use cursor with "go to page" approximation.

## WARNING: Unbounded Queries

**The Problem:**

```typescript
// BAD — no limit, returns entire table
list: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db.query.posts.findMany({
    where: eq(posts.userId, ctx.userId),
  });
}),
```

**Why This Breaks:**
1. Power users with thousands of posts crash the endpoint
2. Response payload can exceed memory limits
3. Database query time grows unbounded

**The Fix:**

Always enforce a limit, even with a generous default:

```typescript
// GOOD — bounded with default limit
list: protectedProcedure
  .input(z.object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).default(20),
  }))
  .query(async ({ ctx, input }) => {
    const items = await ctx.db.query.posts.findMany({
      where: eq(posts.userId, ctx.userId),
      limit: input.limit + 1,
    });
    // ... cursor logic
  }),
```

## Adding Pagination Checklist

Copy this checklist and track progress:
- [ ] Add `cursor: z.string().optional()` and `limit` with `.default(20)` to input schema
- [ ] Return `{ items, nextCursor: string | null }` from the procedure
- [ ] Fetch `limit + 1` to detect whether a next page exists
- [ ] Use `useInfiniteQuery` on the client with `getNextPageParam`
- [ ] Test with empty results (should return `nextCursor: null`)
- [ ] Test with exactly `limit` results (no extra row = last page)
