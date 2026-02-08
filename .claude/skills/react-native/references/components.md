# Components Reference

## Contents
- Component Conventions
- Screen Components
- Reusable Components
- NativeWind Styling
- Platform-Specific Code
- Anti-Patterns

## Component Conventions

| Type | Export | Naming | Location |
|------|--------|--------|----------|
| Screen | `export default function` | `FeedScreen` | `src/app/(tabs)/index.tsx` |
| Component | `export function` (named) | `PlatformBadge` | `src/components/platform-badge.tsx` |
| Provider | `export function` (named) | `AppProvider` | `src/providers/app-provider.tsx` |

Screens **must** use default exports (Expo Router requirement). All other components use named exports.

## Screen Components

Screens live in `src/app/` using Expo Router's file-based routing.

```tsx
// apps/mobile/src/app/(tabs)/notifications.tsx
import { View, Text, FlatList, Pressable } from "react-native";
import { trpc } from "@/lib/trpc";

export default function NotificationsScreen() {
  const { data, isLoading, refetch } = trpc.notification.getAll.useQuery();

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={data?.notifications}
        refreshing={isLoading}
        onRefresh={refetch}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            className={`border-b border-gray-100 p-4 ${item.isRead ? "bg-white" : "bg-blue-50"}`}
            onPress={() => {/* mark read */}}
          >
            <Text className="text-sm font-medium">{item.title}</Text>
            <Text className="mt-1 text-xs text-gray-500">{item.createdAt}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-gray-400">No notifications</Text>
          </View>
        }
      />
    </View>
  );
}
```

## Reusable Components

Named exports, explicit prop interfaces, kebab-case files.

```tsx
// apps/mobile/src/components/platform-badge.tsx
import { View, Text } from "react-native";
import { PLATFORM_DISPLAY_NAMES } from "@socialhub/shared";
import type { Platform } from "@socialhub/shared";

interface PlatformBadgeProps {
  platform: Platform;
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  return (
    <View className="rounded-full bg-gray-100 px-3 py-1">
      <Text className="text-xs font-medium text-gray-700">
        {PLATFORM_DISPLAY_NAMES[platform]}
      </Text>
    </View>
  );
}
```

### Pressable with Feedback

Use `Pressable` over `TouchableOpacity` — it's the modern API with more control.

```tsx
import { Pressable, Text } from "react-native";

interface ButtonProps {
  title: string;
  onPress: () => void;
  isDisabled?: boolean;
}

export function Button({ title, onPress, isDisabled = false }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`rounded-lg px-6 py-3 ${
        isDisabled ? "bg-gray-300" : "bg-primary active:bg-primary-hover"
      }`}
    >
      <Text className="text-center text-base font-semibold text-white">{title}</Text>
    </Pressable>
  );
}
```

## NativeWind Styling

This project uses NativeWind v4 with Tailwind v3. See the **tailwind** skill for class utilities.

### Custom Colors

Defined in `tailwind.config.ts`:
- `primary` → `#2563eb` (blue-600)
- `primary-hover` → `#1d4ed8` (blue-700)
- `secondary` → `#64748b` (slate-500)
- `accent` → `#8b5cf6` (violet-500)

```tsx
<View className="bg-primary rounded-lg p-4">
  <Text className="text-white">Uses custom primary color</Text>
</View>
```

### Conditional Classes

```tsx
// String concatenation — simple and clear
<View className={`rounded-lg p-4 ${isActive ? "bg-primary" : "bg-gray-100"}`}>

// For many conditions, extract to a function
function getCardClasses(isRead: boolean, isSelected: boolean) {
  const base = "rounded-lg p-4 border";
  const readClass = isRead ? "bg-white" : "bg-blue-50";
  const selectedClass = isSelected ? "border-primary" : "border-gray-200";
  return `${base} ${readClass} ${selectedClass}`;
}
```

## Platform-Specific Code

When you need different behavior on iOS vs Android:

```tsx
import { Platform } from "react-native";

export function Header({ title }: { title: string }) {
  return (
    <View className={Platform.OS === "ios" ? "pt-12" : "pt-8"}>
      <Text className="text-xl font-bold">{title}</Text>
    </View>
  );
}
```

For file-level splits, use Expo's platform extensions:
- `component.ios.tsx` — iOS only
- `component.android.tsx` — Android only
- `component.tsx` — fallback

## Anti-Patterns

### WARNING: Using `<ScrollView>` for Long Lists

**The Problem:**

```tsx
// BAD — renders ALL items at once, crashes on large feeds
<ScrollView>
  {posts.map((post) => <PostCard key={post.id} post={post} />)}
</ScrollView>
```

**Why This Breaks:** ScrollView renders every child immediately. A feed with 500+ posts will consume massive memory and freeze the UI thread.

**The Fix:**

```tsx
// GOOD — FlatList virtualizes rendering, only mounts visible items
<FlatList
  data={posts}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <PostCard post={item} />}
/>
```

### WARNING: TouchableOpacity Over Pressable

`TouchableOpacity` is legacy. `Pressable` supports `android_ripple`, hover states, and the `pressed` render callback.

```tsx
// GOOD
<Pressable onPress={onPress} className="active:opacity-70">

// AVOID
<TouchableOpacity onPress={onPress}>
```

### WARNING: Inline Styles Mixed with NativeWind

```tsx
// BAD — mixing style systems causes confusion and overrides
<View className="p-4" style={{ padding: 20 }}>

// GOOD — use one system consistently
<View className="p-5">
```

**When You Might Be Tempted:** Dynamic values that can't be expressed as Tailwind classes (e.g., animated transforms). In that case, use `style` alone for that property, not both.
