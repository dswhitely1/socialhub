# Performance Reference

## Contents
- FlatList Optimization
- Memoization
- Image Optimization
- Bundle Size
- Re-render Prevention
- Navigation Performance
- Anti-Patterns

## FlatList Optimization

FlatList is the primary rendering mechanism for feeds and lists in this app.

### Essential Props

```tsx
<FlatList
  data={posts}
  keyExtractor={(item) => item.id}
  renderItem={renderPost}
  // Performance props
  removeClippedSubviews={true}           // Detach off-screen views (Android)
  maxToRenderPerBatch={10}               // Items per render batch
  windowSize={5}                         // Render window (5 = 2.5 screens above + below)
  initialNumToRender={10}                // Items rendered on first mount
  getItemLayout={(_, index) => ({        // Skip measurement if items have fixed height
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>
```

### Stable renderItem

NEVER define `renderItem` inline — it creates a new function every render, which forces FlatList to re-render all visible items.

```tsx
// BAD — new function reference every render
<FlatList
  data={posts}
  renderItem={({ item }) => <PostCard post={item} />}
/>

// GOOD — stable reference with useCallback
const renderPost = useCallback(
  ({ item }: { item: Post }) => <PostCard post={item} />,
  [],
);

<FlatList data={posts} renderItem={renderPost} />
```

## Memoization

### React.memo for List Items

Components rendered by FlatList should be memoized to prevent re-renders when sibling items change.

```tsx
import { memo } from "react";
import { View, Text, Pressable } from "react-native";
import type { Post } from "@socialhub/shared";

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
}

export const PostCard = memo(function PostCard({ post, onLike }: PostCardProps) {
  return (
    <View className="border-b border-gray-100 p-4">
      <Text className="text-sm">{post.content}</Text>
      <Pressable onPress={() => onLike(post.id)}>
        <Text className="mt-2 text-xs text-primary">
          {post.isLiked ? "Liked" : "Like"} ({post.likeCount})
        </Text>
      </Pressable>
    </View>
  );
});
```

### useMemo for Expensive Computations

```tsx
import { useMemo } from "react";

export default function FeedScreen() {
  const { data } = trpc.post.getFeed.useQuery({ platform: null });
  const selectedPlatform = useFeedStore((s) => s.selectedPlatform);

  // Filter is O(n) — memoize when data or filter changes
  const filteredPosts = useMemo(
    () =>
      selectedPlatform
        ? data?.posts.filter((p) => p.platform === selectedPlatform)
        : data?.posts ?? [],
    [data?.posts, selectedPlatform],
  );

  return <FlatList data={filteredPosts} renderItem={renderPost} />;
}
```

### useCallback for Event Handlers Passed to Children

```tsx
const handleLike = useCallback((postId: string) => {
  likeMutation.mutate({ postId });
}, [likeMutation.mutate]);

// Stable reference prevents PostCard re-renders
<PostCard post={post} onLike={handleLike} />
```

## Image Optimization

Use `expo-image` instead of React Native's `Image` — it provides caching, blur placeholders, and better performance.

```bash
pnpm --filter @socialhub/mobile add expo-image
```

```tsx
import { Image } from "expo-image";

export function Avatar({ uri, size = 40 }: { uri: string; size?: number }) {
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      placeholder={{ blurhash: "LGF5]+Yk^6#M@-5c,1J5@[or[Q6." }}
      contentFit="cover"
      transition={200}
      cachePolicy="memory-disk"
    />
  );
}
```

## Bundle Size

### Monitor Metro Bundle Size

```bash
# Analyze bundle contents
npx react-native-bundle-visualizer --platform ios
```

### Tree-Shaking Imports

```tsx
// BAD — imports entire library
import _ from "lodash";
const sorted = _.sortBy(posts, "createdAt");

// GOOD — import specific function
import sortBy from "lodash/sortBy";
const sorted = sortBy(posts, "createdAt");

// BEST — use native methods when possible
const sorted = [...posts].sort((a, b) => b.createdAt - a.createdAt);
```

### Lazy Screens

Expo Router lazily loads route components by default. For heavy modals or settings screens, this is already optimized. For explicit control:

```tsx
// Heavy component loaded only when needed
import { lazy, Suspense } from "react";
import { ActivityIndicator } from "react-native";

const HeavyChart = lazy(() => import("@/components/analytics-chart"));

export default function AnalyticsScreen() {
  return (
    <Suspense fallback={<ActivityIndicator className="flex-1" />}>
      <HeavyChart />
    </Suspense>
  );
}
```

## Re-render Prevention

### Zustand Selector Pattern

The single biggest source of unnecessary re-renders in this app. See the **zustand** skill.

```tsx
// BAD — re-renders on ANY store change
const store = useFeedStore();

// GOOD — re-renders only when selectedPlatform changes
const platform = useFeedStore((s) => s.selectedPlatform);
```

### Splitting Context Providers

If a provider causes too many re-renders, split static and dynamic values:

```tsx
// Instead of one provider with everything, split concerns
// Static: trpc client, queryClient (created once, never changes)
// Dynamic: auth state, theme (changes trigger re-renders)
```

## Navigation Performance

### Avoid Heavy Layout Computations in Screen Transitions

```tsx
// BAD — heavy work during mount slows transition animation
export default function DetailScreen() {
  const heavyData = computeExpensiveLayout(rawData); // blocks transition

  return <View>{/* ... */}</View>;
}

// GOOD — defer heavy work with InteractionManager
import { InteractionManager } from "react-native";
import { useState, useEffect } from "react";

export default function DetailScreen() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      setIsReady(true);
    });
    return () => task.cancel();
  }, []);

  if (!isReady) return <ActivityIndicator className="flex-1" />;
  return <View>{/* heavy content */}</View>;
}
```

### react-native-screens

Already installed in this project. Ensures native screen containers are used for navigation, which is critical for 60fps transitions.

## Anti-Patterns

### WARNING: ScrollView for Long Lists

```tsx
// BAD — renders ALL items, crashes on large feeds
<ScrollView>
  {posts.map((p) => <PostCard key={p.id} post={p} />)}
</ScrollView>

// GOOD — virtualized, only renders visible items
<FlatList data={posts} renderItem={renderPost} />
```

### WARNING: Inline Object Props

```tsx
// BAD — new object every render, breaks memo
<PostCard post={post} style={{ marginBottom: 8 }} />

// GOOD — stable reference
const cardStyle = useMemo(() => ({ marginBottom: 8 }), []);
<PostCard post={post} style={cardStyle} />

// BEST — use NativeWind classes instead
<View className="mb-2"><PostCard post={post} /></View>
```

### WARNING: console.log in Production

```tsx
// BAD — console.log causes bridge serialization overhead
console.log("Rendering post:", post);

// GOOD — strip console statements in production
// Add to babel.config.js:
// plugins: ["transform-remove-console"]  (in production only)
```

### Optimization Checklist

Copy this checklist for new screens with lists:

```
- [ ] Use FlatList (not ScrollView) for dynamic lists
- [ ] Memoize list items with React.memo
- [ ] Extract renderItem to useCallback
- [ ] Add keyExtractor with stable unique IDs
- [ ] Use expo-image instead of RN Image for network images
- [ ] Use Zustand selectors (not full store destructuring)
- [ ] Defer heavy computations with InteractionManager
- [ ] Test scrolling performance on a real device (not simulator)
```
