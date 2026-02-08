# Redis Patterns Reference

## Contents
- Client Singleton Pattern
- Key Naming Convention
- Cache-Aside Pattern
- Serialization
- Rate Limiting
- WARNING: Anti-Patterns

---

## Client Singleton Pattern

The Redis client is a lazy singleton. All consumers — caching, BullMQ queues, rate limiting — share one connection.

```typescript
// apps/api/src/lib/redis.ts
import Redis from "ioredis";
import { env } from "../env.js";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this
    });
  }
  return redis;
}
```

**Why `maxRetriesPerRequest: null`?** BullMQ uses blocking Redis commands (`BRPOPLPUSH`) that can wait indefinitely. The default ioredis retry limit (20) causes these commands to throw, crashing your workers.

---

## Key Naming Convention

Use colon-delimited, hierarchical keys: `{domain}:{entity}:{id}`.

| Use Case | Key Pattern | Example |
|----------|-------------|---------|
| Feed cache | `feed:{userId}:{platform}` | `feed:abc123:twitter` |
| Unified feed | `feed:{userId}:unified` | `feed:abc123:unified` |
| Rate limit | `ratelimit:{userId}` | `ratelimit:abc123` |
| Session metadata | `session:{sessionId}` | `session:jwt_xyz` |
| Platform health | `health:{platform}` | `health:bluesky` |
| Token refresh lock | `lock:token:{connectionId}` | `lock:token:conn_456` |

```typescript
// GOOD — structured, scannable, consistent
const CACHE_PREFIX = "feed" as const;
const key = `${CACHE_PREFIX}:${userId}:${platform}`;

// BAD — unstructured, impossible to scan or debug
const key = `${userId}_feed_${platform}_cache`;
```

---

## Cache-Aside Pattern

The primary caching pattern for SocialHub. Check cache first, fetch on miss, write back.

```typescript
// In a tRPC router or service
import { getRedis } from "../lib/redis.js";

const FEED_TTL = 300; // 5 minutes

async function getCachedFeed(userId: string, platform: string) {
  const redis = getRedis();
  const key = `feed:${userId}:${platform}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as FeedItem[];

  const fresh = await platformService.fetchFeed(userId, platform);
  await redis.set(key, JSON.stringify(fresh), "EX", FEED_TTL);
  return fresh;
}
```

**Cache invalidation** — invalidate on user action (new post, unlike) or platform webhook:

```typescript
async function invalidateFeedCache(userId: string, platform?: string) {
  const redis = getRedis();
  if (platform) {
    await redis.del(`feed:${userId}:${platform}`);
  }
  // Always invalidate the unified feed
  await redis.del(`feed:${userId}:unified`);
}
```

---

## Serialization

NEVER store raw objects. Redis stores strings. Always `JSON.stringify`/`JSON.parse`.

```typescript
// GOOD — explicit serialization with type assertion
const data = await redis.get(key);
const feed = data ? (JSON.parse(data) as FeedItem[]) : null;

// GOOD — use pipeline for multiple keys
const pipeline = redis.pipeline();
keys.forEach((k) => pipeline.get(k));
const results = await pipeline.exec();
const feeds = results?.map(([err, val]) =>
  val ? (JSON.parse(val as string) as FeedItem[]) : null,
);
```

For typed serialization, use Zod schemas from `@socialhub/shared`. See the **zod** skill.

```typescript
import { feedItemSchema } from "@socialhub/shared/schemas";

const raw = await redis.get(key);
if (raw) {
  const parsed = z.array(feedItemSchema).safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;
  // Cache corrupted — delete and fetch fresh
  await redis.del(key);
}
```

---

## Rate Limiting

Simple sliding-window counter using `INCR` + `EXPIRE`:

```typescript
import { TRPCError } from "@trpc/server";
import { getRedis } from "../lib/redis.js";

const RATE_LIMIT_WINDOW = 60; // seconds
const RATE_LIMIT_MAX = 100; // requests per window

async function checkRateLimit(userId: string): Promise<void> {
  const redis = getRedis();
  const key = `ratelimit:${userId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, RATE_LIMIT_WINDOW);
  }
  if (current > RATE_LIMIT_MAX) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Rate limit exceeded" });
  }
}
```

For per-platform rate limiting (respecting external API quotas), use a separate counter per platform:

```typescript
const key = `ratelimit:platform:${platform}`;
```

---

## WARNING: Creating Multiple Redis Clients

**The Problem:**

```typescript
// BAD — new connection on every call
async function getUser(id: string) {
  const redis = new Redis(env.REDIS_URL);
  const user = await redis.get(`user:${id}`);
  // connection leak — never closed
  return user;
}
```

**Why This Breaks:**
1. Each `new Redis()` opens a TCP connection — you'll exhaust file descriptors under load
2. Connections are never closed, causing resource leaks
3. Redis has a default `maxclients` of 10,000 — you'll hit it fast in production

**The Fix:** Always use `getRedis()` from `apps/api/src/lib/redis.ts`.

---

## WARNING: Storing Objects Without TTL

**The Problem:**

```typescript
// BAD — no expiry, memory grows forever
await redis.set(`feed:${userId}`, JSON.stringify(data));
```

**Why This Breaks:**
1. Redis is in-memory — unbounded writes cause OOM and crash the instance
2. Stale data served indefinitely with no mechanism to refresh
3. In SocialHub, social feeds become outdated within minutes

**The Fix:** Always set a TTL. Use `EX` (seconds) or `PX` (milliseconds):

```typescript
// GOOD — explicit 5 minute TTL
await redis.set(`feed:${userId}`, JSON.stringify(data), "EX", 300);
```

---

## WARNING: Using `KEYS` in Production

**The Problem:**

```typescript
// BAD — blocks the entire Redis instance
const allFeedKeys = await redis.keys("feed:*");
```

**Why This Breaks:**
1. `KEYS` scans the entire keyspace in a single blocking operation
2. With 100K+ users, this takes seconds and blocks ALL other Redis operations
3. Causes latency spikes across every service sharing this Redis instance

**The Fix:** Use `SCAN` for iteration:

```typescript
// GOOD — non-blocking cursor-based iteration
const stream = redis.scanStream({ match: "feed:*", count: 100 });
stream.on("data", (keys: string[]) => {
  // process batch of keys
});
```

**When You Might Be Tempted:** Debugging, cache invalidation by pattern, admin tools. Always use `SCAN` instead.
