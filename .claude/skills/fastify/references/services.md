# Services Reference

## Contents
- Service Layer Architecture
- Platform Adapter Pattern
- Search Service
- Notification Service
- Creating a New Service
- Anti-Patterns

## Service Layer Architecture

Services live in `apps/api/src/services/` and contain all business logic. tRPC routers delegate to services — routers handle input validation and context, services handle the work.

**File naming:** `{domain}.service.ts` in kebab-case.

| Service | File | Status |
|---------|------|--------|
| Auth | `auth.service.ts` | Stub — JWT verification TODO |
| Platform | `platform.service.ts` | Interface defined, no adapters |
| Search | `search.service.ts` | Implemented (Meilisearch) |
| Notification | `notification.service.ts` | Implemented (Socket.IO push) |

## Platform Adapter Pattern

The core architectural pattern for social platform integrations. Each platform implements a common interface, registered in a map for runtime lookup:

```typescript
// apps/api/src/services/platform.service.ts
import type { Platform } from "@socialhub/shared";

export interface PlatformAdapter {
  fetchFeed(accessToken: string, cursor?: string): Promise<unknown[]>;
  fetchNotifications(accessToken: string): Promise<unknown[]>;
  publishPost(accessToken: string, content: string): Promise<unknown>;
  refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken?: string }>;
}

const adapters = new Map<Platform, PlatformAdapter>();

export function getPlatformAdapter(platform: Platform): PlatformAdapter | undefined {
  return adapters.get(platform);
}

export function registerPlatformAdapter(platform: Platform, adapter: PlatformAdapter) {
  adapters.set(platform, adapter);
}
```

**Implementing a new adapter:**

```typescript
// apps/api/src/services/adapters/bluesky.adapter.ts
import type { PlatformAdapter } from "../platform.service.js";

export const blueskyAdapter: PlatformAdapter = {
  async fetchFeed(accessToken, cursor) {
    // Call Bluesky AT Protocol API
    return [];
  },
  async fetchNotifications(accessToken) { return []; },
  async publishPost(accessToken, content) { return {}; },
  async refreshToken(refreshToken) {
    return { accessToken: "new-token" };
  },
};
```

Register adapters at startup in `server.ts` or a dedicated plugin.

## Search Service

Fully implemented integration with Meilisearch. See the **meilisearch** skill for index configuration.

```typescript
// apps/api/src/services/search.service.ts
import { getMeiliSearch } from "../lib/meilisearch.js";

const POSTS_INDEX = "posts";

export async function indexPost(post: {
  id: string;
  content: string;
  authorName: string;
  platform: string;
}) {
  const meili = getMeiliSearch();
  const index = meili.index(POSTS_INDEX);
  await index.addDocuments([post]);
}

export async function searchPosts(query: string, limit = 20) {
  const meili = getMeiliSearch();
  const index = meili.index(POSTS_INDEX);
  return index.search(query, { limit });
}
```

**Pattern:** Services access library singletons via `get*()` functions from `apps/api/src/lib/`. Never instantiate clients directly in services.

## Notification Service

Pushes real-time notifications to connected clients via Socket.IO. See the **socket-io** skill for client-side handling.

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

**Usage from a tRPC procedure or BullMQ worker:**

```typescript
// Access io from Fastify's decorated instance
const io = fastify.io; // Set by socketPlugin via fastify.decorate("io", io)
sendNotification(io, userId, {
  type: "mention",
  title: "New mention on X",
  body: "@user mentioned you",
});
```

## Creating a New Service

Copy this checklist:
- [ ] Create `apps/api/src/services/{domain}.service.ts`
- [ ] Import singletons from `../lib/*.js` (not direct instantiation)
- [ ] Export pure functions that accept dependencies as parameters
- [ ] Use `.js` extension in all relative imports (ESM)
- [ ] Call from tRPC routers — keep routers thin

**Service function signature pattern:**

```typescript
// GOOD — dependencies as parameters, easy to test
export async function getUserPlatforms(db: ReturnType<typeof getDb>, userId: string) {
  return db.select().from(platformConnections).where(eq(platformConnections.userId, userId));
}

// GOOD — singleton access for simple cases
export async function searchPosts(query: string, limit = 20) {
  const meili = getMeiliSearch();
  return meili.index("posts").search(query, { limit });
}
```

## Anti-Patterns

### WARNING: Direct Client Instantiation in Services

**The Problem:**

```typescript
// BAD — creates a new Redis connection per call
import Redis from "ioredis";
export async function cachePost(post: Post) {
  const redis = new Redis(process.env.REDIS_URL!);
  await redis.set(`post:${post.id}`, JSON.stringify(post));
}
```

**Why This Breaks:** Connection exhaustion. Each call opens a new connection instead of reusing the singleton. You'll hit Redis connection limits under load.

**The Fix:** Use the lazy singleton from `apps/api/src/lib/`:

```typescript
// GOOD — reuses singleton connection
import { getRedis } from "../lib/redis.js";
export async function cachePost(post: Post) {
  const redis = getRedis();
  await redis.set(`post:${post.id}`, JSON.stringify(post));
}
```

### WARNING: Accessing process.env Directly

**The Problem:** Bypasses Zod validation. If the env var is missing or malformed, you get a runtime crash deep in business logic instead of a clear startup error.

**The Fix:** Always import from `../env.js`. The Zod schema validates all env vars at startup. See the **zod** skill.

### WARNING: Stateful Services

**The Problem:** Services that hold mutable state (counters, caches, in-progress maps) outside of Redis or the database create consistency issues across restarts and horizontal scaling.

**The Fix:** Store all mutable state in Redis or PostgreSQL. Services should be stateless functions. See the **redis** skill for caching patterns.
