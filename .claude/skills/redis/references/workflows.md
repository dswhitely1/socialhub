# Redis Workflows Reference

## Contents
- Docker Infrastructure
- Adding a New Cache Layer
- Adding a New BullMQ Job
- Debugging Redis
- Graceful Shutdown

---

## Docker Infrastructure

Redis 7 runs via Docker Compose on port 6379 with a persistent named volume.

```yaml
# docker-compose.yml (relevant section)
redis:
  image: redis:7-alpine
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

| Command | Effect |
|---------|--------|
| `pnpm docker:up` | Start Redis (and Postgres, Meilisearch) |
| `pnpm docker:down` | Stop all containers |
| `pnpm docker:reset` | **Destroy volumes** and restart — wipes all cached data |

To connect via CLI for debugging:

```bash
docker exec -it socialhub-redis-1 redis-cli
```

---

## Adding a New Cache Layer

Copy this checklist and track progress:
- [ ] Step 1: Define key pattern and TTL constant in your service
- [ ] Step 2: Implement cache-aside read (check cache → fetch → write back)
- [ ] Step 3: Add cache invalidation on mutations
- [ ] Step 4: Test with `redis-cli MONITOR` to verify keys and TTLs
- [ ] Step 5: Verify cache misses fall through correctly

### Example: Adding notification caching

```typescript
// apps/api/src/services/notification.service.ts
import { getRedis } from "../lib/redis.js";

const NOTIFICATION_TTL = 120; // 2 minutes — notifications update frequently

export async function getCachedNotifications(userId: string) {
  const redis = getRedis();
  const key = `notifications:${userId}`;

  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached) as Notification[];

  const fresh = await fetchNotificationsFromDb(userId);
  await redis.set(key, JSON.stringify(fresh), "EX", NOTIFICATION_TTL);
  return fresh;
}

export async function invalidateNotificationCache(userId: string) {
  await getRedis().del(`notifications:${userId}`);
}
```

**Integration with tRPC:** Call the cache function in your router, invalidate in mutations:

```typescript
// apps/api/src/trpc/routers/notification.router.ts
notification: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return getCachedNotifications(ctx.user.id);
  }),
  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id);
      await invalidateNotificationCache(ctx.user.id); // bust cache
    }),
}),
```

---

## Adding a New BullMQ Job

See the **bullmq** skill for detailed job patterns. Quick workflow:

Copy this checklist and track progress:
- [ ] Step 1: Create `apps/api/src/jobs/{name}.job.ts` with Queue + Worker exports
- [ ] Step 2: Define typed job data interface
- [ ] Step 3: Register worker startup in `apps/api/src/server.ts`
- [ ] Step 4: Add queue to relevant service for job dispatch
- [ ] Step 5: Test with `pnpm dev` and verify worker logs

### Job file template

```typescript
// apps/api/src/jobs/webhook-ingest.job.ts
import { Queue, Worker } from "bullmq";
import { getRedis } from "../lib/redis.js";

const QUEUE_NAME = "webhook-ingest";

interface WebhookJobData {
  platform: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export function createWebhookIngestQueue() {
  return new Queue<WebhookJobData>(QUEUE_NAME, { connection: getRedis() });
}

export function createWebhookIngestWorker() {
  return new Worker<WebhookJobData>(
    QUEUE_NAME,
    async (job) => {
      const { platform, payload } = job.data;
      console.log(`Processing ${platform} webhook`, payload);
      // process webhook...
    },
    {
      connection: getRedis(),
      concurrency: 5,
    },
  );
}
```

### Register in server startup

```typescript
// apps/api/src/server.ts — add to startup sequence
import { createWebhookIngestWorker } from "./jobs/webhook-ingest.job.js";

// After Fastify is ready
const webhookWorker = createWebhookIngestWorker();
webhookWorker.on("failed", (job, err) => {
  console.error(`Webhook job ${job?.id} failed:`, err);
});
```

---

## Debugging Redis

### Validate connection

```bash
# 1. Check Redis is running
docker exec -it socialhub-redis-1 redis-cli PING
# Expected: PONG

# 2. Monitor all commands in real-time
docker exec -it socialhub-redis-1 redis-cli MONITOR

# 3. Check memory usage
docker exec -it socialhub-redis-1 redis-cli INFO memory
```

### Inspect keys

```bash
# List keys matching a pattern (safe — uses SCAN internally)
docker exec -it socialhub-redis-1 redis-cli --scan --pattern "feed:*"

# Check TTL on a key
docker exec -it socialhub-redis-1 redis-cli TTL "feed:abc123:twitter"

# Get a cached value
docker exec -it socialhub-redis-1 redis-cli GET "feed:abc123:twitter"

# Check BullMQ queue length
docker exec -it socialhub-redis-1 redis-cli LLEN "bull:feed-polling:wait"
```

### Iterate-until-pass debugging workflow

1. Make your code change
2. Validate: `docker exec -it socialhub-redis-1 redis-cli MONITOR` and trigger the operation
3. If expected keys don't appear or TTLs are wrong, fix and repeat step 2
4. Only proceed when MONITOR shows correct key patterns and operations

---

## Graceful Shutdown

NEVER let ioredis connections or BullMQ workers leak on server shutdown. Register cleanup handlers:

```typescript
// apps/api/src/server.ts
import { getRedis } from "./lib/redis.js";

async function gracefulShutdown() {
  // 1. Close BullMQ workers first (stop accepting jobs)
  await feedPollingWorker.close();
  await tokenRefreshWorker.close();

  // 2. Close Fastify (stop accepting HTTP requests)
  await app.close();

  // 3. Close Redis connection last
  await getRedis().quit();

  process.exit(0);
}

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
```

**Order matters:** Close workers before Redis. If you close Redis first, workers will throw connection errors trying to report their final job status.

---

## WARNING: Forgetting to Start Workers

**The Problem:** Queue and Worker factories are defined in `apps/api/src/jobs/` but never called.

**Current Status:** Both `createFeedPollingWorker()` and `createTokenRefreshWorker()` are defined but **not called** in `server.ts`. Jobs added to these queues will pile up indefinitely.

**The Fix:** Workers must be instantiated during server startup. See the **fastify** skill for plugin lifecycle integration.

```typescript
// apps/api/src/server.ts — workers need to start here
const feedWorker = createFeedPollingWorker();
const tokenWorker = createTokenRefreshWorker();

feedWorker.on("completed", (job) => console.log(`Feed poll done: ${job.id}`));
feedWorker.on("failed", (job, err) => console.error(`Feed poll failed:`, err));
```

---

## WARNING: Missing Redis Health Check

**The Problem:** No health endpoint verifies Redis connectivity. If Redis goes down, the API continues accepting requests and fails on every cache or queue operation.

**The Fix:** Add Redis to your health check endpoint:

```typescript
// In a health check route or tRPC procedure
async function checkRedisHealth(): Promise<boolean> {
  try {
    const pong = await getRedis().ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
```

Integrate with the Fastify health check. See the **fastify** skill.
