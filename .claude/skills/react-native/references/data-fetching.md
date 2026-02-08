# Data Fetching Reference

## Contents
- Architecture Overview
- tRPC Query Patterns
- Mutations and Invalidation
- Infinite Scrolling
- Optimistic Updates
- Error Handling
- Anti-Patterns

## Architecture Overview

Mobile data fetching uses **tRPC + React Query** exclusively. The tRPC client is configured in `src/lib/trpc.ts` with auth headers from `expo-secure-store`. See the **trpc** skill for router definitions and the **tanstack-query** skill for caching.

```
Screen → trpc.router.procedure.useQuery() → httpBatchLink → Fastify API
                                                ↑
                                        Bearer token from SecureStore
```

## tRPC Query Patterns

### Basic Query

```tsx
import { trpc } from "@/lib/trpc";

export default function PlatformsScreen() {
  const { data, isLoading, error } = trpc.platform.getConnected.useQuery();

  if (isLoading) return <ActivityIndicator />;
  if (error) return <ErrorView message={error.message} />;

  return (
    <FlatList
      data={data.platforms}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <PlatformCard platform={item} />}
    />
  );
}
```

### Query with Parameters

```tsx
const { data } = trpc.post.getFeed.useQuery(
  { platform: selectedPlatform, cursor: undefined },
  {
    // Only fetch when platform is selected
    enabled: selectedPlatform !== null,
    // Refetch every 30 seconds for live feed
    refetchInterval: 30_000,
    // Keep previous data while refetching (prevents flash)
    placeholderData: (prev) => prev,
  },
);
```

### Pull-to-Refresh

```tsx
export default function FeedScreen() {
  const { data, isLoading, refetch } = trpc.post.getFeed.useQuery({
    platform: null,
  });

  return (
    <FlatList
      data={data?.posts ?? []}
      refreshing={isLoading}
      onRefresh={refetch}
      renderItem={({ item }) => <PostCard post={item} />}
    />
  );
}
```

## Mutations and Invalidation

After a mutation, invalidate related queries so they refetch.

```tsx
import { trpc } from "@/lib/trpc";
import { Alert } from "react-native";

export function useDisconnectPlatform() {
  const utils = trpc.useUtils();

  return trpc.platform.disconnect.useMutation({
    onSuccess: () => {
      // Invalidate platform list and feed (feed content changes)
      utils.platform.getConnected.invalidate();
      utils.post.getFeed.invalidate();
    },
    onError: (err) => {
      Alert.alert("Error", err.message);
    },
  });
}

// Usage in component
function PlatformCard({ platform }: { platform: ConnectedPlatform }) {
  const disconnect = useDisconnectPlatform();

  return (
    <Pressable
      onPress={() => disconnect.mutate({ platformId: platform.id })}
      disabled={disconnect.isPending}
    >
      <Text>{disconnect.isPending ? "Disconnecting..." : "Disconnect"}</Text>
    </Pressable>
  );
}
```

## Infinite Scrolling

Use `useInfiniteQuery` for paginated feeds.

```tsx
export default function FeedScreen() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    trpc.post.getFeed.useInfiniteQuery(
      { platform: null },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    );

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      refreshing={isLoading}
      onRefresh={refetch}
      onEndReached={() => hasNextPage && fetchNextPage()}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => <PostCard post={item} />}
      ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> : null}
    />
  );
}
```

## Optimistic Updates

For interactions like liking a post, update the UI immediately.

```tsx
export function useLikePost() {
  const utils = trpc.useUtils();

  return trpc.post.like.useMutation({
    onMutate: async ({ postId }) => {
      await utils.post.getFeed.cancel();
      const previous = utils.post.getFeed.getData({ platform: null });

      utils.post.getFeed.setData({ platform: null }, (old) => {
        if (!old) return old;
        return {
          ...old,
          posts: old.posts.map((p) =>
            p.id === postId ? { ...p, isLiked: true, likeCount: p.likeCount + 1 } : p,
          ),
        };
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        utils.post.getFeed.setData({ platform: null }, context.previous);
      }
    },
    onSettled: () => {
      utils.post.getFeed.invalidate();
    },
  });
}
```

## Error Handling

### Global Error Handler

Configure in the QueryClient inside `app-provider.tsx`:

```tsx
const [queryClient] = useState(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: 2,
          staleTime: 30_000,
        },
        mutations: {
          onError: (error) => {
            Alert.alert("Error", error.message);
          },
        },
      },
    }),
);
```

### Per-Query Error Boundary

```tsx
const { data, error, isLoading } = trpc.post.getFeed.useQuery({ platform: null });

if (error) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-red-500">{error.message}</Text>
      <Pressable onPress={() => refetch()} className="mt-4 rounded bg-primary px-4 py-2">
        <Text className="text-white">Retry</Text>
      </Pressable>
    </View>
  );
}
```

## Anti-Patterns

### WARNING: useEffect for Data Fetching

```tsx
// BAD — race conditions, no caching, memory leaks
useEffect(() => {
  fetch(`${API_URL}/trpc/post.getFeed`).then((r) => r.json()).then(setPosts);
}, []);

// GOOD — tRPC hooks handle everything
const { data } = trpc.post.getFeed.useQuery({ platform: null });
```

### WARNING: Fetching Without Loading States

```tsx
// BAD — user sees blank screen
const { data } = trpc.post.getFeed.useQuery({ platform: null });
return <FlatList data={data?.posts} />;

// GOOD — show loading indicator
const { data, isLoading } = trpc.post.getFeed.useQuery({ platform: null });
if (isLoading) return <ActivityIndicator className="flex-1" />;
return <FlatList data={data.posts} />;
```

### WARNING: Forgetting to Invalidate After Mutation

```tsx
// BAD — UI shows stale data after action
const like = trpc.post.like.useMutation();

// GOOD — invalidate related queries
const utils = trpc.useUtils();
const like = trpc.post.like.useMutation({
  onSuccess: () => utils.post.getFeed.invalidate(),
});
```
