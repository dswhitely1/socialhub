# Zustand Patterns Reference

## Contents
- State Separation: Zustand vs TanStack Query
- Store Design Patterns
- Selector Patterns
- Store-to-Component Wiring
- Anti-Patterns

---

## State Separation: Zustand vs TanStack Query

This is the most critical decision. Get it wrong and you'll fight caching, staleness, and re-render bugs.

| State Type | Tool | Examples in SocialHub |
|------------|------|-----------------------|
| **UI state** (ephemeral, client-only) | Zustand | Sidebar open/closed, selected platform filter, feed ordering |
| **Server state** (API data, cached) | TanStack Query | Feed posts, notifications list, user profile, platform connections |
| **Derived counts** (from server data) | Either — prefer Query | Unread notification count (currently Zustand, should migrate to Query's `select`) |
| **Auth state** (web) | Auth.js | Session, user identity — see the **auth-js** skill |
| **Auth state** (mobile) | Zustand | `auth.store.ts` holds `isAuthenticated` + `userId` |

### WARNING: Putting Server Data in Zustand

**The Problem:**

```typescript
// BAD — fetching API data into Zustand
export const usePostStore = create<PostState>((set) => ({
  posts: [],
  fetchPosts: async () => {
    const res = await trpc.post.feed.query();
    set({ posts: res });
  },
}));
```

**Why This Breaks:**
1. No caching — every mount re-fetches
2. No stale-while-revalidate — users see loading spinners on every navigation
3. No automatic refetch on focus/reconnect
4. No deduplication — multiple components trigger redundant requests
5. You're reimplementing what TanStack Query already does

**The Fix:**

```typescript
// GOOD — use TanStack Query for server state
// See the **tanstack-query** skill
const { data: posts } = trpc.post.feed.useQuery({ platform: selectedPlatform });

// Zustand only holds the UI filter
const selectedPlatform = useFeedStore((s) => s.selectedPlatform);
```

---

## Store Design Patterns

### Co-locate State and Actions

Every piece of state has its setter in the same store. No external mutation.

```typescript
// apps/web/src/stores/feed.store.ts
import { create } from "zustand";
import type { Platform } from "@socialhub/shared";

interface FeedState {
  selectedPlatform: Platform | null;
  orderBy: "chronological" | "relevance";
  setSelectedPlatform: (platform: Platform | null) => void;
  setOrderBy: (orderBy: "chronological" | "relevance") => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  selectedPlatform: null,
  orderBy: "chronological",
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),
  setOrderBy: (orderBy) => set({ orderBy }),
}));
```

### Keep Stores Small and Focused

Each store owns one domain. SocialHub splits web stores into:
- `feed.store.ts` — feed filtering/ordering
- `notification.store.ts` — unread badge count
- `ui.store.ts` — layout state (sidebar)

NEVER create a monolithic `app.store.ts` that holds everything.

### Mobile Auth Store Pattern

Mobile can't use Auth.js sessions, so it tracks auth state in Zustand:

```typescript
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

---

## Selector Patterns

### ALWAYS Use Selectors

```typescript
// GOOD — only re-renders when sidebarOpen changes
const sidebarOpen = useUIStore((state) => state.sidebarOpen);

// GOOD — only re-renders when toggleSidebar reference changes (stable, so never)
const toggleSidebar = useUIStore((state) => state.toggleSidebar);
```

### WARNING: Subscribing to the Entire Store

**The Problem:**

```typescript
// BAD — re-renders on ANY state change in the store
const { sidebarOpen, toggleSidebar } = useUIStore();
```

**Why This Breaks:**
1. Component re-renders when `setSidebarOpen` is called even if it only uses `toggleSidebar`
2. In a store with 10 fields, changing any one triggers re-renders in all consumers
3. Performance death by a thousand cuts — barely noticeable until it's everywhere

**The Fix:**

```typescript
// GOOD — two stable selector subscriptions
const sidebarOpen = useUIStore((s) => s.sidebarOpen);
const toggleSidebar = useUIStore((s) => s.toggleSidebar);
```

### Multiple Values from One Store

When you need 2+ values, use `useShallow` to avoid re-renders from reference inequality:

```typescript
import { useShallow } from "zustand/react/shallow";

// GOOD — only re-renders when selectedPlatform or orderBy actually change
const { selectedPlatform, orderBy } = useFeedStore(
  useShallow((s) => ({ selectedPlatform: s.selectedPlatform, orderBy: s.orderBy })),
);
```

---

## Store-to-Component Wiring

### Web Component Example

```tsx
// apps/web/src/components/layout/sidebar.tsx
import { useUIStore } from "@/stores/ui.store";

export function Sidebar() {
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  if (!sidebarOpen) return null;

  return <nav className="w-64 border-r">{/* sidebar content */}</nav>;
}
```

### Combining Zustand Filter with TanStack Query

```tsx
// Pattern: Zustand holds the filter, Query fetches with it
import { useFeedStore } from "@/stores/feed.store";

function FeedPage() {
  const selectedPlatform = useFeedStore((s) => s.selectedPlatform);

  // TanStack Query automatically refetches when selectedPlatform changes
  const { data: posts } = trpc.post.feed.useQuery({ platform: selectedPlatform });

  return <FeedList posts={posts ?? []} />;
}
```

---

## Anti-Patterns

### WARNING: Computed State in Store

**The Problem:**

```typescript
// BAD — storing derived data
interface FeedState {
  posts: Post[];
  filteredPosts: Post[];  // derived from posts + selectedPlatform
  setFilter: (p: Platform) => void;
}
```

**Why This Breaks:** Sync bugs. You must manually keep `filteredPosts` in sync with `posts` and the filter. Miss one `set()` call and they diverge.

**The Fix:** Compute during render or use a selector:

```typescript
// GOOD — derive in the component
const selectedPlatform = useFeedStore((s) => s.selectedPlatform);
const filteredPosts = posts.filter((p) => !selectedPlatform || p.platform === selectedPlatform);
```

### WARNING: Async Logic in Stores

**The Problem:**

```typescript
// BAD — mixing async fetching into Zustand
export const useNotificationStore = create((set) => ({
  notifications: [],
  fetchNotifications: async () => {
    const data = await fetch("/api/notifications").then((r) => r.json());
    set({ notifications: data });
  },
}));
```

**Why This Breaks:** You lose all TanStack Query benefits (caching, dedup, background refetch, error/loading states). Use Zustand for UI state, Query for server state.

### WARNING: Sharing Store Instances Across Web and Mobile

Web and mobile are separate apps with separate bundles. Do NOT try to share store *instances* via a package. Share *types* from `@socialhub/shared` instead. Each app owns its own stores. See the **zod** skill for shared validation schemas.
