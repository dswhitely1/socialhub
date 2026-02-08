# Socket.IO Patterns Reference

## Contents
- Typed Events
- Authentication Middleware
- Room Management
- Fastify Decoration and Access
- Redis Adapter for Scaling
- Anti-Patterns

---

## Typed Events

Socket.IO 4.x supports four generic interfaces. ALWAYS define these — untyped sockets defeat TypeScript's purpose in this project.

```typescript
// packages/shared/src/types/socket-events.ts
import type { Platform } from "../constants/platforms.js";

export interface ServerToClientEvents {
  "notification": (data: { type: string; title: string; body: string; platform: Platform }) => void;
  "notifications:read": (data: { ids: string[] }) => void;
  "feed:new-posts": (data: { platform: Platform; count: number }) => void;
  "connection:status": (data: { platform: Platform; isConnected: boolean }) => void;
}

export interface ClientToServerEvents {
  "join": (userId: string) => void;
  "notification:ack": (notificationId: string) => void;
}

export interface InterServerEvents {
  "ping": () => void;
}

export interface SocketData {
  userId: string;
}
```

Use these generics when creating the server:

```typescript
// apps/api/src/plugins/socket.plugin.ts
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from "@socialhub/shared/types";

const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  fastify.server,
  { cors: { origin: env.CORS_ORIGIN, credentials: true } },
);
```

Put event types in `packages/shared` so both server and clients import the same contract. See the **typescript** skill for `consistent-type-imports` enforcement.

---

## Authentication Middleware

### WARNING: Unauthenticated Socket Connections

**The Problem:**

```typescript
// BAD — anyone can join any user's room
io.on("connection", (socket) => {
  socket.on("join", (userId: string) => {
    socket.join(`user:${userId}`);
  });
});
```

**Why This Breaks:**
1. Any client can impersonate any user by sending an arbitrary `userId`
2. Notifications containing private data leak to unauthorized connections
3. No audit trail — you can't trace which authenticated user owns a socket

**The Fix:**

```typescript
import { verifyToken } from "../services/auth.service.js";

// Middleware runs ONCE on connection — before any event handlers
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token as string | undefined;
  if (!token) return next(new Error("Authentication required"));

  const payload = await verifyToken(token);
  if (!payload) return next(new Error("Invalid token"));

  socket.data.userId = payload.userId;
  next();
});

io.on("connection", (socket) => {
  // Auto-join the user's room — no client-controlled userId
  socket.join(`user:${socket.data.userId}`);
});
```

**Client-side (web):**

```typescript
import { io } from "socket.io-client";

const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
  auth: { token: session.jwt },  // Auth.js JWT from session
  withCredentials: true,
  autoConnect: false,
});
```

See the **auth-js** skill for how JWTs are structured and the shared `AUTH_SECRET`.

---

## Room Management

SocialHub uses `user:{userId}` rooms. Every authenticated socket auto-joins its room on connection.

**Emit to a specific user:**

```typescript
io.to(`user:${userId}`).emit("notification", payload);
```

**Emit to multiple users (batch):**

```typescript
const userIds = ["abc", "def", "ghi"];
for (const id of userIds) {
  io.to(`user:${id}`).emit("feed:new-posts", { platform: "twitter", count: 5 });
}
```

**Check if a user has active connections:**

```typescript
const sockets = await io.in(`user:${userId}`).fetchSockets();
const isOnline = sockets.length > 0;
```

### WARNING: Room Name Collisions

**The Problem:**

```typescript
// BAD — generic room names collide
socket.join(userId);       // Could match other room naming schemes
socket.join("notifications"); // All users in one room
```

**Why This Breaks:** Without a namespace prefix, room names can collide with socket IDs or other room schemes, causing unintended broadcast targets.

**The Fix:** Always prefix rooms: `user:`, `platform:`, `feed:`.

---

## Fastify Decoration and Access

The plugin decorates `fastify.io` so Socket.IO is accessible from tRPC context, routes, and other plugins.

**Extend Fastify types:**

```typescript
// apps/api/src/types/fastify.d.ts
import type { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from "@socialhub/shared/types";

declare module "fastify" {
  interface FastifyInstance {
    io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  }
}
```

**Access in tRPC context:**

```typescript
// apps/api/src/trpc/context.ts
export async function createContext({ req, res }: { req: FastifyRequest; res: FastifyReply }) {
  return {
    io: req.server.io,  // Fastify request carries server reference
    userId: req.userId,
  };
}
```

See the **fastify** skill for plugin registration order and decoration patterns.

---

## Redis Adapter for Scaling

Without the Redis adapter, each Fastify instance maintains its own Socket.IO connection pool. If a user connects to instance A but a BullMQ worker emits on instance B, the event is lost.

**Install:**

```bash
pnpm --filter @socialhub/api add @socket.io/redis-adapter
```

**Configure:**

```typescript
import { createAdapter } from "@socket.io/redis-adapter";
import { getRedis } from "../lib/redis.js";
import Redis from "ioredis";

export async function socketPlugin(fastify: FastifyInstance) {
  const pubClient = getRedis();
  const subClient = pubClient.duplicate();

  const io = new Server(fastify.server, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });
  // ...
}
```

**CRITICAL:** `ioredis` requires a **duplicated** client for the subscriber — the same client cannot be used for both pub and sub. See the **redis** skill for connection management.

---

## Anti-Patterns

### WARNING: Logging at `info` Level on Every Connect/Disconnect

**The Problem:**

```typescript
// BAD — info-level logs on every connection churn
io.on("connection", (socket) => {
  fastify.log.info(`Socket connected: ${socket.id}`);
  socket.on("disconnect", () => {
    fastify.log.info(`Socket disconnected: ${socket.id}`);
  });
});
```

**Why This Breaks:** With 100K concurrent users (PRD target), connect/disconnect events produce massive log volume at `info` level, drowning actionable logs and increasing costs.

**The Fix:**

```typescript
io.on("connection", (socket) => {
  fastify.log.debug({ socketId: socket.id, userId: socket.data.userId }, "socket connected");
  socket.on("disconnect", (reason) => {
    fastify.log.debug({ socketId: socket.id, reason }, "socket disconnected");
  });
});
```

Use `debug` level for connection lifecycle. Log structured objects, not template strings.

### WARNING: Broadcasting Unvalidated Client Payloads

**The Problem:**

```typescript
// BAD — trusting client-sent data and rebroadcasting
socket.on("notification:ack", (data) => {
  io.to(`user:${data.userId}`).emit("notifications:read", data);
});
```

**Why This Breaks:** Clients can send malformed or malicious payloads. Rebroadcasting without validation is an injection vector.

**The Fix:** Validate with Zod before processing. See the **zod** skill.

```typescript
import { z } from "zod";

const ackSchema = z.string().uuid();

socket.on("notification:ack", (raw) => {
  const result = ackSchema.safeParse(raw);
  if (!result.success) return; // silently drop invalid payloads
  // Process validated notification ID
});
```
