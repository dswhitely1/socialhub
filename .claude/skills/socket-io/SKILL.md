---
name: socket-io
description: |
  Implements WebSocket real-time notification streaming and push architecture for the SocialHub monorepo.
  Use when: creating or modifying the Socket.IO Fastify plugin, emitting real-time events from services/workers,
  building client-side socket hooks (web or mobile), defining typed socket events, or integrating Socket.IO with auth.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Socket.IO Skill

SocialHub uses Socket.IO 4.x attached to the Fastify HTTP server for real-time notification push. The server runs as a Fastify plugin (`apps/api/src/plugins/socket.plugin.ts`), decorates `fastify.io` for global access, and targets users via `user:{userId}` rooms. Clients (web and mobile) connect to the same port as the API (4000) using `socket.io-client`. The project uses `ioredis` for Redis — the Redis adapter (`@socket.io/redis-adapter`) is needed for multi-instance deployments.

## Quick Start

### Server Plugin (Fastify)

```typescript
// apps/api/src/plugins/socket.plugin.ts
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { env } from "../env.js";

export async function socketPlugin(fastify: FastifyInstance) {
  const io = new Server(fastify.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on("join", (userId: string) => {
      socket.join(`user:${userId}`);
    });
  });

  fastify.decorate("io", io);
  fastify.addHook("onClose", () => io.close());
}
```

### Emitting from Services

```typescript
// apps/api/src/services/notification.service.ts
import type { Server } from "socket.io";

export function sendNotification(
  io: Server,
  userId: string,
  notification: { type: string; title: string; body: string },
) {
  io.to(`user:${userId}`).emit("notification", notification);
}
```

### Client Hook (Web)

```typescript
// apps/web/src/lib/socket.ts
import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Room targeting | Route events to specific users | `io.to("user:abc").emit(...)` |
| Fastify decoration | Access io anywhere in request lifecycle | `fastify.io.emit(...)` |
| Auth middleware | Verify JWT before allowing connection | `io.use((socket, next) => ...)` |
| Typed events | Type-safe emit/listen via generics | `Server<C2S, S2C>` |
| Redis adapter | Scale across multiple API instances | `@socket.io/redis-adapter` |

## Common Patterns

### Emit After Database Write (tRPC Mutation)

**When:** A tRPC mutation changes state another user should see in real-time.

```typescript
markRead: protectedProcedure
  .input(z.object({ ids: z.array(z.string().uuid()) }))
  .mutation(async ({ ctx, input }) => {
    await db.update(notifications).set({ isRead: true }).where(inArray(notifications.id, input.ids));
    ctx.io.to(`user:${ctx.userId}`).emit("notifications:read", { ids: input.ids });
    return { updated: input.ids.length };
  }),
```

### BullMQ Worker Emission

**When:** A background job fetches new data that should push to the client immediately.

```typescript
// Access io via a module-level reference set during server boot
export function createFeedPollingWorker(io: Server) {
  return new Worker(QUEUE_NAME, async (job) => {
    const { userId, platform } = job.data;
    const posts = await fetchPlatformFeed(userId, platform);
    if (posts.length > 0) {
      io.to(`user:${userId}`).emit("feed:new-posts", { platform, count: posts.length });
    }
  }, { connection });
}
```

## See Also

- [patterns](references/patterns.md) — Typed events, auth middleware, room management, Redis adapter
- [workflows](references/workflows.md) — Adding new events, client integration, scaling checklist

## Related Skills

- See the **fastify** skill for plugin architecture and server lifecycle
- See the **typescript** skill for strict typing and `consistent-type-imports`
- See the **redis** skill for ioredis client and connection patterns
- See the **bullmq** skill for worker integration with Socket.IO emissions
- See the **zustand** skill for notification store updates on socket events
- See the **auth-js** skill for JWT token structure used in socket auth
- See the **react** skill for building `useSocket` hooks in web and mobile
- See the **zod** skill for validating incoming socket event payloads

## Documentation Resources

> Fetch latest Socket.IO documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "socket.io"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/socket_io_v4` _(High reputation, 1374 snippets, score 92)_

**Recommended Queries:**
- "Socket.IO TypeScript typed events server client"
- "Socket.IO authentication middleware JWT"
- "Socket.IO Redis adapter scaling multiple instances"
- "Socket.IO rooms broadcasting to specific users"
- "Socket.IO Fastify integration plugin"
