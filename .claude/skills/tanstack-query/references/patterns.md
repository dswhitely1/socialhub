# TanStack Query Patterns

## Contents
- Provider Setup (tRPC + QueryClient)
- tRPC Query Patterns
- tRPC Mutation with Cache Invalidation
- Optimistic Updates
- Infinite Queries (Cursor Pagination)
- Zustand + React Query Integration
- Socket.IO Real-Time Invalidation
- Anti-Patterns

---

## Provider Setup (tRPC + QueryClient)

Both web (`apps/web/src/lib/trpc/react.tsx`) and mobile (`apps/mobile/src/providers/app-provider.tsx`) share the same pattern — tRPC Provider wraps QueryClientProvider with a shared QueryClient instance.

```tsx
// apps/web/src/lib/trpc/react.tsx
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,       // 30s before refetch
            gcTime: 5 * 60_000,      // 5min garbage collection
            retry: 2,
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${process.env.NEXT_PUBLIC_API_URL}/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
```

Mobile differs only in auth headers — see the **react-native** skill for SecureStore token injection.

---

## tRPC Query Patterns

All queries go through tRPC. The query key is auto-generated from the router path.

```tsx
// Simple query — platform list
const { data: platforms, isLoading, error } = trpc.platform.list.useQuery();

// Query with input — search posts (see the **zod** skill for schema)
const { data: results } = trpc.search.posts.useQuery(
  { query: searchTerm, limit: 20 },
  { enabled: searchTerm.length > 0 },  // only run when user types
);

// Current user — fires once, rarely changes
const { data: user } = trpc.user.me.useQuery(undefined, {
  staleTime: 5 * 60_000,  // cache for 5 minutes
});
```

**`enabled` option** is critical for conditional fetching. NEVER wrap a query in an `if` statement — use `enabled` instead.

---

## tRPC Mutation with Cache Invalidation

Use `trpc.useUtils()` for cache operations. Invalidation triggers a background refetch.

```tsx
function DisconnectPlatformButton({ platformId }: { platformId: string }) {
  const utils = trpc.useUtils();

  const disconnect = trpc.platform.disconnect.useMutation({
    onSuccess: () => {
      // Invalidate platform list — triggers refetch
      utils.platform.list.invalidate();
      // Also invalidate feed since it depends on connected platforms
      utils.post.feed.invalidate();
    },
  });

  return (
    <button
      onClick={() => disconnect.mutate({ id: platformId })}
      disabled={disconnect.isPending}
    >
      {disconnect.isPending ? "Disconnecting..." : "Disconnect"}
    </button>
  );
}
```

---

## Optimistic Updates

For interactions that need instant UI feedback (likes, marking notifications read):

```tsx
const utils = trpc.useUtils();

const markRead = trpc.notification.markRead.useMutation({
  onMutate: async ({ ids }) => {
    // Cancel in-flight fetches
    await utils.notification.list.cancel();

    // Snapshot current data
    const previous = utils.notification.list.getData();

    // Optimistically mark as read
    utils.notification.list.setData(undefined, (old) => {
      if (!old) return old;
      return {
        ...old,
        notifications: old.notifications.map((n) =>
          ids.includes(n.id) ? { ...n, isRead: true } : n,
        ),
      };
    });

    return { previous };
  },
  onError: (_err, _vars, context) => {
    // Rollback on failure
    if (context?.previous) {
      utils.notification.list.setData(undefined, context.previous);
    }
  },
  onSettled: () => {
    // Always refetch to sync with server truth
    utils.notification.list.invalidate();
  },
});
```

**Rule of thumb:** Use optimistic updates only for interactions where the user expects instant feedback (likes, reads, bookmarks). For heavier operations (post creation, platform connect), simple invalidation is fine.

---

## Infinite Queries (Cursor Pagination)

Feed and notifications use cursor-based pagination. The `feedQuerySchema` and `notificationQuerySchema` both include `cursor` and `limit` fields.

```tsx
function FeedList() {
  const { selectedPlatform } = useFeedStore();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = trpc.post.feed.useInfiniteQuery(
    { platform: selectedPlatform ?? undefined, limit: 20 },
    { getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined },
  );

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </>
  );
}
```

---

## Zustand + React Query Integration

Zustand stores hold **UI state only** (filters, sidebar, ordering). React Query holds **server state**. They connect through query inputs — see the **zustand** skill.

```tsx
// Zustand store drives the filter
const { selectedPlatform } = useFeedStore();

// React Query re-fetches when selectedPlatform changes
const feed = trpc.post.feed.useQuery({
  platform: selectedPlatform ?? undefined,
  limit: 20,
});
```

### WARNING: Duplicating Server State in Zustand

**The Problem:**

```tsx
// BAD — storing API data in Zustand
const useFeedStore = create((set) => ({
  posts: [],
  setPosts: (posts) => set({ posts }),
  fetchPosts: async () => {
    const res = await fetch("/api/posts");
    set({ posts: await res.json() });
  },
}));
```

**Why This Breaks:**
1. No caching — every mount re-fetches
2. No stale/fresh tracking — always shows potentially outdated data
3. No automatic background refetch — user sees stale data forever
4. No deduplication — multiple components trigger parallel fetches

**The Fix:** Server state belongs in React Query. Zustand is for UI state only.

---

## Socket.IO Real-Time Invalidation

The API emits `notification` events via Socket.IO (see the **socket-io** skill). The client listens and invalidates the cache.

```tsx
// In a top-level component or layout
function RealtimeNotifications() {
  const utils = trpc.useUtils();
  const { incrementUnread } = useNotificationStore();

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!);
    socket.emit("join", userId);

    socket.on("notification", () => {
      utils.notification.list.invalidate();
      incrementUnread();
    });

    return () => {
      socket.disconnect();
    };
  }, [utils, userId, incrementUnread]);

  return null;
}
```

---

## Anti-Patterns

### WARNING: useEffect for Data Fetching

**The Problem:**

```tsx
// BAD — raw useEffect fetch
const [posts, setPosts] = useState([]);
useEffect(() => {
  fetch("/api/posts").then((r) => r.json()).then(setPosts);
}, []);
```

**Why This Breaks:**
1. Race conditions on fast navigation
2. Memory leaks — setState after unmount
3. No caching, retry, or deduplication
4. No loading/error states without boilerplate

**The Fix:** Use `trpc.post.feed.useQuery()` — handles all of the above.

### WARNING: Calling useQuery Conditionally

**The Problem:**

```tsx
// BAD — hooks can't be conditional
if (userId) {
  const { data } = trpc.user.getById.useQuery({ id: userId });
}
```

**Why This Breaks:** Violates React's rules of hooks. Will crash or produce unpredictable behavior.

**The Fix:**

```tsx
// GOOD — use the enabled option
const { data } = trpc.user.getById.useQuery(
  { id: userId! },
  { enabled: !!userId },
);
```

### WARNING: Forgetting to Invalidate After Mutations

**The Problem:**

```tsx
// BAD — mutation succeeds but UI shows stale data
const connect = trpc.platform.connect.useMutation();
```

**The Fix:**

```tsx
// GOOD — invalidate related queries on success
const utils = trpc.useUtils();
const connect = trpc.platform.connect.useMutation({
  onSuccess: () => {
    utils.platform.list.invalidate();
  },
});
```

**When You Might Be Tempted:** Quick prototyping. But stale UI after mutations is confusing — always wire up invalidation from the start.
