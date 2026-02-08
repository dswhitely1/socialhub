# Hooks Reference

## Contents
- React 18 Constraint
- tRPC Query Hooks
- Zustand Selector Hooks
- Navigation Hooks
- Secure Storage Hooks
- Anti-Patterns

## React 18 Constraint

Mobile runs React 18 (Expo SDK 52). NEVER use React 19 hooks:
- `use()` — use `useQuery` or `Suspense` instead
- `useFormStatus()` — track submission state manually
- `useOptimistic()` — use React Query's optimistic updates
- `useActionState()` — not available

## tRPC Query Hooks

tRPC wraps React Query. Use `trpc.<router>.<procedure>.useQuery()` for reads and `useMutation()` for writes. See the **trpc** and **tanstack-query** skills for full patterns.

```tsx
// apps/mobile/src/app/(tabs)/index.tsx
import { trpc } from "@/lib/trpc";
import { useFeedStore } from "@/stores/feed.store";

export default function FeedScreen() {
  const selectedPlatform = useFeedStore((s) => s.selectedPlatform);

  const { data, isLoading, error, refetch } = trpc.post.getFeed.useQuery({
    platform: selectedPlatform,
  });

  // Pull-to-refresh
  return (
    <FlatList
      data={data?.posts}
      refreshing={isLoading}
      onRefresh={refetch}
      renderItem={({ item }) => <PostCard post={item} />}
    />
  );
}
```

### Mutations with Invalidation

```tsx
import { trpc } from "@/lib/trpc";

export function useLikePost() {
  const utils = trpc.useUtils();

  return trpc.post.like.useMutation({
    onSuccess: () => {
      utils.post.getFeed.invalidate();
    },
  });
}
```

## Zustand Selector Hooks

Always use **selectors** to prevent unnecessary re-renders. See the **zustand** skill.

```tsx
// GOOD — component only re-renders when selectedPlatform changes
const platform = useFeedStore((s) => s.selectedPlatform);

// BAD — component re-renders on ANY store change
const store = useFeedStore();
const platform = store.selectedPlatform;
```

### Multiple Selectors

```tsx
import { useShallow } from "zustand/react/shallow";

// When you need multiple values, use useShallow to avoid extra re-renders
const { isAuthenticated, userId } = useAuthStore(
  useShallow((s) => ({ isAuthenticated: s.isAuthenticated, userId: s.userId })),
);
```

## Navigation Hooks

Expo Router provides typed navigation hooks.

```tsx
import { useRouter, useLocalSearchParams, useSegments } from "expo-router";

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Pressable onPress={() => router.back()}>
      <Text>Back</Text>
    </Pressable>
  );
}
```

### Redirect on Auth State

```tsx
import { useSegments, useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth.store";

export function useProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments]);
}
```

## Secure Storage Hooks

Wrap `expo-secure-store` async calls for use in components.

```tsx
import { useEffect, useState } from "react";
import { getAuthToken } from "@/lib/auth";

export function useAuthToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAuthToken().then((t) => {
      setToken(t);
      setIsLoading(false);
    });
  }, []);

  return { token, isLoading };
}
```

## Anti-Patterns

### WARNING: useEffect for Data Fetching

**The Problem:**

```tsx
// BAD — race conditions, no caching, no loading/error states
const [posts, setPosts] = useState([]);
useEffect(() => {
  fetch(`${API_URL}/trpc/post.getFeed`)
    .then((r) => r.json())
    .then(setPosts);
}, []);
```

**Why This Breaks:**
1. Fast navigation causes stale data overwrites (race condition)
2. No cache — every mount refetches
3. No error handling, no retry, no deduplication

**The Fix:**

```tsx
// GOOD — use tRPC hooks (wraps React Query)
const { data, isLoading, error } = trpc.post.getFeed.useQuery({ platform: null });
```

### WARNING: Inline Objects in Hook Dependencies

```tsx
// BAD — new object reference every render, infinite loop
useEffect(() => { /* ... */ }, [{ platform: "twitter" }]);

// GOOD — use primitive values or useMemo
const platform = "twitter";
useEffect(() => { /* ... */ }, [platform]);
```

### WARNING: Missing Cleanup in useEffect

```tsx
// BAD — potential memory leak with Socket.IO
useEffect(() => {
  socket.on("notification", handler);
}, []);

// GOOD — always clean up subscriptions
useEffect(() => {
  socket.on("notification", handler);
  return () => { socket.off("notification", handler); };
}, []);
```
