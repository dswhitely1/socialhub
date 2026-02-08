# State Management Reference

## Contents
- State Categories
- Zustand Stores
- Store Patterns
- Auth State Flow
- Persisted State
- Anti-Patterns

## State Categories

| Category | Solution | Example |
|----------|----------|---------|
| Server state | tRPC + React Query | Feed posts, notifications, platform list |
| UI state | Component `useState` | Modal visibility, text input |
| Client state | Zustand | Selected platform filter, auth status |
| URL state | Expo Router params | Post detail ID, search query |
| Secure state | `expo-secure-store` | Auth JWT token |

**Rule:** Server data goes in React Query. UI state stays local. Only cross-component client state goes in Zustand. See the **zustand** skill for advanced patterns and the **tanstack-query** skill for server state caching.

## Zustand Stores

Stores live in `apps/mobile/src/stores/` with the `.store.ts` suffix.

### Auth Store

```tsx
// apps/mobile/src/stores/auth.store.ts
import { create } from "zustand";

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  setAuth: (userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  setAuth: (userId) => set({ isAuthenticated: true, userId }),
  clearAuth: () => set({ isAuthenticated: false, userId: null }),
}));
```

### Feed Store

```tsx
// apps/mobile/src/stores/feed.store.ts
import { create } from "zustand";
import type { Platform } from "@socialhub/shared";

interface FeedState {
  selectedPlatform: Platform | null;
  setSelectedPlatform: (platform: Platform | null) => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  selectedPlatform: null,
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),
}));
```

## Store Patterns

### Selectors (ALWAYS Use These)

Zustand re-renders subscribers on any state change by default. Selectors restrict re-renders to the specific value.

```tsx
// GOOD — only re-renders when selectedPlatform changes
const platform = useFeedStore((s) => s.selectedPlatform);

// GOOD — multiple values with shallow comparison
import { useShallow } from "zustand/react/shallow";

const { isAuthenticated, userId } = useAuthStore(
  useShallow((s) => ({ isAuthenticated: s.isAuthenticated, userId: s.userId })),
);
```

### Actions Outside Components

Call store actions directly without hooks when not in a component context (e.g., after a successful login API call):

```tsx
import { useAuthStore } from "@/stores/auth.store";
import { setAuthToken } from "@/lib/auth";

async function handleLoginSuccess(token: string, userId: string) {
  await setAuthToken(token);
  useAuthStore.getState().setAuth(userId);
}
```

### Computed/Derived State

Compute derived values from store state in selectors — NEVER store computed values.

```tsx
// GOOD — compute during render
const hasAuth = useAuthStore((s) => s.userId !== null);

// BAD — redundant derived state in store
interface BadAuthState {
  userId: string | null;
  hasAuth: boolean; // This is just `userId !== null` — don't store it
}
```

## Auth State Flow

```
App Launch
    ↓
Check SecureStore for token
    ↓
Token exists? → Validate with API → setAuth(userId)
    ↓ (no token)
Show (auth) screens → Login → setAuthToken + setAuth
    ↓
Navigate to (tabs)
```

```tsx
// Root layout pattern for auth gating
import { useEffect, useState } from "react";
import { Stack, SplashScreen } from "expo-router";
import { getAuthToken } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth.store";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    async function bootstrap() {
      const token = await getAuthToken();
      if (token) {
        // Validate token with API, then:
        useAuthStore.getState().setAuth(/* userId */);
      }
      setIsReady(true);
      SplashScreen.hideAsync();
    }
    bootstrap();
  }, []);

  if (!isReady) return null;

  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="(tabs)" />
        ) : (
          <Stack.Screen name="(auth)" />
        )}
      </Stack>
    </AppProvider>
  );
}
```

## Persisted State

For state that survives app restarts, use Zustand's `persist` middleware with a `SecureStore`-backed storage adapter:

```tsx
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

const secureStorage = createJSONStorage(() => ({
  getItem: (name: string) => SecureStore.getItemAsync(name),
  setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
  removeItem: (name: string) => SecureStore.deleteItemAsync(name),
}));

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "light" as "light" | "dark",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "settings-storage", storage: secureStorage },
  ),
);
```

## Anti-Patterns

### WARNING: Storing Server Data in Zustand

**The Problem:**

```tsx
// BAD — duplicating React Query's job
const useFeedStore = create((set) => ({
  posts: [],
  fetchPosts: async () => {
    const res = await fetch(`${API_URL}/trpc/post.getFeed`);
    const data = await res.json();
    set({ posts: data.posts });
  },
}));
```

**Why This Breaks:** You lose caching, deduplication, background refetching, stale-while-revalidate, and error/loading states that React Query provides for free.

**The Fix:** Use tRPC hooks for server data. Zustand is for client-only state (filters, UI preferences, auth flags).

### WARNING: Destructuring the Entire Store

```tsx
// BAD — re-renders on ANY state change in the store
const { selectedPlatform, setSelectedPlatform } = useFeedStore();

// GOOD — re-renders only when selectedPlatform changes
const selectedPlatform = useFeedStore((s) => s.selectedPlatform);
const setSelectedPlatform = useFeedStore((s) => s.setSelectedPlatform);
```

### WARNING: Mutating State Directly

```tsx
// BAD — mutations bypass Zustand's subscription system
useAuthStore.getState().isAuthenticated = true;

// GOOD — use the action
useAuthStore.getState().setAuth(userId);
```
