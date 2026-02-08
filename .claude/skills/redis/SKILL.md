---
name: redis
description: |
  Implements Redis caching, session storage, and BullMQ job queues for the SocialHub monorepo.
  Use when: adding cache layers, configuring Redis connections, creating BullMQ queues/workers,
  implementing rate limiting, or debugging Redis-related issues.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Redis Skill

SocialHub uses **Redis 7** (via Docker on port 6379) with `ioredis` as the client. Redis serves three purposes: feed/session caching, BullMQ job queue backing store, and Socket.IO adapter for multi-instance scaling. The client is a lazy singleton in `apps/api/src/lib/redis.ts`.

## Quick Start

### Client Singleton

```typescript
// apps/api/src/lib/redis.ts
import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}
```

**CRITICAL:** `maxRetriesPerRequest: null` is required for BullMQ compatibility. Without it, BullMQ workers throw `MaxRetriesPerRequestError`.

### Cache-Aside Pattern

```typescript
import { getRedis } from "../lib/redis.js";

const CACHE_TTL = 300; // 5 minutes

export async function getCachedFeed(userId: string, platform?: string): Promise<Post[] | null> {
  const redis = getRedis();
  const key = `feed:${userId}:${platform ?? "all"}`;
  const cached = await redis.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function cacheFeed(userId: string, platform: string | undefined, posts: Post[]): Promise<void> {
  const redis = getRedis();
  const key = `feed:${userId}:${platform ?? "all"}`;
  await redis.set(key, JSON.stringify(posts), "EX", CACHE_TTL);
}
```

### BullMQ Queue

```typescript
import { Queue } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "feed-polling";

export function createFeedPollingQueue() {
  return new Queue(QUEUE_NAME, { connection: getRedis() });
}
```

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| Lazy singleton | One connection, reused everywhere | `getRedis()` |
| Cache-aside | Check cache → miss → query DB → cache result | Feed and notification caching |
| BullMQ backing | Same Redis instance for job queues | `connection: getRedis()` |
| Key namespacing | `domain:identifier` pattern | `feed:userId:platform` |
| TTL on all keys | Prevent unbounded memory growth | `"EX", 300` (5 min) |
| Socket.IO adapter | Pub/sub for multi-instance | `@socket.io/redis-adapter` |

## Common Patterns

### Rate Limiting (Sliding Window)

```typescript
export async function checkRateLimit(userId: string, platform: string, maxPerMinute: number): Promise<boolean> {
  const redis = getRedis();
  const key = `ratelimit:${platform}:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= maxPerMinute;
}
```

### Cache Invalidation

```typescript
export async function invalidateFeedCache(userId: string): Promise<void> {
  const redis = getRedis();
  const keys = await redis.keys(`feed:${userId}:*`);
  if (keys.length > 0) await redis.del(...keys);
}
```

## Infrastructure

- **Docker:** Redis 7 on port 6379
- **Env var:** `REDIS_URL` (default: `redis://localhost:6379`)
- **Start:** `pnpm docker:up`
- **Health check:** `docker compose exec redis redis-cli ping`

## See Also

- [patterns](references/patterns.md) — Client setup, key naming, cache-aside, rate limiting, anti-patterns
- [workflows](references/workflows.md) — Adding cache layers, BullMQ jobs, debugging, graceful shutdown

## Related Skills

- See the **bullmq** skill for background job patterns and worker configuration
- See the **fastify** skill for plugin lifecycle and graceful shutdown
- See the **socket-io** skill for Redis adapter configuration
- See the **typescript** skill for type-safe serialization patterns
- See the **zod** skill for validating cached data on read

## Documentation Resources

> Fetch latest Redis and ioredis documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "ioredis" or "redis"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library IDs:**
- `/redis/ioredis` — ioredis client library
- `/websites/bullmq_io` — BullMQ (Redis-backed queues)
- `/websites/redis_io` — Redis official docs

**Recommended Queries:**
- "ioredis connection options maxRetriesPerRequest"
- "ioredis pipeline batch commands"
- "Redis SET with EX TTL"
- "Redis SCAN vs KEYS"
