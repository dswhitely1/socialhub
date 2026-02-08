# TanStack Query Workflows

## Contents
- Adding a New tRPC Query to a Component
- Adding a New Mutation with Invalidation
- Converting a Query to Infinite Query
- Wiring Socket.IO Events to Cache Invalidation
- Debugging Stale Data and Cache Issues
- QueryClient Defaults Checklist

---

## Adding a New tRPC Query to a Component

The tRPC router procedure must already exist (see the **trpc** skill). This workflow covers the client-side consumption.

### Steps

1. Import the `trpc` client from the appropriate location:

```tsx
// Web: apps/web/src/lib/trpc/react.tsx
import { trpc } from "@/lib/trpc/react";

// Mobile: apps/mobile/src/lib/trpc.ts
import { trpc } from "../lib/trpc";
```

2. Call the query in your component:

```tsx
function PlatformList() {
  const { data: platforms, isLoading, error } = trpc.platform.list.useQuery();

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <ul>
      {platforms.map((p) => (
        <li key={p.id}>{p.platformUsername}</li>
      ))}
    </ul>
  );
}
```

3. Validate with typecheck:

```bash
pnpm typecheck
```

4. If typecheck fails on the return type, check the procedure in `apps/api/src/trpc/routers/` — the return type drives the client type.

### Workflow Checklist

Copy this checklist and track progress:
- [ ] Step 1: Verify the tRPC procedure exists in `apps/api/src/trpc/routers/`
- [ ] Step 2: Import `trpc` from the correct lib path
- [ ] Step 3: Call `trpc.<router>.<procedure>.useQuery()` with correct input
- [ ] Step 4: Handle `isLoading`, `error`, and `data` states in JSX
- [ ] Step 5: Run `pnpm typecheck` — fix any type errors
- [ ] Step 6: Test in browser/device — verify data renders

---

## Adding a New Mutation with Invalidation

### Steps

1. Get the tRPC utils for cache operations:

```tsx
const utils = trpc.useUtils();
```

2. Create the mutation with `onSuccess` invalidation:

```tsx
const updateProfile = trpc.user.update.useMutation({
  onSuccess: () => {
    utils.user.me.invalidate();
  },
});
```

3. Wire it to a form or button:

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    updateProfile.mutate({ name: newName, avatarUrl: newAvatar });
  }}
>
  <input value={newName} onChange={(e) => setNewName(e.target.value)} />
  <button disabled={updateProfile.isPending}>
    {updateProfile.isPending ? "Saving..." : "Save"}
  </button>
  {updateProfile.error && <p>{updateProfile.error.message}</p>}
</form>
```

4. Validate:

```bash
pnpm typecheck
```

### Deciding What to Invalidate

| Mutation | Invalidate |
|----------|-----------|
| `post.create` | `post.feed` |
| `platform.connect` | `platform.list`, `post.feed` |
| `platform.disconnect` | `platform.list`, `post.feed` |
| `notification.markRead` | `notification.list` |
| `notification.markAllRead` | `notification.list` |
| `user.update` | `user.me` |

### Workflow Checklist

Copy this checklist and track progress:
- [ ] Step 1: Get `utils` via `trpc.useUtils()`
- [ ] Step 2: Define mutation with `onSuccess` invalidation
- [ ] Step 3: Wire to UI (form, button, gesture)
- [ ] Step 4: Handle `isPending` and `error` states
- [ ] Step 5: Run `pnpm typecheck`
- [ ] Step 6: Test the full cycle: trigger mutation, verify cache invalidation

---

## Converting a Query to Infinite Query

Feed (`post.feed`) and notifications (`notification.list`) return `{ items, nextCursor }` — they should use `useInfiniteQuery` for cursor pagination.

### Before (Simple Query)

```tsx
const { data } = trpc.post.feed.useQuery({ limit: 20 });
```

### After (Infinite Query)

```tsx
const {
  data,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
} = trpc.post.feed.useInfiniteQuery(
  { limit: 20 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  },
);

// Flatten pages into a single array
const posts = data?.pages.flatMap((page) => page.posts) ?? [];
```

### Key Differences from useQuery

| Aspect | `useQuery` | `useInfiniteQuery` |
|--------|-----------|-------------------|
| Data shape | `data: T` | `data.pages: T[]` |
| Pagination | Manual cursor management | Auto via `getNextPageParam` |
| Loading more | N/A | `fetchNextPage()`, `hasNextPage` |
| Cache key | Auto from input | Same, but pages are stored as array |

### Validation Loop

1. Implement the infinite query
2. Validate: `pnpm typecheck`
3. If `getNextPageParam` type errors, check the procedure's return type — it must include `nextCursor`
4. Test in browser: trigger "load more", verify new pages append

---

## Wiring Socket.IO Events to Cache Invalidation

When the API pushes real-time events (see the **socket-io** skill), the client should invalidate relevant caches rather than manually updating state.

### Implementation

```tsx
// apps/web/src/components/realtime-provider.tsx
"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { trpc } from "@/lib/trpc/react";
import { useNotificationStore } from "@/stores/notification.store";

export function RealtimeProvider({ userId }: { userId: string }) {
  const utils = trpc.useUtils();
  const { incrementUnread } = useNotificationStore();

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!);
    socket.emit("join", userId);

    socket.on("notification", () => {
      utils.notification.list.invalidate();
      incrementUnread();
    });

    socket.on("feed-update", () => {
      utils.post.feed.invalidate();
    });

    return () => {
      socket.disconnect();
    };
  }, [utils, userId, incrementUnread]);

  return null;
}
```

### WARNING: Manually Updating Cache from Socket Events

**The Problem:**

```tsx
// BAD — manually patching cache from socket data
socket.on("notification", (notification) => {
  utils.notification.list.setData(undefined, (old) => ({
    ...old,
    notifications: [notification, ...old.notifications],
  }));
});
```

**Why This Breaks:**
1. Socket payload shape may differ from query return type
2. No cursor/pagination awareness — corrupts infinite query pages
3. Race condition with in-flight queries

**The Fix:** Use `invalidate()` to trigger a clean refetch. The server is the source of truth.

---

## Debugging Stale Data and Cache Issues

### Symptoms and Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Data doesn't update after mutation | Missing `onSuccess` invalidation | Add `utils.<router>.<procedure>.invalidate()` |
| Component shows old data on mount | `staleTime: Infinity` or too high | Lower `staleTime` or remove override |
| Multiple identical requests | `staleTime: 0` (default) with many mounts | Set reasonable `staleTime` (e.g., 30s) |
| Data disappears on tab switch | `gcTime` too low | Increase `gcTime` (default 5min is usually fine) |
| Infinite scroll resets on refetch | Not using `useInfiniteQuery` | Convert to `useInfiniteQuery` with proper page params |

### Install React Query DevTools (Web Only)

```bash
pnpm --filter @socialhub/web add -D @tanstack/react-query-devtools
```

```tsx
// apps/web/src/lib/trpc/react.tsx — inside TRPCProvider
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

return (
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </trpc.Provider>
);
```

DevTools lets you inspect every query's state, cache data, and manually trigger refetches or invalidation.

### Validation Loop

1. Open React Query DevTools in browser
2. Identify the stale/missing query by key
3. Check if `staleTime`, `gcTime`, or `enabled` is misconfigured
4. Verify `onSuccess` invalidation is wired for related mutations
5. If still broken, check the API procedure returns the expected shape

---

## QueryClient Defaults Checklist

When configuring QueryClient defaults, consider the app's data freshness needs.

### Recommended Defaults for SocialHub

```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,           // 30s — social feeds change frequently
      gcTime: 5 * 60_000,          // 5min — keep inactive data in memory
      retry: 2,                    // Retry failed requests twice
      refetchOnWindowFocus: true,  // Refetch when user returns to tab
      refetchOnReconnect: true,    // Refetch when network reconnects
    },
    mutations: {
      retry: 0,                    // Don't auto-retry mutations
    },
  },
})
```

### Per-Query Overrides

| Query | Recommended staleTime | Why |
|-------|----------------------|-----|
| `user.me` | `5 * 60_000` (5min) | User profile rarely changes |
| `platform.list` | `60_000` (1min) | Platform connections change infrequently |
| `post.feed` | `30_000` (30s) | Social feeds update often |
| `notification.list` | `15_000` (15s) | Notifications need near-real-time freshness |
| `search.posts` | `60_000` (1min) | Search results don't change rapidly |

```tsx
// Override per-query
const { data: user } = trpc.user.me.useQuery(undefined, {
  staleTime: 5 * 60_000,
});
```

Copy this checklist and track progress:
- [ ] Step 1: Set QueryClient defaults in TRPCProvider (web) and AppProvider (mobile)
- [ ] Step 2: Override staleTime for slow-changing queries (`user.me`, `platform.list`)
- [ ] Step 3: Set lower staleTime for fast-changing queries (`notification.list`)
- [ ] Step 4: Install React Query DevTools for web
- [ ] Step 5: Verify no redundant fetches in DevTools network tab
