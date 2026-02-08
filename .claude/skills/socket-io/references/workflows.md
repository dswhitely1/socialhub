# Socket.IO Workflows Reference

## Contents
- Adding a New Socket Event
- Client Integration (Web)
- Client Integration (Mobile)
- BullMQ Worker Integration
- Scaling Checklist
- Debugging Socket Connections

---

## Adding a New Socket Event

End-to-end flow for adding a typed real-time event.

Copy this checklist and track progress:
- [ ] Step 1: Add event signature to `ServerToClientEvents` or `ClientToServerEvents` in `packages/shared`
- [ ] Step 2: Emit the event from the server (service, tRPC mutation, or BullMQ worker)
- [ ] Step 3: Listen for the event on the client (web hook or mobile hook)
- [ ] Step 4: Update Zustand store or invalidate TanStack Query cache on receipt
- [ ] Step 5: Verify with browser devtools (Network > WS tab) or `socket.onAny()` debug listener

**Step 1 — Define the event type:**

```typescript
// packages/shared/src/types/socket-events.ts
export interface ServerToClientEvents {
  // ... existing events
  "platform:token-refreshed": (data: { platform: Platform }) => void;
}
```

**Step 2 — Emit from server:**

```typescript
// apps/api/src/services/platform.service.ts
io.to(`user:${userId}`).emit("platform:token-refreshed", { platform: "twitter" });
```

**Step 3 — Listen on client:**

```typescript
socket.on("platform:token-refreshed", ({ platform }) => {
  queryClient.invalidateQueries({ queryKey: ["platforms", platform] });
});
```

1. Add event type in shared package
2. Verify: `pnpm typecheck` — must pass with no errors on both server and client
3. If typecheck fails, fix type mismatches and repeat step 2
4. Only proceed when typecheck passes

---

## Client Integration (Web)

### Socket Provider Pattern

Wrap the app in a provider that manages the Socket.IO lifecycle. Connect after auth, disconnect on logout.

```typescript
// apps/web/src/lib/socket.ts
"use client";

import { io, type Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "@socialhub/shared/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(token: string): TypedSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      withCredentials: true,
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

### Hook for Notification Streaming

```typescript
// apps/web/src/hooks/use-socket-notifications.ts
"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { getSocket } from "@/lib/socket";
import { useNotificationStore } from "@/stores/notification.store";

export function useSocketNotifications() {
  const { data: session } = useSession();
  const incrementUnread = useNotificationStore((s) => s.incrementUnread);

  useEffect(() => {
    if (!session?.jwt) return;

    const socket = getSocket(session.jwt);
    socket.connect();

    socket.on("notification", () => {
      incrementUnread();
    });

    return () => {
      socket.off("notification");
      socket.disconnect();
    };
  }, [session?.jwt, incrementUnread]);
}
```

See the **zustand** skill for notification store patterns. See the **react** skill for hook conventions.

### WARNING: Creating Socket Inside Component Render

**The Problem:**

```typescript
// BAD — new connection on every render
function Notifications() {
  const socket = io("ws://localhost:4000"); // connection leak
}
```

**Why This Breaks:** Every render creates a new WebSocket connection. With React 19 strict mode double-rendering, this creates 2 connections immediately. Components re-rendering during feed scrolling will open hundreds.

**The Fix:** Use a module-level singleton (shown above) or React context. Never call `io()` inside a component body.

---

## Client Integration (Mobile)

Mobile uses `expo-secure-store` for tokens instead of cookies. Connection pattern is similar but auth retrieval differs.

```typescript
// apps/mobile/src/lib/socket.ts
import { io, type Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import type { ServerToClientEvents, ClientToServerEvents } from "@socialhub/shared/types";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export async function getSocket(): Promise<TypedSocket> {
  if (!socket) {
    const token = await SecureStore.getItemAsync("auth_token");
    socket = io(process.env.EXPO_PUBLIC_WS_URL!, {
      auth: { token },
      autoConnect: false,
      transports: ["websocket"], // mobile — skip polling, go straight to WS
    });
  }
  return socket;
}
```

**Mobile-specific considerations:**
- Use `transports: ["websocket"]` only — polling has higher battery cost on mobile
- Handle `AppState` changes: disconnect on background, reconnect on foreground
- See the **react-native** skill for Expo-specific patterns

---

## BullMQ Worker Integration

BullMQ workers run outside the Fastify request lifecycle, so they need an explicit reference to the `io` instance. See the **bullmq** skill for worker patterns.

**Pattern: Pass `io` when creating the worker:**

```typescript
// apps/api/src/jobs/feed-polling.job.ts
import type { Server } from "socket.io";
import { Queue, Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

export function createFeedPollingQueue() {
  return new Queue(QUEUE_NAME, { connection: getRedis() });
}

export function createFeedPollingWorker(io: Server) {
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      const { userId, platform } = job.data as { userId: string; platform: string };
      const posts = await fetchPlatformFeed(userId, platform);
      if (posts.length > 0) {
        io.to(`user:${userId}`).emit("feed:new-posts", { platform, count: posts.length });
      }
    },
    { connection: getRedis() },
  );
}
```

**Wire it up in server.ts after plugin registration:**

```typescript
await fastify.register(socketPlugin);
createFeedPollingWorker(fastify.io);
```

### WARNING: Importing `fastify.io` via Module Scope

**The Problem:**

```typescript
// BAD — circular dependency, io is undefined at import time
import { fastify } from "../server.js";
fastify.io.emit(...); // undefined — server hasn't booted yet
```

**Why This Breaks:** Module-level imports execute before the server boots. `fastify.io` is only available after `socketPlugin` registers.

**The Fix:** Pass `io` as a function argument (shown above), or use a lazy getter.

---

## Scaling Checklist

Before deploying multiple API instances behind a load balancer:

Copy this checklist and track progress:
- [ ] Install `@socket.io/redis-adapter`: `pnpm --filter @socialhub/api add @socket.io/redis-adapter`
- [ ] Configure adapter with pub/sub Redis clients (must be duplicated — see patterns.md)
- [ ] Enable sticky sessions on load balancer (required for HTTP long-polling fallback)
- [ ] Verify cross-instance emission: connect client to instance A, emit from instance B
- [ ] Monitor Redis pub/sub channel memory with `redis-cli info memory`
- [ ] Load test with expected concurrent connections (PRD target: 100K)

**Sticky sessions config (AWS ALB):**

```
Target Group → Attributes → Stickiness: enabled
Type: Application-based cookie
Cookie name: io  (Socket.IO default)
```

If using WebSocket-only transport (`transports: ["websocket"]`), sticky sessions are NOT required — the upgrade happens on the first request.

---

## Debugging Socket Connections

**Server-side debug logging:**

```bash
# Enable Socket.IO debug output
DEBUG=socket.io:* pnpm --filter @socialhub/api dev
```

**Client-side debug (browser console):**

```typescript
// Temporary debug listener — remove before committing
socket.onAny((event, ...args) => {
  console.log("[socket]", event, args);
});
```

**Check connected sockets for a user:**

```typescript
const sockets = await io.in(`user:${userId}`).fetchSockets();
console.log(`User ${userId} has ${sockets.length} active connections`);
```

1. Reproduce the issue with debug logging enabled
2. Check: `DEBUG=socket.io:* pnpm --filter @socialhub/api dev`
3. If no connection appears, verify CORS origin matches `env.CORS_ORIGIN`
4. If connection drops immediately, check auth middleware rejection
5. Only disable debug logging when the issue is resolved
