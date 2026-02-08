# Zustand Workflows Reference

## Contents
- Creating a New Store
- Adding Middleware
- Integrating with Socket.IO
- Persisting Mobile Auth State
- Debugging Stores

---

## Creating a New Store

Copy this checklist and track progress:
- [ ] Step 1: Create `[domain].store.ts` in the correct `stores/` directory
- [ ] Step 2: Define interface with state + actions, use `is`/`has` prefix for booleans
- [ ] Step 3: Export `use[Domain]Store` using `create<Interface>()`
- [ ] Step 4: Consume in components with individual selectors
- [ ] Step 5: Verify no server state leaked in — use TanStack Query for API data

### Step-by-Step

```typescript
// 1. Create apps/web/src/stores/compose.store.ts
import { create } from "zustand";
import type { Platform } from "@socialhub/shared";

// 2. Define typed interface — state + actions together
interface ComposeState {
  isOpen: boolean;
  selectedPlatforms: Platform[];
  openComposer: () => void;
  closeComposer: () => void;
  togglePlatform: (platform: Platform) => void;
  resetComposer: () => void;
}

// 3. Export with use* prefix
export const useComposeStore = create<ComposeState>((set) => ({
  isOpen: false,
  selectedPlatforms: [],
  openComposer: () => set({ isOpen: true }),
  closeComposer: () => set({ isOpen: false, selectedPlatforms: [] }),
  togglePlatform: (platform) =>
    set((state) => ({
      selectedPlatforms: state.selectedPlatforms.includes(platform)
        ? state.selectedPlatforms.filter((p) => p !== platform)
        : [...state.selectedPlatforms, platform],
    })),
  resetComposer: () => set({ isOpen: false, selectedPlatforms: [] }),
}));
```

```tsx
// 4. Consume with individual selectors
import { useComposeStore } from "@/stores/compose.store";

function ComposeButton() {
  const openComposer = useComposeStore((s) => s.openComposer);
  return <button onClick={openComposer}>New Post</button>;
}
```

### Validation

1. Run `pnpm typecheck` to verify the store compiles
2. If typecheck fails, check that `@socialhub/shared` types are imported with `type` keyword
3. Repeat until typecheck passes

---

## Adding Middleware

Current stores are vanilla. Add middleware only when you have a concrete need.

### Adding Devtools (Development Debugging)

Wrap the store creator with `devtools`. Use the double-parentheses `create<T>()()` pattern for correct type inference:

```typescript
import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface NotificationState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set) => ({
      unreadCount: 0,
      setUnreadCount: (count) => set({ unreadCount: count }),
      incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
    }),
    { name: "NotificationStore" },
  ),
);
```

**Note the `create<T>()(...)` double invocation** — this is required for TypeScript inference with middleware. Without the extra `()`, generics break.

### Adding Persist (Mobile Auth)

For mobile auth state that should survive app restarts, use `persist` with `expo-secure-store` as custom storage:

```typescript
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

const secureStorage = createJSONStorage(() => ({
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
}));

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  setAuth: (userId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      setAuth: (userId) => set({ isAuthenticated: true, userId }),
      clearAuth: () => set({ isAuthenticated: false, userId: null }),
    }),
    { name: "auth-storage", storage: secureStorage },
  ),
);
```

### Middleware Checklist

Copy this checklist and track progress:
- [ ] Step 1: Add `devtools` wrapper for debugging (dev only)
- [ ] Step 2: Add `persist` if state must survive page refresh / app restart
- [ ] Step 3: Use `create<T>()(middleware(...))` double-invoke pattern
- [ ] Step 4: Run `pnpm typecheck` to verify — middleware types are tricky
- [ ] Step 5: Test in browser/device to confirm middleware behavior

---

## Integrating with Socket.IO

The notification store updates in real-time via Socket.IO. See the **socket-io** skill for server setup.

### Pattern: Socket Events Updating Zustand

```typescript
// In a React provider or layout component
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useNotificationStore } from "@/stores/notification.store";

function useNotificationSocket() {
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!);

    // Update Zustand store from socket event
    socket.on("notification:new", () => {
      useNotificationStore.getState().incrementUnread();
    });

    socket.on("notifications:read", (count: number) => {
      useNotificationStore.getState().setUnreadCount(count);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
```

**Key technique:** Use `useStore.getState()` outside React components/hooks to imperatively update state. This avoids subscribing the socket handler to re-renders.

### WARNING: Subscribing to Store Inside Socket Handler

**The Problem:**

```typescript
// BAD — useStore() inside useEffect causes stale closures
useEffect(() => {
  const { incrementUnread } = useNotificationStore();
  socket.on("notification:new", () => incrementUnread());
}, []);
```

**Why This Breaks:** The destructured `incrementUnread` is captured once on mount. If the store is recreated (HMR, strict mode), the closure references a stale store.

**The Fix:** Always use `getState()` for imperative access outside components:

```typescript
// GOOD — always reads fresh state
socket.on("notification:new", () => {
  useNotificationStore.getState().incrementUnread();
});
```

---

## Persisting Mobile Auth State

Mobile workflow for auth persistence:

1. User logs in → API returns JWT + userId
2. Store token in `expo-secure-store` (see the **react-native** skill)
3. Update `useAuthStore` with `setAuth(userId)`
4. On app launch, check SecureStore for existing token
5. If token exists, call `setAuth(userId)` to restore state

```typescript
// apps/mobile/src/providers/auth-provider.tsx
import { useEffect } from "react";
import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../stores/auth.store";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    async function restoreAuth() {
      const token = await SecureStore.getItemAsync("auth_token");
      const userId = await SecureStore.getItemAsync("user_id");
      if (token && userId) {
        useAuthStore.getState().setAuth(userId);
      }
    }
    restoreAuth();
  }, []);

  return <>{children}</>;
}
```

---

## Debugging Stores

### Quick Debug: Log State Changes

```typescript
// Temporary — subscribe outside React to log all changes
useUIStore.subscribe((state) => console.log("UIStore:", state));
```

### Redux DevTools Integration

Add `devtools` middleware (see above). Then open Redux DevTools browser extension to inspect:
- Current state snapshot
- Action history with diffs
- Time-travel debugging

### Validation Workflow

1. Make store changes
2. Validate: `pnpm typecheck`
3. If typecheck fails, check import types (`import type` for interfaces from `@socialhub/shared`)
4. Validate: `pnpm lint`
5. If lint fails, check for unused variables (prefix with `_`) or missing type imports
6. Only proceed when both pass
